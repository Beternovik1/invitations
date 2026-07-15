import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin access boundary — httpOnly-cookie session for the read-only
 * `/admin/rsvps` overview.
 *
 * Replaces the old `?key=` query-parameter access model, which leaked the
 * shared secret into URLs (referer headers, browser history, chat logs,
 * server logs). The host now signs in once at `/admin/login`; a signed
 * httpOnly cookie holds the session so the secret itself never travels in a
 * URL again.
 *
 * This is MVP protection only — it is NOT a full auth system and there are no
 * user accounts. The session cookie proves only that the visitor once knew the
 * shared `ADMIN_ACCESS_KEY`. The key and the service-role Supabase key stay
 * server-only; nothing in this module is ever importable by a client component
 * (enforced by the top-level `import "server-only"`).
 *
 * Cookie model:
 *
 *   - Name: `invitations_admin`, scoped to `path: "/admin"` so it is sent only
 *     on admin routes and never on the public invitation.
 *   - Value: a deterministic HMAC-SHA256 of a constant payload, keyed by
 *     `ADMIN_ACCESS_KEY`. The cookie therefore carries an unforgeable proof of
 *     knowledge without storing the raw secret, and verification is a constant
 *     `timingSafeEqual` against the recomputed digest.
 *   - Flags: `httpOnly` (no JS access), `sameSite: "lax"` (the login form POST
 *     and a top-level navigation to `/admin/rsvps` work, while cross-site
 *     requests do not carry the cookie), `secure` in production only so local
 *     `http://localhost` dev keeps working, and a `maxAge` of 8 hours.
 */

/** Name of the session cookie. Scoped to `path: "/admin"` at set time. */
const ADMIN_COOKIE_NAME = "invitations_admin";

/** Constant payload signed with `ADMIN_ACCESS_KEY`. Versioned so the token can
 *  be invalidated by bumping this string without changing the secret. */
const SESSION_PAYLOAD = "invitations-admin-session-v1";

/** Session lifetime in seconds — 8 hours is long enough for a host checking
 *  confirmations during an evening without re-entering the key on every read. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/** Read the configured admin access key, or `null` when unset. */
export function getAdminAccessKey(): string | null {
  const key = process.env.ADMIN_ACCESS_KEY;
  return key && key.length > 0 ? key : null;
}

/** True when `ADMIN_ACCESS_KEY` is configured. When false, admin routes render
 *  a setup-required screen and never touch Supabase. */
export function isAdminAccessConfigured(): boolean {
  return getAdminAccessKey() !== null;
}

/** Compute the session token for a given access key: a base64url
 *  HMAC-SHA256 of the versioned payload. Deterministic, so verification is a
 *  recompute-and-compare rather than a lookup. */
function signSession(adminKey: string): string {
  const hmac = createHmac("sha256", adminKey);
  hmac.update(SESSION_PAYLOAD);
  return hmac.digest("base64url");
}

/** Constant-time string comparison. Both inputs are UTF-8 encoded; length
 *  mismatch short-circuits to false before any byte comparison, which is fine
 *  here (length does not leak the secret). */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Verify a candidate access key against the configured one. Returns false
 *  when the env key is unset or the candidate does not match. */
function verifyAccessKey(candidate: string): boolean {
  const adminKey = getAdminAccessKey();
  if (adminKey === null) return false;
  return safeEqual(candidate, adminKey);
}

/** Verify a presented session cookie against the configured key. Returns false
 *  when the env key is unset, the cookie is missing, or the token does not
 *  match the recomputed digest. Safe to call on every admin request. */
function verifySessionToken(token: string | undefined): boolean {
  const adminKey = getAdminAccessKey();
  if (adminKey === null) return false;
  if (typeof token !== "string" || token.length === 0) return false;
  return safeEqual(token, signSession(adminKey));
}

/** True when the current request carries a valid admin session cookie. Reads
 *  `cookies()` (async in Next 15+). Returns false when the access key is
 *  unset so a misconfigured deployment never treats an empty env as "open". */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/** Verify the candidate key and, on success, set the signed session cookie.
 *  Returns true on success, false when the env key is unset or the candidate is
 *  wrong. Always sets the cookie with the full security options below. */
export async function signInAdmin(candidate: string): Promise<boolean> {
  if (!verifyAccessKey(candidate)) return false;
  const adminKey = getAdminAccessKey();
  if (adminKey === null) return false; // unreachable given verify above

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, signSession(adminKey), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return true;
}

/** Clear the admin session cookie. Idempotent — safe to call when no session
 *  exists. Uses the same `path: "/admin"` so the browser deletes the exact
 *  cookie that was set, not a same-named cookie elsewhere. */
export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0,
  });
}