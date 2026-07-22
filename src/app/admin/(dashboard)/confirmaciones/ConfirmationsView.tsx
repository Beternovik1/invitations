"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateGuestGroupAction } from "@/app/admin/(dashboard)/guest-groups/actions";
import {
  INITIAL_GUEST_GROUP_FORM_STATE,
  MAX_DISPLAY_NAME_LENGTH,
  type GuestGroupFormState,
} from "@/lib/admin-guest-groups-shared";
import {
  CONFIRMATION_FILTER_OPTIONS,
  CONFIRMATION_SORT_OPTIONS,
  CONFIRMATION_STATUS_LABELS,
  CONFIRMATION_STATUS_TONE,
  filterConfirmations,
  confirmationStatusFor,
  matchesQuery,
  sortConfirmations,
  type ConfirmationFilterKey,
  type ConfirmationSortKey,
} from "@/lib/admin-confirmations-shared";
import type { AdminGuestGroup } from "@/lib/admin-overview";

/**
 * Unified Confirmaciones client view — search, sort, one card per
 * family/group with a copy-link action, a manual "Enviada" toggle, and an
 * inline `Modificar` panel for each card.
 *
 * Why a client component: the interactivity the host asked for (instant
 * search, sort dropdown, copy-to-clipboard, a per-card sent toggle, and the
 * `Modificar` panels) only exists in the browser, so this is a `"use client"`
 * component receiving ALREADY-LOADED data from the Server Component page. No
 * service role, no Supabase URL, no fetch — the page did the read on the
 * server and passed plain serializable props. The copy action composes
 * `window.location.origin` with the safe path (`/i/[slug]`) the page
 * computed, so the absolute invitation URL the host copies is built
 * client-side from the page origin plus a non-secret path. The `Modificar`
 * panel posts to the SAME `updateGuestGroupAction` the
 * `/admin/guest-groups` editor uses, so no Supabase client logic is duplicated
 * in the browser and no service-role key is ever shipped to the client.
 *
 * "Enviada" toggle: there is NO `sent`/`sent_at` column on `guest_groups` or
 * `rsvps` in the current schema (see `supabase/migrations/`), so this slice
 * does NOT persist the toggle. Per the host's instruction, we keep the UI
 * placeholder honest: the toggle is per-session local state with a clear
 * helper line ("solo en esta sesión") and the action item for persistence (a
 * migration adding a `sent_at`/`sent` column) is reported back, not silently
 * invented.
 *
 * "Modificar": this slice adds UPDATE-only editing of `displayName` and
 * `assignedSeats` per card. It is NOT a create/delete flow. The shared action
 * revalidates `/admin/confirmaciones` on success so the card's stats/status
 * badge refresh from persisted data; clearing `assignedSeats` therefore
 * naturally flips the card to "Sin lugares" and disables copy (driven by the
 * post-save data, not by local state).
 */
export default function ConfirmationsView({
  groups,
}: {
  groups: AdminGuestGroup[];
}) {
  const searchId = useId();
  const sortId = useId();
  const filterId = useId();

  // Reuse the SAME guest-group update Server Action the
  // `/admin/guest-groups` editor uses — this keeps the service-role key and all
  // Supabase access on the server (the action re-verifies auth before writing)
  // and avoids forking a second mutation surface. The action's `slug`-keyed
  // `GuestGroupFormState` is fanned back out here so only the card whose hidden
  // `slug` matches shows the success/error feedback.
  const [formState, formAction] = useActionState(
    updateGuestGroupAction,
    INITIAL_GUEST_GROUP_FORM_STATE
  );

  // Only one card is editable at a time. `null` means no card is in edit mode;
  // a slug means that card is showing its inline `Modificar` panel. We keep
  // this on the client (not in the URL) because editing is a transient action,
  // not a shareable view.
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  // Default sort is A-Z: the old vague "Estado" sort was replaced by the
  // explicit status filter below, so the dropdown no longer hides a hidden
  // status ordering behind an opaque label.
  const [sortKey, setSortKey] = useState<ConfirmationSortKey>("az");
  const [filterKey, setFilterKey] = useState<ConfirmationFilterKey>("todos");

  // Per-session only. NOT persisted: reset on reload and invisible to other
  // devices. See the helper copy on each card.
  const [sentSlugs, setSentSlugs] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const byStatus = filterConfirmations(groups, filterKey, sentSlugs);
    const trimmed = query.trim();
    const searched =
      trimmed.length === 0
        ? byStatus
        : byStatus.filter((group) =>
            matchesQuery(query, [group.displayName, group.slug])
          );
    return sortConfirmations(searched, sortKey);
  }, [groups, query, sortKey, filterKey, sentSlugs]);

  const summary = useMemo(() => computeSummary(groups), [groups]);
  // `Enviados` is the only insight that is NOT backed by the read-only data
  // boundary: the schema has no `sent` column, so this number is whatever the
  // host marked as sent *in this tab*. The card says so explicitly.
  const enviadosCount = sentSlugs.size;
  const selectedFilterLabel =
    CONFIRMATION_FILTER_OPTIONS.find((option) => option.value === filterKey)
      ?.label ?? "Todos";

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-5 py-8 text-(--color-ink-dim)">
        No se encontraron grupos de invitados activos.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top insights — the six numbers that drive the host's confirmations
          loop. All but `Enviados` come from the read-only data boundary; the
          session-local count is shown honestly with its helper copy. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
        <SummaryCard
          label="Lugares asignados"
          value={summary.totalAssignedSeats}
        />
        <SummaryCard
          label="Invitados confirmados"
          value={summary.totalConfirmedAttending}
        />
        <SummaryCard
          label="Invitaciones confirmadas"
          value={summary.groupsConfirmados}
        />
        <SummaryCard
          label="Invitaciones sin respuesta"
          value={summary.groupsSinRespuesta}
        />
        <SummaryCard
          label="Invitaciones enviadas"
          value={enviadosCount}
          hint="solo en esta sesión"
        />
        <SummaryCard
          label="Invitaciones sin lugares asignados"
          value={summary.groupsSinLugares}
        />
      </div>

      {/* Search + status filter + sort — after the insights, per the host's
          request. The status filter replaces the old vague "Estado" sort. */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label htmlFor={searchId} className="block">
          <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Buscar
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o identificador"
            autoComplete="off"
            className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-4 py-2.5 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
          />
        </label>
        <label htmlFor={filterId} className="block">
          <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Estado
          </span>
          <select
            id={filterId}
            value={filterKey}
            onChange={(event) =>
              setFilterKey(event.target.value as ConfirmationFilterKey)
            }
            className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-4 py-2.5 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60 sm:w-auto"
          >
            {CONFIRMATION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={sortId} className="block">
          <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Ordenar por
          </span>
          <select
            id={sortId}
            value={sortKey}
            onChange={(event) =>
              setSortKey(event.target.value as ConfirmationSortKey)
            }
            className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-4 py-2.5 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60 sm:w-auto"
          >
            {CONFIRMATION_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-4 py-5 text-sm text-(--color-ink-dim)">
          {filterKey === "todos"
            ? `No hay invitaciones que coincidan con “${query}”.`
            : `No hay invitaciones que coincidan con estado: ${selectedFilterLabel}.`}
        </p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((group) => (
            <li key={group.slug}>
              <ConfirmationCard
                group={group}
                sent={sentSlugs.has(group.slug)}
                onToggleSent={() =>
                  setSentSlugs((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.slug)) next.delete(group.slug);
                    else next.add(group.slug);
                    return next;
                  })
                }
                isEditing={editingSlug === group.slug}
                onToggleEdit={(next) =>
                  setEditingSlug(next ? group.slug : null)
                }
                formState={formState}
                formAction={formAction}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                     */
/* -------------------------------------------------------------------------- */

interface ConfirmationsSummary {
  totalAssignedSeats: number;
  totalConfirmedAttending: number;
  groupsConfirmados: number;
  groupsSinRespuesta: number;
  groupsSinLugares: number;
}

function computeSummary(groups: AdminGuestGroup[]): ConfirmationsSummary {
  let totalAssignedSeats = 0;
  let totalConfirmedAttending = 0;
  let groupsConfirmados = 0;
  let groupsSinRespuesta = 0;
  let groupsSinLugares = 0;

  for (const group of groups) {
    const status = confirmationStatusFor(group);
    if (status === "sin_lugares") {
      groupsSinLugares += 1;
      continue;
    }
    if (group.assignedSeats != null) {
      totalAssignedSeats += group.assignedSeats;
    }
    if (status === "confirmado") {
      groupsConfirmados += 1;
      totalConfirmedAttending += group.rsvp?.attendingCount ?? 0;
    } else if (status === "sin_respuesta") {
      groupsSinRespuesta += 1;
    }
    // `sin_asistencia` (RSVP row with 0 attending) is intentionally NOT counted
    // under "Sin respuesta" — it is answered, just declining — so it stays out
    // of all three group counts and only contributes its assigned seats.
  }

  return {
    totalAssignedSeats,
    totalConfirmedAttending,
    groupsConfirmados,
    groupsSinRespuesta,
    groupsSinLugares,
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
    <div className="leaf-panel rounded-2xl p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-(--color-ink)">{value}</p>
      {hint ? (
        <p className="mt-1 text-[0.6rem] uppercase tracking-[0.12em] text-(--color-ink-soft)">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                        */
/* -------------------------------------------------------------------------- */

function ConfirmationCard({
  group,
  sent,
  onToggleSent,
  isEditing,
  onToggleEdit,
  formState,
  formAction,
}: {
  group: AdminGuestGroup;
  sent: boolean;
  onToggleSent: () => void;
  isEditing: boolean;
  onToggleEdit: (next: boolean) => void;
  formState: GuestGroupFormState;
  formAction: (payload: FormData) => void;
}) {
  const status = confirmationStatusFor(group);
  const hasAssignedSeats = group.assignedSeats != null;
  const invitationPath = `/i/${group.slug}`;
  const confirmedLabel = hasAssignedSeats
    ? `${group.rsvp?.attendingCount ?? 0} de ${group.assignedSeats}`
    : "—";

  return (
    <article className="leaf-panel rounded-2xl p-4 sm:p-5">
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
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs ${CONFIRMATION_STATUS_TONE[status]}`}
        >
          {CONFIRMATION_STATUS_LABELS[status]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Lugares asignados
          </dt>
          <dd className="mt-1 text-(--color-ink)">
            {hasAssignedSeats ? group.assignedSeats : "Por asignar"}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
            Lugares confirmados
          </dt>
          <dd className="mt-1 text-(--color-ink)">{confirmedLabel}</dd>
        </div>
      </dl>

      {/* Copy + Enviada + Modificar actions. The copy button is the host's
          whole point here; the sent-state toggle is a placeholder until a
          migration adds the column; `Modificar` opens the inline edit panel
          below for this card only. All three are kept in the same row on
          phones. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-(--color-glass-border) pt-4">
        <CopyLinkButton path={invitationPath} disabled={!hasAssignedSeats} />

        <button
          type="button"
          onClick={() => onToggleEdit(true)}
          disabled={isEditing}
          aria-disabled={isEditing || undefined}
          className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-3 py-2 text-xs uppercase tracking-[0.14em] text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
        >
          Modificar
        </button>

        <SentToggle
          sent={sent}
          disabled={!hasAssignedSeats}
          onToggle={onToggleSent}
        />
      </div>

      {!hasAssignedSeats ? (
        <p className="mt-2 text-xs text-(--color-ink-soft)">
          Asigna lugares primero
        </p>
      ) : (
        <p className="mt-2 text-xs text-(--color-ink-soft)">
          El estado &ldquo;Enviada&rdquo; es solo visible en esta sesión.
          Para guardarlo se necesita una migración de base de datos.
        </p>
      )}

      {/* Inline `Modificar` panel. Only the card whose `editingSlug` matches
          renders this; every other card stays collapsed. The form reuses the
          shared guest-group Server Action, so only `displayName` and
          `assignedSeats` are editable here — the rest of the row's fields are
          carried as hidden inputs so the shared action does not wipe them:
            - `isActive` is sent as "on" so the invitation link stays enabled
              (this page only lists active groups, so preserving "on" is always
              correct and avoids accidentally disabling someone's link).
            - `seatsNote` is sent back as-is so a host's existing note survives
              a name/seats edit from this screen. */}
      {isEditing ? (
        <ModifyPanel
          group={group}
          formState={formState}
          formAction={formAction}
          onCancel={() => onToggleEdit(false)}
        />
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline modify panel                                                        */
/* -------------------------------------------------------------------------- */

function ModifyPanel({
  group,
  formState,
  formAction,
  onCancel,
}: {
  group: AdminGuestGroup;
  formState: GuestGroupFormState;
  formAction: (payload: FormData) => void;
  onCancel: () => void;
}) {
  // Only the card whose slug matches the action's returned state shows
  // success/error feedback; every other open panel stays idle.
  const feedback = formState.slug === group.slug ? formState : null;
  const hasError = feedback?.status === "error";
  const fieldErrors = hasError ? feedback.error.fields : undefined;

  return (
    <form action={formAction} className="mt-4 space-y-4 border-t border-(--color-glass-border) pt-4">
      <input type="hidden" name="slug" value={group.slug} />
      {/* Preserve fields this panel does NOT expose, so the shared action does
          not nullify them. See the ConfirmationCard comment for the why. */}
      <input type="hidden" name="isActive" value="on" />
      <input
        type="hidden"
        name="seatsNote"
        value={group.seatsNote ?? ""}
      />

      <label className="block">
        <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
          Nombre del grupo
        </span>
        <input
          name="displayName"
          defaultValue={group.displayName}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          required
          className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
        />
        {fieldErrors?.displayName ? (
          <span className="mt-1 block text-xs text-red-700">
            {fieldErrors.displayName}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
          Lugares asignados
        </span>
        <input
          name="assignedSeats"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          defaultValue={group.assignedSeats ?? ""}
          placeholder="Por confirmar"
          className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
        />
        {fieldErrors?.assignedSeats ? (
          <span className="mt-1 block text-xs text-red-700">
            {fieldErrors.assignedSeats}
          </span>
        ) : null}
      </label>

      {feedback?.status === "success" ? (
        <p className="rounded-xl border border-(--color-dusty-teal)/35 bg-(--color-sage)/35 px-3 py-2 text-sm text-(--color-ink)">
          Guardado.
        </p>
      ) : null}

      {hasError ? (
        <p className="rounded-xl border border-(--color-gold)/40 bg-(--color-pale-yellow-green)/35 px-3 py-2 text-sm text-(--color-ink)">
          {feedback.error.message}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-(--color-glass-border) bg-(--color-glass) px-3 py-2 text-xs uppercase tracking-[0.14em] text-(--color-ink-dim) transition hover:border-(--color-ink-dim)"
        >
          Cancelar
        </button>
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-4 py-2 text-xs uppercase tracking-[0.16em] text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Copy link                                                                   */
/* -------------------------------------------------------------------------- */

function CopyLinkButton({
  path,
  disabled,
}: {
  path: string;
  disabled: boolean;
}) {
  const [label, setLabel] = useState("Copiar");

  async function copyLink() {
    if (disabled) return;
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setLabel("Link copiado en el portapapeles");
      window.setTimeout(() => setLabel("Copiar"), 1800);
    } catch {
      setLabel("No se pudo copiar");
      window.setTimeout(() => setLabel("Copiar"), 2200);
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-3 py-2 text-xs uppercase tracking-[0.14em] text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sent toggle (iPhone-style switch)                                          */
/* -------------------------------------------------------------------------- */

/* Manual "Enviada" per-card toggle. Non-persistent: the schema has no
   `sent`/`sent_at` column, so flipping it only updates the per-session
   `sentSlugs` state the parent owns. The accessible label stays Spanish
   ("Enviada") and the switch exposes `role="switch"` / `aria-checked` to
   assistive tech. The visual is an iPhone-like track with a circular knob:
   off = light/neutral track, on = green track; the knob always slides. */
function SentToggle({
  sent,
  disabled,
  onToggle,
}: {
  sent: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={sent}
        aria-label="Enviada"
        onClick={onToggle}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-gold)/60 disabled:cursor-not-allowed disabled:opacity-50 " +
          (sent
            ? "border-green-600 bg-green-600"
            : "border-(--color-glass-border) bg-white/70")
        }
      >
        <span
          aria-hidden="true"
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 " +
            (sent ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
      <span className="text-sm text-(--color-ink-dim)">Enviada</span>
    </div>
  );
}
