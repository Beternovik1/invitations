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
  title: "Confirmaciones",
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
      <AdminPageHeader title="Confirmaciones" eyebrow="administrador" />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <SummaryCard
          label="Lugares asignados"
          value={summary.totalAssignedSeats}
          hint="Excluye grupos con lugares por confirmar"
        />
        <SummaryCard
          label="Confirmados"
          value={summary.totalConfirmedAttending}
          hint="Suma de lugares confirmados"
        />
        <SummaryCard
          label="Grupos confirmados"
          value={summary.groupsConfirmed}
          hint={`${groups.length} grupos en total`}
        />
        <SummaryCard
          label="Sin respuesta"
          value={summary.groupsPendingResponse}
          hint="Con lugares, sin confirmar"
        />
        <SummaryCard
          label="Lugares por confirmar"
          value={summary.groupsSeatsPending}
          hint="Lugares sin asignar todavía"
        />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-serif text-xl text-(--color-ink) md:hidden">
          Todos los grupos
        </h2>
        <GroupList groups={groups} />
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
    <div className="leaf-panel rounded-2xl p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-(--color-gold-soft)">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl text-(--color-ink) sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-(--color-ink-dim)">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-group list (desktop table + mobile cards)                            */
/* -------------------------------------------------------------------------- */

const STATUS_LABELS: Record<RsvpStatus, string> = {
  confirmed: "Confirmado",
  no_response: "Sin respuesta",
  seats_pending: "Lugares por confirmar",
};

const STATUS_TONE: Record<RsvpStatus, string> = {
  confirmed:
    "bg-(--color-sage)/40 text-(--color-ink) border-(--color-dusty-teal)/40",
  no_response:
    "bg-(--color-pale-yellow-green)/40 text-(--color-ink-dim) border-(--color-gold)/35",
  seats_pending:
    "bg-(--color-glass) text-(--color-ink-dim) border-(--color-glass-border)",
};

function GroupList({ groups }: { groups: AdminGuestGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-5 py-8 text-(--color-ink-dim)">
        No se encontraron grupos de invitados activos.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: the original dense table, untouched. Hidden below `md`
          where the horizontal density would force a sideways scroll; the
          card list below takes over so the host scrolls vertically. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-(--color-glass-border) bg-(--color-glass) md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-(--color-glass-border) text-xs uppercase tracking-[0.16em] text-(--color-gold-soft)">
              <th scope="col" className="p-4 font-medium">Grupo</th>
              <th scope="col" className="p-4 font-medium">Identificador</th>
              <th scope="col" className="p-4 font-medium">Lugares</th>
              <th scope="col" className="p-4 font-medium">Estado</th>
              <th scope="col" className="p-4 font-medium">Asistentes</th>
              <th scope="col" className="p-4 font-medium">Mensaje</th>
              <th scope="col" className="p-4 font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRow key={group.slug} group={group} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / small screens: a scan-friendly card stack. Same data,
          same status math (`rsvpStatusFor`), same labels/tones — rendered as
          panels so every field fits the viewport and the host scrolls
          straight down on her phone. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {groups.map((group) => (
          <li key={group.slug}>
            <GroupCard group={group} />
          </li>
        ))}
      </ul>
    </>
  );
}

function GroupCard({ group }: { group: AdminGuestGroup }) {
  const status = rsvpStatusFor(group);
  const seatsLabel =
    group.assignedSeats == null
      ? group.seatsNote ?? "Por confirmar"
      : String(group.assignedSeats);
  const updatedAt = group.rsvp ? formatDate(group.rsvp.updatedAt) : null;
  const attending = group.rsvp ? group.rsvp.attendingCount : null;

  return (
    <article className="leaf-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-(--color-ink)">
            {group.displayName}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[0.7rem] text-(--color-ink-dim)">
            {group.slug}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs ${STATUS_TONE[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Lugares
          </dt>
          <dd className="mt-1 text-(--color-ink)">{seatsLabel}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Asistentes
          </dt>
          <dd className="mt-1 text-(--color-ink)">{attending ?? "—"}</dd>
        </div>
      </dl>

      {group.rsvp && group.rsvp.message ? (
        <p className="mt-3 line-clamp-3 italic text-(--color-ink-dim)">
          {group.rsvp.message}
        </p>
      ) : null}

      <p className="mt-3 border-t border-(--color-glass-border) pt-3 text-xs text-(--color-ink-dim)">
        <span className="text-[0.65rem] uppercase tracking-[0.16em]">
          Actualizado
        </span>{" "}
        {updatedAt ?? "—"}
      </p>
    </article>
  );
}

function GroupRow({ group }: { group: AdminGuestGroup }) {
  const status = rsvpStatusFor(group);
  const seatsLabel =
    group.assignedSeats == null
      ? group.seatsNote ?? "Por confirmar"
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
