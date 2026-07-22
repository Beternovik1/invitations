import { redirect } from "next/navigation";

/**
 * Redirect stub for the legacy `/admin/rsvps` route.
 *
 * `Confirmaciones` is now the single official admin screen. The old read-only
 * RSVP overview was folded into `/admin/confirmaciones`, and the host no longer
 * uses the separate routes. Instead of a hard 404, anyone who still has the old
 * URL bookmarked is sent to the official page.
 *
 * This page lives inside the `(dashboard)` route group, so the shared layout's
 * auth gate still runs first: an unauthenticated visitor is redirected to
 * `/admin/login`, and only an authenticated host reaches this redirect. The
 * redirect itself is a plain server `redirect` with no private fetch — nothing
 * is shipped to the browser.
 */

export const metadata = { title: "Confirmaciones" };

export default function AdminRsvpsRedirectPage(): never {
  redirect("/admin/confirmaciones");
}