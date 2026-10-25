'use client';

/**
 * Last resort, for a failure in the root layout itself. It replaces the layout,
 * so it carries its own document and cannot rely on the site stylesheet.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#1c1c1c',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#ff9955' }}>
            Error 500
          </p>
          <h1 style={{ fontSize: 32, lineHeight: 1.1 }}>Something went wrong on our side.</h1>
          <p style={{ lineHeight: 1.7, color: '#e4e4e7' }}>
            The site could not load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 48,
              padding: '0 28px',
              border: 0,
              background: '#ff6600',
              color: '#1c1c1c',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
