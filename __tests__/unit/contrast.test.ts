import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Colour contrast for the public site.
 *
 * The landing page states "WCAG 2.2 AA" in its own legal bar, so the palette
 * has to actually meet it. This reads the tokens out of styles/globals.css and
 * checks every pairing the page really renders — changing a token value, or
 * flipping a label back to white on orange, fails here rather than in an audit
 * after launch.
 *
 * The pairings are listed by hand because CSS alone cannot say which colour
 * lands on which ground. Add a row when a new pairing is introduced.
 */

const GLOBALS = join(process.cwd(), 'styles', 'globals.css');

/** Reads `--name: #value;` declarations out of the `:root` block. */
function readTokens(css: string): Record<string, string> {
  const root = /:root\s*\{([\s\S]*?)\}/.exec(css);
  if (!root?.[1]) throw new Error('No :root block in styles/globals.css');

  const tokens: Record<string, string> = {};
  for (const [, name, value] of root[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG 2.2 minimums. Large is >=24px, or >=18.66px bold. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;
const AA_NON_TEXT = 3;

const tokens = readTokens(readFileSync(GLOBALS, 'utf8'));

function token(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Token --${name} is not defined in styles/globals.css`);
  return value;
}

describe('palette tokens', () => {
  it('defines every colour the page composes against', () => {
    for (const name of [
      'orange',
      'orange-lift',
      'orange-on-dark',
      'rust',
      'rust-hover',
      'ink',
      'ink-deep',
      'white',
      'line',
      'zinc-100',
      'zinc-200',
      'zinc-400',
      'zinc-500',
      'zinc-600',
      'zinc-700',
    ]) {
      expect(token(name)).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe('contrast of rendered pairings', () => {
  const cases: Array<[label: string, fg: string, bg: string, minimum: number]> = [
    // Orange is a background. Its labels are charcoal, never white.
    ['primary button label', 'ink', 'orange', AA_TEXT],
    ['primary button label, hover', 'ink', 'orange-lift', AA_TEXT],
    ['nav CTA label', 'ink', 'orange', AA_TEXT],
    ['register submit label', 'ink', 'orange', AA_TEXT],
    ['cookie "accept all" label', 'ink', 'orange', AA_TEXT],
    ['ongoing status badge', 'ink', 'orange', AA_TEXT],
    ['stat band label', 'ink', 'orange', AA_TEXT],
    ['stat band value (42px)', 'ink', 'orange', AA_LARGE],

    // Accents on light grounds are rust, not orange.
    ['eyebrow on white', 'rust', 'white', AA_TEXT],
    ['eyebrow on muted section', 'rust', 'zinc-100', AA_TEXT],
    ['step number (32px)', 'rust', 'white', AA_LARGE],
    ['progress fill against its track', 'rust', 'line', AA_NON_TEXT],
    // Plain rust is 4.41:1 on the `line` ground, so the register band's eyebrow
    // takes the darker rust instead.
    ['eyebrow on the register ground', 'rust-hover', 'line', AA_TEXT],
    ['card link, hover', 'rust-hover', 'white', AA_TEXT],

    // Accents on dark grounds are the light orange.
    ['hero accent on scrim', 'orange-on-dark', 'ink', AA_TEXT],
    ['passport milestone index', 'orange-on-dark', 'ink', AA_TEXT],
    ['footer column heading', 'orange-on-dark', 'ink', AA_TEXT],

    // Body and meta text.
    ['body copy', 'zinc-700', 'white', AA_TEXT],
    ['secondary copy', 'zinc-600', 'white', AA_TEXT],
    ['card meta', 'zinc-500', 'white', AA_TEXT],
    ['leadership portrait caption', 'zinc-600', 'line', AA_TEXT],
    ['register notice', 'zinc-700', 'line', AA_TEXT],
    ['footer link', 'zinc-200', 'ink', AA_TEXT],
    ['legal bar', 'zinc-400', 'ink-deep', AA_TEXT],
    ['pending milestone', 'zinc-400', 'ink', AA_TEXT],

    // The focus ring is two rings so that one of them always contrasts.
    // Filter controls on /projects: a control boundary is non-text contrast, and
    // zinc-400 is only 2.33:1 on the muted ground the filter bar sits on.
    ['filter control border on the muted ground', 'zinc-500', 'zinc-100', AA_NON_TEXT],
    ['pagination control border on white', 'zinc-500', 'white', AA_NON_TEXT],
    ['results meta on the muted ground', 'zinc-700', 'zinc-100', AA_TEXT],
    ['card status badge, upcoming', 'ink', 'line', AA_TEXT],

    // Project detail: the gallery's "view all" tile and the tour viewer chrome
    // both sit on the deeper charcoal rather than on `ink`.
    ['gallery scrim label', 'white', 'ink-deep', AA_TEXT],
    ['tour viewer chrome label', 'white', 'ink-deep', AA_TEXT],
    ['tour "exit tour" control', 'orange-on-dark', 'ink-deep', AA_TEXT],
    ['tour loading copy', 'zinc-200', 'ink-deep', AA_TEXT],

    ['focus ring, outer, on white', 'ink', 'white', AA_NON_TEXT],
    ['focus ring, inner, on charcoal', 'white', 'ink', AA_NON_TEXT],
  ];

  it.each(cases)('%s meets its minimum', (_label, fg, bg, minimum) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(minimum);
  });

  /**
   * The specific mistake this file exists to prevent: the handoff mockup puts
   * white on orange throughout, and it fails at every text size.
   */
  it('rejects white on orange, which the mockup used', () => {
    expect(contrast(token('white'), token('orange'))).toBeLessThan(AA_LARGE);
  });
});
