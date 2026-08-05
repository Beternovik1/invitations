import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminPageHeader from "@/app/admin/_components/AdminPageHeader";
import ConfirmationsView from "@/app/admin/(dashboard)/confirmaciones/ConfirmationsView";
import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";
import {
  getActiveGuestGroupsWithRsvp,
  getGuestGroupCategoryLabelsForAdmin,
} from "@/lib/admin-overview";

/**
 * Unified Confirmaciones admin page.
 *
 * Mom asked for a single mobile-first screen that combines the overview's
 * "who confirmed" list with the editor's copy-link action and a manual
 * "Enviada" toggle for dad. This first slice delivers the foundation using
 * the SAME admin styles as the existing pages (no professional redesign yet)
 * and reuses the existing read-only data boundary instead of adding a new
 * one — `getActiveGuestGroupsWithRsvp` already returns active groups with
 * their RSVP joined in, exactly the shape this view needs.
 *
 * Server Component: the service-role Supabase access and the cookie
 * verification both run on the server, so nothing private is shipped to the
 * browser. Like the other admin pages, auth is re-verified immediately before
 * the private fetch — the security decision stays next to the data even
 * though the dashboard layout already gates the whole route group.
 *
 * The personal invitation link is passed to the client view as a SAFE PATH
 * (`/i/[slug]`), not as a server-built absolute URL carrying the origin: the
 * client composes `window.location.origin` at copy time, the same pattern the
 * guest-group editor's `CopyInvitationButton` already uses. No service-role
 * key or Supabase URL ever reaches the client.
 *
 * This page is the single official admin destination. The sidebar links here
 * only, and the legacy `/admin/rsvps` and `/admin/guest-groups` routes are now
 * redirect stubs back to `/admin/confirmaciones`.
 */
export const metadata: Metadata = {
  title: "Confirmaciones",
};

export default async function AdminConfirmacionesPage() {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const groups = await getActiveGuestGroupsWithRsvp();
  const savedCategoryLabels = await getGuestGroupCategoryLabelsForAdmin(
    groups.map((group) => group.eventId ?? "")
  );

  return (
    <section>
      <AdminPageHeader title="Gestión de invitaciones" />

      <ConfirmationsView
        groups={groups}
        savedCategoryLabels={savedCategoryLabels}
      />
    </section>
  );
}
