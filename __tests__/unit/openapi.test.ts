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

function implementedPaths(): Set<string> {
  const files = execSync('find pages/api -name "*.ts"', { cwd: process.cwd() })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);

  return new Set(
    files.map((file) =>
      `/${file}`
        .replace(/^\/pages/, '')          // pages/api/... is served at /api/...
        .replace(/\.ts$/, '')
        .replace(/\/index$/, '')
        .replace(/\[(\w+)\]/g, '{$1}'),   // [slug] → {slug}
    ),
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
