import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminPageHeader from "@/app/admin/_components/AdminPageHeader";
import GuestGroupEditor from "@/app/admin/(dashboard)/guest-groups/GuestGroupEditor";
import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";
import { getAllGuestGroupsForAdmin } from "@/lib/admin-guest-groups";

/**
 * Guest groups admin editor.
 *
 * Lets the host maintain existing guest groups without touching Supabase:
 * display name, assigned seats, seats note, and active/inactive. Slugs remain
 * immutable in this slice, and there is no create/delete flow — inactive is the
 * safe soft-delete path.
 *
 * Like the RSVP overview, this page repeats admin auth immediately before the
 * private fetch instead of relying only on the dashboard layout. The page is a
 * Server Component; the client editor receives only rows and posts mutations
 * through a Server Action.
 *
 * `title` is merged with the dashboard layout's `robots: noindex`, so this
 * route stays out of search engines without restating it here.
 */

export const metadata: Metadata = {
  title: "Guest groups",
};

export default async function AdminGuestGroupsPage() {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const groups = await getAllGuestGroupsForAdmin();

  return (
    <section>
      <AdminPageHeader title="Guest groups" eyebrow="admin" />

      <p className="mb-6 max-w-3xl text-sm text-(--color-ink-dim)">
        Search for a group, pick it, and edit its name, seat count, seat note,
        or invitation link. Leave assigned seats blank when the count is still
        pending. Inactive groups stop rendering personalized invitation links,
        but the row stays available here so it can be re-enabled later.
      </p>

      <GuestGroupEditor groups={groups} />
    </section>
  );
}
