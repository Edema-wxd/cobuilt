import type { Permission } from '@/lib/auth/rbac';
import type { serializeUser } from '@/lib/serializers';

/**
 * The admin console's side of the auth contract in pages/api/auth.
 *
 * The access token lives in module memory only — never in storage a script
 * injected into the page could read — and the HTTP-only refresh cookie brings
 * it back after a reload. Every admin call carries the token as a bearer
 * header, which is also why the console never needs the CSRF cookie: the
 * pipeline skips the double-submit check for bearer requests.
 */

export type AdminUser = ReturnType<typeof serializeUser>;

export interface Session {
  user: AdminUser;
  permissions: Set<Permission>;
}

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ErrorPayload {
  error?: { message?: string; details?: Array<{ field?: string; message?: string }> };
}

let accessToken: string | null = null;
let session: Session | null = null;
let refreshing: Promise<string | null> | null = null;
const endedListeners = new Set<() => void>();

/**
 * Exchanges the refresh cookie for a new access token.
 *
 * Calls made while one is in flight share it. The refresh token rotates on
 * every use and presenting a rotated one revokes the user's whole token
 * family, so two parallel refreshes — Strict Mode's double effect is enough —
 * would sign the user out of every device.
 */
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = (await response.json()) as { accessToken: string };
      accessToken = payload.accessToken;
      return accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function endSession(): void {
  accessToken = null;
  session = null;
  for (const listener of endedListeners) listener();
}

/** Runs `listener` when a call finds the session can no longer be renewed. */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => endedListeners.delete(listener);
}

/**
 * A 5xx carries nothing an operator can act on, and outside production it
 * carries the driver's own message, so it is replaced. A 4xx is shown as the
 * API worded it.
 */
function describeFailure(status: number, payload: ErrorPayload | null): string {
  if (status === 403) return payload?.error?.message ?? 'Your role does not allow this.';
  if (status === 429) return 'Too many requests. Wait a minute, then try again.';
  if (status >= 500) return 'The server could not complete this. Try again shortly.';
  return (
    payload?.error?.details?.[0]?.message ??
    payload?.error?.message ??
    'The request was not accepted.'
  );
}

function send(path: string, init: { method?: string; json?: unknown }, token: string) {
  return fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.json === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.json === undefined ? undefined : JSON.stringify(init.json),
    cache: 'no-store',
  });
}

/**
 * Calls an authenticated endpoint. An expired access token is renewed once and
 * the call retried; if renewal fails the session ends and listeners are told.
 */
export async function api<T>(
  path: string,
  init: { method?: string; json?: unknown } = {},
): Promise<T> {
  let token = accessToken ?? (await refreshAccessToken());
  if (!token) {
    endSession();
    throw new ApiFailure(401, 'Your session has ended. Sign in again.');
  }

  let response = await send(path, init, token);
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (!token) {
      endSession();
      throw new ApiFailure(401, 'Your session has ended. Sign in again.');
    }
    response = await send(path, init, token);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null;
  if (!response.ok) throw new ApiFailure(response.status, describeFailure(response.status, payload));
  return payload as T;
}

/**
 * The signed-in session, restored from the refresh cookie after a reload.
 * Resolves null when there is no session to restore.
 */
export async function loadSession(): Promise<Session | null> {
  if (session && accessToken) return session;

  const token = accessToken ?? (await refreshAccessToken());
  if (!token) return null;

  try {
    const me = await api<{ user: AdminUser; permissions: Permission[] }>('/api/auth/me');
    session = { user: me.user, permissions: new Set(me.permissions) };
    return session;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ accessToken: string; user: AdminUser; permissions: Permission[] } & ErrorPayload)
    | null;

  if (!response.ok || !payload) {
    throw new ApiFailure(
      response.status,
      response.status === 401
        ? 'That email and password do not match an account.'
        : describeFailure(response.status, payload),
    );
  }

  accessToken = payload.accessToken;
  session = { user: payload.user, permissions: new Set(payload.permissions) };
  return session;
}

export async function signOut(): Promise<void> {
  // The access token stays valid until it expires (15 minutes at most); the
  // revoked refresh token is what stops the session coming back.
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  accessToken = null;
  session = null;
}

/** Only an in-console path is a safe place to return to after signing in. */
export function safeReturnPath(value: string | null): string {
  return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}
