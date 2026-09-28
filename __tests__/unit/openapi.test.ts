import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import yaml from 'js-yaml';

/**
 * Keeps docs/openapi.yaml honest.
 *
 * The OpenAPI document is a handoff deliverable (§18), and a spec that drifts
 * from the routes is worse than none — it sends the frontend team at endpoints
 * that do not exist. This asserts the two match exactly.
 */

interface OpenApiDocument {
  openapi: string;
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
}

function documentedPaths(): Set<string> {
  const raw = readFileSync(join(process.cwd(), 'docs', 'openapi.yaml'), 'utf8');
  const doc = yaml.load(raw) as OpenApiDocument;
  return new Set(Object.keys(doc.paths));
}

function find(pattern: string): string[] {
  return execSync(pattern, { cwd: process.cwd() })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
}

function implementedPaths(): Set<string> {
  // Most routes are pages API routes: pages/api/foo.ts → /api/foo.
  const pagesRoutes = find('find pages/api -name "*.ts"').map((file) =>
    `/${file}`
      .replace(/^\/pages/, '')
      .replace(/\.ts$/, '')
      .replace(/\/index$/, ''),
  );

  // The CMS webhook is an App Router route handler, because only there can it
  // revalidate App Router pages (docs/decisions.md §2.12):
  // app/api/foo/route.ts → /api/foo.
  const appRoutes = find('find app/api -name "route.ts"').map((file) =>
    `/${file}`.replace(/^\/app/, '').replace(/\/route\.ts$/, ''),
  );

  return new Set(
    [...pagesRoutes, ...appRoutes].map((path) => path.replace(/\[(\w+)\]/g, '{$1}')),
  );
}

describe('OpenAPI specification', () => {
  const documented = documentedPaths();
  const implemented = implementedPaths();

  it('documents every implemented route', () => {
    const missing = [...implemented].filter((p) => !documented.has(p)).sort();
    expect(missing).toEqual([]);
  });

  it('does not document routes that do not exist', () => {
    const phantom = [...documented].filter((p) => !implemented.has(p)).sort();
    expect(phantom).toEqual([]);
  });

  it('is a parseable OpenAPI 3.1 document', () => {
    const doc = yaml.load(
      readFileSync(join(process.cwd(), 'docs', 'openapi.yaml'), 'utf8'),
    ) as OpenApiDocument;

    expect(doc.openapi).toMatch(/^3\.1\./);
    expect(Object.keys(doc.components.schemas).length).toBeGreaterThan(0);
  });
});
