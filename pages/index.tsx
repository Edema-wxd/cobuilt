/**
 * Placeholder home page.
 *
 * Phase 1 backend development runs in parallel with frontend design, so this
 * repository currently ships API routes only. The frontend team replaces this
 * file (and adds the rest of pages/) when the design is ready; nothing in
 * src/lib or pages/api depends on it.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', maxWidth: '40rem' }}>
      <h1>CoBuilt Investment Partners</h1>
      <p>
        Backend API for the CoBuilt corporate website. The public site is in design; the API
        is documented in <code>docs/openapi.yaml</code>.
      </p>
      <p>
        Service health: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
