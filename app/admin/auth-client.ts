import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters';
import type { Permission } from '@/lib/auth/rbac';
import type { serializeUser } from '@/lib/serializers';

/**
 * The admin console's side of auth.
 *
 * Identity is Neon Auth: this module signs people up and in against it with the
 * Better Auth client, and asks it for a short-lived access token. Every API
 * call carries that token as a bearer header; the API verifies it and looks up
 * the person's role in its own `users` table (src/lib/auth/session.ts). The
 * token is held in module memory only — never in storage a script injected
 * into the page could read — and is fetched again from the Neon Auth session
 * when it lapses. Because the API never relies on a cookie it sets itself, the
 * console needs no CSRF token.
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

const makeClient = (url: string) => createAuthClient(url, { adapter: BetterAuthVanillaAdapter() });
let neon: ReturnType<typeof makeClient> | undefined;

/** Created on first use: the URL is public configuration, inlined at build time. */
function authClient(): ReturnType<typeof makeClient> {
  const url = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
  if (!url) throw new ApiFailure(503, 'Sign-in is not configured for this environment.');
  neon ??= makeClient(url);
  return neon;
}

let accessToken: string | null = null;
let accessExpiresAt = 0;
let session: Session | null = null;
let refreshing: Promise<string | null> | null = null;
const endedListeners = new Set<() => void>();

/** Neon Auth tokens last 15 minutes; renew a minute early rather than race the expiry. */
const RENEW_MARGIN_MS = 60_000;

function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Asks Neon Auth for an access token for the current session — null when
 * there is no session. Calls made while one is in flight share it.
 */
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const { data } = await authClient().token();
      accessToken = data?.token ?? null;
      accessExpiresAt = accessToken ? tokenExpiry(accessToken) : 0;
      return accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** The cached token while it has time left, otherwise a fresh one. */
function currentToken(): Promise<string | null> {
  if (accessToken && accessExpiresAt - Date.now() > RENEW_MARGIN_MS) {
    return Promise.resolve(accessToken);
  }
  return refreshAccessToken();
}

function endSession(): void {
  accessToken = null;
  accessExpiresAt = 0;
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
  let token = await currentToken();
  if (!token) {
    endSession();
    throw new ApiFailure(401, 'Your session has ended. Sign in again.');
  }

  let response = await send(path, init, token);
  if (response.status === 401) {
    accessToken = null;
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
 * Bearer headers for a call made outside `api` — the UploadThing client, which
 * does its own requests. Renews the access token first if it has lapsed.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await currentToken();
  if (!token) {
    endSession();
    throw new ApiFailure(401, 'Your session has ended. Sign in again.');
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * The signed-in session, restored from the Neon Auth session after a reload.
 * Resolves null when there is no session to restore, or the signed-in person
 * has no CoBuilt account.
 */
export async function loadSession(): Promise<Session | null> {
  if (session && accessToken) return session;

  const token = await currentToken();
  if (!token) return null;

  try {
    const me = await api<{ user: AdminUser; permissions: Permission[] }>('/api/auth/me');
    session = { user: me.user, permissions: new Set(me.permissions) };
    return session;
  } catch {
    return null;
  }
}

/** Neon Auth refuses a sign-in until the address is verified; the form then asks for the emailed code. */
export class VerificationRequired extends Error {
  constructor(readonly email: string) {
    super('Verify your email address to continue.');
  }
}

interface NeonError {
  status?: number;
  code?: string;
  message?: string;
}

function describeNeonError(error: NeonError, fallback: string): ApiFailure {
  const status = error.status ?? 400;
  if (status === 429) return new ApiFailure(429, describeFailure(429, null));
  if (status >= 500) return new ApiFailure(status, describeFailure(status, null));
  return new ApiFailure(status, error.message || fallback);
}

/**
 * Turns a fresh Neon Auth session into a console session. A person who has
 * signed in to Neon Auth but has no CoBuilt account (or a deactivated one) is
 * signed straight back out, so no half-open session is left behind.
 */
async function establishSession(): Promise<Session> {
  accessToken = null;
  try {
    const token = await refreshAccessToken();
    if (!token) throw new ApiFailure(401, 'Your session has ended. Sign in again.');
    const me = await api<{ user: AdminUser; permissions: Permission[] }>('/api/auth/me');
    session = { user: me.user, permissions: new Set(me.permissions) };
    return session;
  } catch (failure) {
    await authClient()
      .signOut()
      .catch(() => undefined);
    endSessionQuietly();
    throw failure;
  }
}

function endSessionQuietly(): void {
  accessToken = null;
  accessExpiresAt = 0;
  session = null;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { error } = await authClient().signIn.email({ email, password });

  if (error) {
    if (error.status === 403 || error.code === 'EMAIL_NOT_VERIFIED') {
      throw new VerificationRequired(email);
    }
    if (error.status === 401 || error.status === 400) {
      throw new ApiFailure(401, 'That email and password do not match an account.');
    }
    throw describeNeonError(error, 'Could not sign in.');
  }

  return establishSession();
}

/**
 * Creates the Neon Auth identity. The address must be verified before it can
 * sign in, and the API only links it to a CoBuilt account that an
 * administrator created for that address.
 */
export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<void> {
  const { error } = await authClient().signUp.email({
    name: input.fullName,
    email: input.email,
    password: input.password,
  });
  if (error) {
    throw describeNeonError(error, 'Could not create the account. Check the details and try again.');
  }
}

/** Emails a six-digit code; used on sign-up, and on sign-in when the address is still unverified. */
export async function sendVerificationCode(email: string): Promise<void> {
  const { error } = await authClient().emailOtp.sendVerificationOtp({
    email,
    type: 'email-verification',
  });
  if (error) throw describeNeonError(error, 'Could not send the code. Try again shortly.');
}

/** Confirms the code. Neon Auth signs the person in on success, so this ends in a session. */
export async function verifyEmail(email: string, code: string): Promise<Session> {
  const { error } = await authClient().emailOtp.verifyEmail({ email, otp: code });
  if (error) {
    throw describeNeonError(error, 'That code is wrong or has expired. Request a new one.');
  }
  return establishSession();
}

/** Emails a reset code. Answers the same whether or not the address has an account. */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const { error } = await authClient().emailOtp.requestPasswordReset({ email });
  if (error && (error.status ?? 500) >= 429) throw describeNeonError(error, 'Could not send the code.');
  return { message: 'If that address has an account, a reset code is on its way.' };
}

/** Sets a new password with the emailed code. Neon Auth ends the account's other sessions. */
export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<{ message: string }> {
  const { error } = await authClient().emailOtp.resetPassword({ email, otp: code, password });
  if (error) {
    throw describeNeonError(error, 'That code is wrong or has expired. Request a new one.');
  }
  return { message: 'Password changed.' };
}

export interface NewAccount {
  email: string;
  fullName: string;
  role?: AdminUser['role'];
}

/**
 * `POST /api/auth/register` — an administrator invites someone by email. The
 * person then signs up at /admin/register with that address.
 */
export async function inviteAccount(account: NewAccount): Promise<AdminUser> {
  const result = await api<{ user: AdminUser }>('/api/auth/register', {
    method: 'POST',
    json: account,
  });
  return result.user;
}

export async function signOut(): Promise<void> {
  // The access token stays valid until it expires (15 minutes at most); ending
  // the Neon Auth session is what stops a new one being issued.
  await authClient()
    .signOut()
    .catch(() => undefined);
  endSessionQuietly();
}

/** Only an in-console path is a safe place to return to after signing in. */
export function safeReturnPath(value: string | null): string {
  return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}
