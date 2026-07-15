import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminPageHeader from "@/app/admin/_components/AdminPageHeader";
import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";
import {
  getActiveGuestGroupsWithRsvp,
  rsvpStatusFor,
  type AdminGuestGroup,
  type RsvpStatus,
} from "@/lib/admin-overview";

/**
 * Read-only RSVP admin overview.
 *
 * This is the "slice of the cake" the host (mom) opens to see who has
 * confirmed without giving her any editing power. It is a Server Component:
 * the service-role Supabase access and the cookie verification both run on
 * the server, so nothing private is ever shipped to the browser.
 *
 * Access is gated twice: the dashboard layout handles the shared redirect/chrome
 * contract, and this page repeats the auth check immediately before calling the
 * private data boundary. That keeps the security decision next to the private
 * fetch even if the page is refactored or reused later.
 *
 * The route is dynamic via the layout's `force-dynamic`, so new RSVPs appear
 * on every reload without a redeploy — the overview is a live read, not a
 * cached page. `title` is merged with the layout's `robots: noindex` so the
 * admin URL stays out of search engines without restating it here.
 */

export const metadata: Metadata = {
  title: "RSVP overview",
};

export default async function AdminRsvpsPage() {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const groups = await getActiveGuestGroupsWithRsvp();
  return <AdminOverview groups={groups} />;
}

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

function AdminOverview({ groups }: { groups: AdminGuestGroup[] }) {
  const summary = computeSummary(groups);

  return (
    <section>
      <AdminPageHeader title="RSVP overview" eyebrow="admin" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Assigned seats"
          value={summary.totalAssignedSeats}
          hint="Excludes groups with pending seat count"
        />
        <SummaryCard
          label="Confirmed attending"
          value={summary.totalConfirmedAttending}
          hint="Sum of confirmed seat counts"
        />
        <SummaryCard
          label="Groups confirmed"
          value={summary.groupsConfirmed}
          hint={`${groups.length} groups total`}
        />
        <SummaryCard
          label="Pending response"
          value={summary.groupsPendingResponse}
          hint="Have seats, no RSVP yet"
        />
        <SummaryCard
          label="Seats pending"
          value={summary.groupsSeatsPending}
          hint="Seat count not yet set"
        />
      </div>

      <div className="mt-10">
        <GroupTable groups={groups} />
      </div>
    </section>
  );
}

interface OverviewSummary {
  totalAssignedSeats: number;
  totalConfirmedAttending: number;
  groupsConfirmed: number;
  groupsPendingResponse: number;
  groupsSeatsPending: number;
}

function computeSummary(groups: AdminGuestGroup[]): OverviewSummary {
  let totalAssignedSeats = 0;
  let totalConfirmedAttending = 0;
  let groupsConfirmed = 0;
  let groupsPendingResponse = 0;
  let groupsSeatsPending = 0;

  for (const group of groups) {
    if (group.assignedSeats == null) {
      groupsSeatsPending += 1;
      // pending-seat groups cannot RSVP, so they contribute to neither
      // "confirmed" nor "pending response".
      continue;
    }
    totalAssignedSeats += group.assignedSeats;
    if (group.rsvp) {
      groupsConfirmed += 1;
      totalConfirmedAttending += group.rsvp.attendingCount;
    } else {
      groupsPendingResponse += 1;
    }
  }

  return {
    totalAssignedSeats,
    totalConfirmedAttending,
    groupsConfirmed,
    groupsPendingResponse,
    groupsSeatsPending,
  };
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="leaf-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-(--color-gold-soft)">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl text-(--color-ink)">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-(--color-ink-dim)">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-group table                                                           */
/* -------------------------------------------------------------------------- */

const STATUS_LABELS: Record<RsvpStatus, string> = {
  confirmed: "Confirmed",
  no_response: "No response",
  seats_pending: "Seats pending",
};

const STATUS_TONE: Record<RsvpStatus, string> = {
  confirmed:
    "bg-(--color-sage)/40 text-(--color-ink) border-(--color-dusty-teal)/40",
  no_response:
    "bg-(--color-pale-yellow-green)/40 text-(--color-ink-dim) border-(--color-gold)/35",
  seats_pending:
    "bg-(--color-glass) text-(--color-ink-dim) border-(--color-glass-border)",
};

function GroupTable({ groups }: { groups: AdminGuestGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-5 py-8 text-(--color-ink-dim)">
        No active guest groups found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-(--color-glass-border) bg-(--color-glass)">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-(--color-glass-border) text-xs uppercase tracking-[0.16em] text-(--color-gold-soft)">
            <th scope="col" className="p-4 font-medium">Group</th>
            <th scope="col" className="p-4 font-medium">Slug</th>
            <th scope="col" className="p-4 font-medium">Seats</th>
            <th scope="col" className="p-4 font-medium">Status</th>
            <th scope="col" className="p-4 font-medium">Attending</th>
            <th scope="col" className="p-4 font-medium">Message</th>
            <th scope="col" className="p-4 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRow key={group.slug} group={group} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRow({ group }: { group: AdminGuestGroup }) {
  const status = rsvpStatusFor(group);
  const seatsLabel =
    group.assignedSeats == null
      ? group.seatsNote ?? "Pending"
      : String(group.assignedSeats);
  const updatedAt = group.rsvp
    ? formatDate(group.rsvp.updatedAt)
    : null;

  return (
    <tr className="border-b border-(--color-glass-border) last:border-b-0 align-top">
      <th scope="row" className="p-4 text-left font-serif text-base font-medium text-(--color-ink)">
        {group.displayName}
      </th>
      <td className="p-4 font-mono text-xs text-(--color-ink-dim)">
        {group.slug}
      </td>
      <td className="p-4 text-(--color-ink)">
        {seatsLabel}
      </td>
      <td className="p-4">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs ${STATUS_TONE[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </td>
      <td className="p-4 text-(--color-ink)">
        {group.rsvp ? group.rsvp.attendingCount : "—"}
      </td>
      <td className="p-4 max-w-xs text-(--color-ink-dim)">
        {group.rsvp && group.rsvp.message ? (
          <span className="line-clamp-3 italic">{group.rsvp.message}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="p-4 text-xs text-(--color-ink-dim)">
        {updatedAt ?? "—"}
      </td>
    </tr>
  );
}

/** Format an ISO timestamp as a short, locale-neutral "YYYY-MM-DD HH:mm (UTC)" so
 *  the host sees a stable, timezone-honest string rather than a wall-clock that
 *  shifts with the visitor's browser locale. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} (UTC)`;
}
