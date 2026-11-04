'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile — the contact form's CAPTCHA (docs/decisions.md §2.25).
 *
 * Rendered only when the page has a site key, and only by the contact form,
 * so Cloudflare's script is requested on this page and nowhere else. It is
 * loaded as a plain script tag rather than an npm wrapper. The widget is
 * usually a single tick that passes by itself; when Cloudflare is unsure it
 * asks for one click. Its token goes with the enquiry and is checked by the
 * server (src/lib/turnstile.ts).
 *
 * Tokens are single-use, so the form bumps `resetKey` after every attempt and
 * the widget issues a fresh one.
 */

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Loads Cloudflare's script once per page, however many times this mounts. */
function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not start')),
    );
    script.addEventListener('error', () => reject(new Error('Turnstile could not load')));
  });
}

export default function Turnstile({
  siteKey,
  action,
  resetKey,
  onToken,
}: {
  siteKey: string;
  action: string;
  /** Changing it issues a fresh token. */
  resetKey: number;
  /** A token when the check passes; null when it expires or fails. */
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // The latest callback, so the widget is not re-rendered when the form re-renders.
  const tokenCallback = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    tokenCallback.current = onToken;
  });

  useEffect(() => {
    let current = true;

    loadScript()
      .then((turnstile) => {
        if (!current || !container.current || widgetId.current) return;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          theme: 'light',
          size: 'flexible',
          callback: (token: string) => tokenCallback.current(token),
          'expired-callback': () => tokenCallback.current(null),
          'error-callback': () => {
            tokenCallback.current(null);
          },
        });
      })
      .catch(() => {
        if (current) setFailed(true);
      });

    return () => {
      current = false;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      tokenCallback.current(null);
      window.turnstile?.reset(widgetId.current);
    }
  }, [resetKey]);

  if (failed) {
    return (
      <p className="text-[0.781rem] leading-[1.6] text-msg-bad" role="alert">
        The anti-spam check could not load, so the form cannot be sent. Check your connection or any
        content blocker and reload the page — or call or email us instead.
      </p>
    );
  }

  // Cloudflare's widget is 65px tall; the space is held so the form does not jump when it arrives.
  return <div ref={container} className="min-h-16.25" />;
}
