import type { Metadata } from "next";

import {
  getActiveGuestGroupsWithRsvp,
  rsvpStatusFor,
  type AdminGuestGroup,
  type RsvpStatus,
} from "@/lib/admin-overview";

/**
 * Read-only RSVP admin overview.
 *
 * This is the "slice of the cake" the host (mom) opens to see who has confirmed
 * without giving her any editing power in this slice. It is a Server Component:
 * the service-role Supabase access and the `ADMIN_ACCESS_KEY` check both run on
 * the server, so nothing private is ever shipped to the browser.
 *
 * Access model (MVP, no full auth system):
 *
 *   1. If `ADMIN_ACCESS_KEY` is not set in the environment, the page renders a
 *      "setup required" screen and DOES NOT fetch any guest data. This avoids
 *      silently serving a confusing empty table on a misconfigured deploy and
 *      makes the missing-secret obvious.
 *   2. If the env key is set, the request MUST carry `?key=` matching it. A
 *      missing or mismatched key renders an "access denied" screen and DOES
 *      NOT fetch guest data, so probing `/admin/rsvps` without the key cannot
 *      leak confirmations.
 *   3. Only after the key matches does the page call the boundary and render
 *      the summary cards + per-group table.
 *
 * The route is `force-dynamic` because it reads `searchParams.key` (already
 * dynamic since Next 15) and because new RSVPs must appear on every reload
 * without a redeploys — the overview is a live read, not a cached page.
 *
 * `robots: noindex` keeps the admin URL out of search engines regardless of the
 * access gate. The gate is not a substitute for keeping the URL private: the
 * shareable link itself is the password, so mom must share it only with people
 * she trusts.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RSVP overview · Sarahi XV",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ key?: string | string[] }>;
}

export default async function AdminRsvpsPage({ searchParams }: PageProps) {
  const { key } = await searchParams;
  const adminKey = process.env.ADMIN_ACCESS_KEY;

  // Setup-required screen: never fetch guest data while the secret is unset.
  if (!adminKey) {
    return <SetupRequired />;
  }

  // Normalize `key` to a single string. `searchParams.key` can be undefined,
  // a string, or an array (repeated `?key=a&key=b`); only the first value is
  // meaningful for an MVP single-secret scheme.
  const providedKey = Array.isArray(key) ? (key[0] ?? "") : (key ?? "");

  // Access-denied screen: never fetch guest data when the key is missing or
  // wrong. Use a plain `===` check rather than `crypto.timingSafeEqual` — the
  // access URL itself is the secret here, so a timing leak is not meaningfully
  // worse than someone seeing the URL in a referer/messaging log.
  if (!providedKey || providedKey !== adminKey) {
    return <AccessDenied />;
  }

  const groups = await getActiveGuestGroupsWithRsvp();
  return <AdminOverview groups={groups} />;
}

/* -------------------------------------------------------------------------- */
/*  Setup required                                                            */
/* -------------------------------------------------------------------------- */

function SetupRequired() {
  return (
    <AdminShell title="Setup required">
      <p className="max-w-prose">
        The RSVP overview is gated by an <code>ADMIN_ACCESS_KEY</code>{" "}
        environment variable, and it is not set on this deployment.
      </p>
      <p className="mt-4 max-w-prose text-(--color-ink-dim)">
        Set <code>ADMIN_ACCESS_KEY</code> to a long, randomly generated string
        (for example, 32+ characters) in your hosting environment, then open
        <code className="mx-1">/admin/rsvps?key=YOUR_KEY</code>.
      </p>
    </AdminShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Access denied                                                             */
/* -------------------------------------------------------------------------- */

function AccessDenied() {
  return (
    <AdminShell title="Access denied">
      <p className="max-w-prose">
        A <code>key</code> query parameter is required to view this page.
      </p>
      <p className="mt-4 max-w-prose text-(--color-ink-dim)">
        Open the overview with the access key you were given, e.g.
        <code className="mx-1">/admin/rsvps?key=YOUR_KEY</code>. The key is
        intentionally not linked anywhere on the public invitation.
      </p>
    </AdminShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

function AdminOverview({ groups }: { groups: AdminGuestGroup[] }) {
  const summary = computeSummary(groups);

  return (
    <AdminShell title="RSVP overview">
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
    </AdminShell>
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

/* -------------------------------------------------------------------------- */
/*  Admin shell                                                               */
/* -------------------------------------------------------------------------- */

/** Shared page chrome for all admin states (overview, access denied, setup
 *  required). Reuses the project's design tokens so the admin screen reads as
 *  the same product without inheriting the wedding-invitation ceremony. */
function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-5 py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-(--color-gold-soft)">
            Sarahi XV · admin
          </p>
          <h1 className="mt-2 font-serif text-3xl text-(--color-ink) sm:text-4xl">
            {title}
          </h1>
        </div>
      </header>
      {children}
    </main>
  );
}