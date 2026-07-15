import type { Metadata } from "next";

import AdminPageHeader from "@/app/admin/_components/AdminPageHeader";

/**
 * Guest groups admin placeholder.
 *
 * This is the honest navigation target for the "Guest groups" sidebar link —
 * a reachable route protected by the dashboard layout's auth gate, but with
 * NO editing yet. The host can see that the section exists and where it will
 * live, and the sidebar link is a real navigation rather than a disabled
 * placeholder that hides the destination.
 *
 * The guest-group editor (create / edit seat counts / soft-delete a group) is
 * the next slice. Until then, the live groups stay read-only from the RSVP
 * overview, which already renders the same per-group table.
 *
 * `title` is merged with the dashboard layout's `robots: noindex`, so this
 * route stays out of search engines without restating it here.
 */

export const metadata: Metadata = {
  title: "Guest groups",
};

export default function AdminGuestGroupsPage() {
  return (
    <section>
      <AdminPageHeader title="Guest groups" eyebrow="admin" />

      <div className="leaf-panel rounded-2xl p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-(--color-gold-soft)">
          Coming soon
        </p>
        <h2 className="mt-2 font-serif text-2xl text-(--color-ink)">
          Guest-group editor
        </h2>
        <p className="mt-3 max-w-prose text-(--color-ink-dim)">
          Editing guest groups — names, assigned seats, and soft-deleting a
          link — will land here in the next slice. For now, the live groups
          remain read-only from the RSVP overview, which already shows the
          same per-group table.
        </p>

        <p className="mt-6 text-sm text-(--color-ink-dim)">
          Open the{" "}
          <a
            href="/admin/rsvps"
            className="font-medium text-(--color-dusty-teal) underline-offset-4 hover:underline"
          >
            RSVP overview
          </a>{" "}
          to see current groups and responses.
        </p>
      </div>
    </section>
  );
}