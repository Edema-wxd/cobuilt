import type { NextApiResponse } from 'next';
import { TTL, invalidatePrefix, remember } from './cache';
import { revalidatePages } from './http/revalidate';
import { logger } from './logger';
import { isReservedPath, lookupKey } from './redirectPaths';
import * as redirects from './repositories/redirects';
import type { RedirectRule } from './repositories/redirects';

/**
 * The redirect lookup (docs/decisions.md §2.27), asked only on the way to a
 * 404 — never for a page that exists.
 *
 * Every rule is held as one map, three deep: in this process for a minute,
 * then in Redis for a minute (shared across instances, cleared by every
 * console write), then PostgreSQL. A burst of 404s from a crawler therefore
 * costs a map lookup each, not a query each. A console write is seen at once
 * by the instance that made it, by the rest within the minute.
 *
 * Never throws. With Redis down the map comes from PostgreSQL; with
 * PostgreSQL down too the answer is "no redirect" — the visitor gets the 404
 * they would have had anyway — and the failure is remembered for a few
 * seconds so an outage is not hammered with a query per request.
 */

export type { RedirectRule };

const CACHE_KEY = 'redirects:rules';
const MEMORY_TTL_MS = TTL.redirects * 1000;
const FAILURE_TTL_MS = 10_000;

interface MemoryCopy {
  rules: Map<string, RedirectRule>;
  expiresAt: number;
}

/*
 * On globalThis rather than in a module variable: the pages that look rules up
 * (App Router) and the console API that writes them (pages router) are
 * separate bundles in one process, each with its own copy of this module, and
 * a write has to clear the copy the pages read.
 */
declare global {
  var __cobuiltRedirectRules: MemoryCopy | null | undefined;
}

const memory = {
  get: (): MemoryCopy | null => globalThis.__cobuiltRedirectRules ?? null,
  set: (copy: MemoryCopy | null): void => {
    globalThis.__cobuiltRedirectRules = copy;
  },
};

async function rules(): Promise<Map<string, RedirectRule>> {
  const held = memory.get();
  if (held && held.expiresAt > Date.now()) return held.rules;

  try {
    const list = await remember(CACHE_KEY, TTL.redirects, () => redirects.listRules());
    const copy = { rules: new Map(list.map((rule) => [rule.sourcePath, rule])), expiresAt: Date.now() + MEMORY_TTL_MS };
    memory.set(copy);
    return copy.rules;
  } catch (error) {
    logger.warn('Redirect rules unavailable; answering 404 without them', {
      error: error instanceof Error ? error.message : String(error),
    });
    // The last rules known are better than none while the database is away.
    const copy = { rules: held?.rules ?? new Map<string, RedirectRule>(), expiresAt: Date.now() + FAILURE_TTL_MS };
    memory.set(copy);
    return copy.rules;
  }
}

/** The rule for a requested path, if any. The console and the API never have one. */
export async function findRedirect(path: string): Promise<RedirectRule | null> {
  if (isReservedPath(path)) return null;
  return (await rules()).get(lookupKey(path)) ?? null;
}

/** Counts a hit. Never throws: a lost count must not turn a redirect into an error. */
export async function recordHit(rule: RedirectRule): Promise<void> {
  try {
    await redirects.recordHit(rule.id);
  } catch (error) {
    logger.warn('Redirect hit not counted', {
      sourcePath: rule.sourcePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Drops this process's copy of the rules, as a console write does. */
export function forgetRedirectRules(): void {
  memory.set(null);
}

/**
 * An address under one of the two sections whose pages are prerendered and
 * regenerated once a minute (`/services/old-name`, `/gallery/old-name`): its
 * 404, or its redirect, is cached like a page. Every other address renders
 * per request.
 */
const CACHED_SECTION = /^\/(?:services|gallery)\/[^/]+$/;

/**
 * After a console write: every instance's map is cleared or expires within the
 * minute, and a cached section address the write touched is regenerated now,
 * so a new rule replaces a cached 404 at once rather than a minute later.
 * Best-effort, like every other revalidation (src/lib/http/revalidate.ts).
 */
export async function redirectsChanged(res: NextApiResponse, sources: readonly string[]): Promise<void> {
  forgetRedirectRules();
  await invalidatePrefix('redirects');
  const cached = [...new Set(sources)].filter((source) => CACHED_SECTION.test(source));
  if (cached.length > 0) await revalidatePages(res, cached);
}
