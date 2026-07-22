import { redirect } from "next/navigation";

/**
 * Redirect stub for the legacy `/admin/guest-groups` route.
 *
 * `Confirmaciones` is now the single official admin screen. Editing, creating,
 * and soft-deleting now happen inline on `/admin/confirmaciones` (the
 * `Modificar` / `Nueva invitación` / `Eliminar` flows reuse the shared Server
 * Actions in `guest-groups/actions.ts`), so this separate editor is no longer
 * reachable from navigation. Instead of a hard 404, anyone who still has the
 * old URL bookmarked is sent to the official page.
 *
 * The shared `actions.ts` module stays in this folder as the neutral mutation
 * surface imported by `/admin/confirmaciones` — only this page (the old
 * editor) is removed.
 *
 * Lives inside the `(dashboard)` route group, so the auth gate in the layout
 * runs first: unauthenticated visitors go to `/admin/login`, authenticated
 * hosts reach this redirect. The redirect is a plain server `redirect` with no
 * private fetch.
 */

export const metadata = { title: "Modificar invitados" };

export default function AdminGuestGroupsRedirectPage(): never {
  redirect("/admin/confirmaciones");
}