"use client";

import { useActionState, useId, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  createGuestGroupAction,
  deleteGuestGroupAction,
  toggleGuestGroupSentAction,
  updateGuestGroupAction,
} from "@/app/admin/(dashboard)/guest-groups/actions";
import {
  INITIAL_GUEST_GROUP_CREATE_FORM_STATE,
  INITIAL_GUEST_GROUP_DELETE_FORM_STATE,
  INITIAL_GUEST_GROUP_FORM_STATE,
  MAX_ASSIGNED_SEATS,
  MAX_DISPLAY_NAME_LENGTH,
  slugifyGuestGroupName,
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
 * panel posts to the shared `updateGuestGroupAction`, so no Supabase client
 * logic is duplicated in the browser and no service-role key is ever shipped to
 * the client.
 *
 * "Enviada" toggle: persisted by migration 0005 via `guest_groups.sent_at`.
 * The switch calls a Server Action that re-verifies admin auth and PATCHes only
 * `sent_at`; the summary, filter, and status badge all read the server-loaded
 * value so the state survives reloads/devices.
 *
 * "Modificar": this slice adds UPDATE editing of `displayName` and
 * `assignedSeats` per card, plus an inline `Eliminar` control at the bottom
 * of the panel that soft-deletes the row (`is_active = false`) through a
 * dedicated delete action with a two-step confirmation. The shared update
 * action revalidates `/admin/confirmaciones` on success so the card's
 * stats/status badge refresh from persisted data; clearing `assignedSeats`
 * therefore naturally flips the card to "Sin lugares" and disables copy
 * (driven by the post-save data, not by local state). The delete action also
 * revalidates the unified list, so on success the card simply disappears from
 * `/admin/confirmaciones` (the data boundary lists
 * active groups only) while staying reactivate-able later via
 * `Nueva invitación`.
 */
export default function ConfirmationsView({
  groups,
}: {
  groups: AdminGuestGroup[];
}) {
  const searchId = useId();
  const sortId = useId();
  const filterId = useId();

  // Reuse the shared guest-group update Server Action — this keeps the
  // service-role key and all Supabase access on the server (the action
  // re-verifies auth before writing) and avoids forking a second mutation
  // surface. The action's `slug`-keyed
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

  // `Nueva invitación` panel. Only one is open at a time. `null` means the
  // panel is closed; a number is a mount nonce so each open starts a fresh
  // `useActionState` instance (inside `NewInvitationPanel`) instead of
  // showing the previous submit's stale success/error state. Toggling closed
  // unmounts the panel, so the next open initializes from
  // `INITIAL_GUEST_GROUP_CREATE_FORM_STATE`.
  const [createOpenNonce, setCreateOpenNonce] = useState<number | null>(null);

  const visible = useMemo(() => {
    const byStatus = filterConfirmations(groups, filterKey);
    const trimmed = query.trim();
    const searched =
      trimmed.length === 0
        ? byStatus
        : byStatus.filter((group) =>
            matchesQuery(query, [group.displayName, group.slug])
          );
    return sortConfirmations(searched, sortKey);
  }, [groups, query, sortKey, filterKey]);

  const summary = useMemo(() => computeSummary(groups), [groups]);
  const enviadosCount = summary.groupsEnviados;
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
      {/* Top insights — the host's confirmations loop. `Invitaciones totales`
          is the headline number (how many active invitation/group cards the
          data boundary returns), shown as a bigger first card above the six
          supporting metrics so the host sees the size of the list at a glance.
          All metrics come from the server-loaded data boundary, including
          persisted `sent_at` for `Invitaciones enviadas`. */}
      <div className="rounded-[1.75rem] border border-(--color-admin-border) bg-white/50 p-3 shadow-[0_18px_40px_rgba(36,48,68,0.08)] sm:p-4">
        <HeroSummaryCard
          label="Invitaciones totales"
          value={summary.totalGroups}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
          />
          <SummaryCard
            label="Invitaciones sin lugares asignados"
            value={summary.groupsSinLugares}
          />
        </div>
      </div>

      {/* Search + status filter + sort — after the insights, per the host's
          request. The status filter replaces the old vague "Estado" sort. */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label htmlFor={searchId} className="block">
          <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
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
          <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
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
          <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
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

      {/* `Nueva invitación`: a normal rounded button (no floating plus) below
          the search/filter area. Clicking opens an inline card form for a new
          family invitation. Deliberately placed after the filter row so the
          host can still see search/filter while the panel is open below. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            setCreateOpenNonce((prev) => (prev ?? 0) + 1)
          }
          aria-expanded={createOpenNonce !== null}
          aria-controls="new-invitation-panel"
          className="rounded-xl border border-(--color-dusty-teal)/45 bg-(--color-sage)/35 px-4 py-2 text-sm font-medium text-(--color-ink) transition hover:border-(--color-dusty-teal)"
        >
          + Nueva invitación
        </button>
      </div>

      {createOpenNonce !== null ? (
        <NewInvitationPanel
          key={createOpenNonce}
          onClose={() => setCreateOpenNonce(null)}
          onReset={() =>
            setCreateOpenNonce((prev) => (prev ?? 0) + 1)
          }
        />
      ) : null}

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
  totalGroups: number;
  totalAssignedSeats: number;
  totalConfirmedAttending: number;
  groupsConfirmados: number;
  groupsEnviados: number;
  groupsSinRespuesta: number;
  groupsSinLugares: number;
}

function computeSummary(groups: AdminGuestGroup[]): ConfirmationsSummary {
  const totalGroups = groups.length;
  let totalAssignedSeats = 0;
  let totalConfirmedAttending = 0;
  let groupsConfirmados = 0;
  let groupsEnviados = 0;
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
    } else if (status === "enviada") {
      groupsEnviados += 1;
    } else if (status === "sin_respuesta") {
      groupsSinRespuesta += 1;
    }
    // `sin_asistencia` (RSVP row with 0 attending) is intentionally NOT counted
    // under "Sin respuesta" — it is answered, just declining — so it stays out
    // of all three group counts and only contributes its assigned seats.
  }

  return {
    totalGroups,
    totalAssignedSeats,
    totalConfirmedAttending,
    groupsConfirmados,
    groupsEnviados,
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
    <div className="rounded-2xl border border-(--color-admin-border) bg-white/60 p-3.5 sm:p-4">
      <p className="text-xs font-medium leading-snug text-(--color-ink-dim)">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-(--color-ink)">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-(--color-ink-soft)">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* The headline insight. `Invitaciones totales` is shown as a bigger first
   summary card above the six supporting metrics so the host reads the size of
   the active invitation list before drilling into the per-state breakdown. It
   counts every card the read-only data boundary returns (active guest groups),
   so empty / no-RSP / confirmed / declined all count toward the total — the
   number answers "how many invitations am I managing?", not "how many
   responded". Kept visually distinct from the small cards via a larger
   numeral, wider padding, and a white admin surface inside the metrics module. */
function HeroSummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.35rem] border border-(--color-admin-border) bg-white px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-(--color-ink-dim)">
            {label}
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-[-0.055em] text-(--color-ink) sm:text-6xl">
            {value}
          </p>
        </div>
        <p className="max-w-[8rem] pb-1 text-right text-xs leading-snug text-(--color-ink-soft)">
          Familias activas en el panel
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                        */
/* -------------------------------------------------------------------------- */

function ConfirmationCard({
  group,
  isEditing,
  onToggleEdit,
  formState,
  formAction,
}: {
  group: AdminGuestGroup;
  isEditing: boolean;
  onToggleEdit: (next: boolean) => void;
  formState: GuestGroupFormState;
  formAction: (payload: FormData) => void;
}) {
  const status = confirmationStatusFor(group);
  const hasAssignedSeats = group.assignedSeats != null;
  const sent = group.sentAt != null;
  const invitationPath = `/i/${group.slug}`;
  const confirmedLabel = hasAssignedSeats
    ? `${group.rsvp?.attendingCount ?? 0} de ${group.assignedSeats}`
    : "—";

  return (
    <article className="leaf-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
            {group.displayName}
          </h3>
          <p className="mt-0.5 truncate text-xs text-(--color-ink-dim)">
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
          <dt className="text-xs font-medium text-(--color-ink-dim)">
            Lugares asignados
          </dt>
          <dd className="mt-1 text-(--color-ink)">
            {hasAssignedSeats ? group.assignedSeats : "Por asignar"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-(--color-ink-dim)">
            Lugares confirmados
          </dt>
          <dd className="mt-1 text-(--color-ink)">{confirmedLabel}</dd>
        </div>
      </dl>

      {/* Copy + Enviada + Modificar actions. The copy button is the host's
          whole point here; the sent-state toggle persists `sent_at` through a
          Server Action; `Modificar` opens the inline edit panel below for this
          card only. All three are kept in the same row on phones. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-(--color-glass-border) pt-4">
        <CopyLinkButton path={invitationPath} disabled={!hasAssignedSeats} />

        <button
          type="button"
          onClick={() => onToggleEdit(true)}
          disabled={isEditing}
          aria-disabled={isEditing || undefined}
          className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-3 py-2 text-sm font-medium text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
        >
          Modificar
        </button>

        <SentToggle
          slug={group.slug}
          sent={sent}
          disabled={!hasAssignedSeats}
        />
      </div>

      {!hasAssignedSeats ? (
        <p className="mt-2 text-xs text-(--color-ink-soft)">
          Asigna lugares primero
        </p>
      ) : (
        <p className="mt-2 text-xs text-(--color-ink-soft)">
          Marca &ldquo;Enviada&rdquo; cuando ya mandaste el enlace por WhatsApp.
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
    <>
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
        <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
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
        <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
          Lugares asignados
        </span>
        <input
          name="assignedSeats"
          type="number"
          min="0"
          max={MAX_ASSIGNED_SEATS}
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
          className="rounded-xl border border-(--color-glass-border) bg-(--color-glass) px-3 py-2 text-sm font-medium text-(--color-ink-dim) transition hover:border-(--color-ink-dim)"
        >
          Cancelar
        </button>
        <SaveButton />
      </div>
    </form>

    {/* `Eliminar`: a separate delete form below the inline update form. It is
        its own <form> so submitting it never also submits the update fields.
        The host-facing control says "Eliminar"(remove), not "soft-delete".
        A two-step confirmation (reveal prompt -> final submit) keeps the
        delete out of reach of a single accidental tap.

        The delete action reuses the SAME guest-groups actions module, so no
        client-side Supabase and no service-role env name leaks. The action
        soft-deletes (`is_active = false`), so `Nueva invitación` can bring the
        link back later. On success `revalidatePath` refreshes the active list,
        so this card simply disappears from the unified page on the next
        render. */}
    <DeleteControl group={group} onCancel={onCancel} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline delete (soft-delete) control                                        */
/* -------------------------------------------------------------------------- */

/* `Eliminar` confirmation flow, rendered at the bottom of the inline
   `Modificar` panel. The host first taps `Eliminar` to reveal the
   confirmation prompt ("¿Eliminar esta invitación?"), then taps a second
   `Eliminar` button to actually submit. The second button lives inside a
   real <form> whose `action` is the shared delete Server Action, so a stray
   tap on the first `Eliminar` never deletes anything.

   Per the host's instruction, the dad-facing copy says "Eliminar" (delete),
   never "soft-delete": the row's `is_active` flag toggling is the
   implementation, not the vocabulary. The helper line tells the host what
   actually happens (the link stops working and can be reactivated later). */
function DeleteControl({
  group,
  onCancel,
}: {
  group: AdminGuestGroup;
  onCancel: () => void;
}) {
  // The delete form uses its OWN `useActionState` (separate from the update
  // form's), so the two flows never share feedback state on the same card.
  // The panel mounts only when the card is in edit mode, so this hook resets
  // fresh each time the host opens `Modificar`.
  const [deleteState, deleteAction] = useActionState(
    deleteGuestGroupAction,
    INITIAL_GUEST_GROUP_DELETE_FORM_STATE
  );
  const [confirming, setConfirming] = useState(false);
  // Only the card whose slug matches the action's returned state shows
  // delete error feedback; the success branch needs no UI because the card
  // disappears from the active list after `revalidatePath`.
  const deleteFeedback =
    deleteState.slug === group.slug ? deleteState : null;
  const deleteError = deleteFeedback?.status === "error";

  return (
    <div className="mt-4 space-y-3 border-t border-(--color-glass-border) pt-4">
      {confirming ? (
        <form action={deleteAction} className="space-y-3">
          <input type="hidden" name="slug" value={group.slug} />
          <p className="text-sm text-(--color-ink)">
            ¿Eliminar esta invitación?
          </p>
          <p className="text-xs text-(--color-ink-dim)">
            El enlace dejará de funcionar. Podrás reactivarlo después con
            &laquo;Nueva invitación&raquo;.
          </p>
          {deleteError ? (
            <p className="rounded-xl border border-(--color-gold)/40 bg-(--color-pale-yellow-green)/35 px-3 py-2 text-sm text-(--color-ink)">
              {deleteFeedback.error.message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onCancel();
              }}
              className="rounded-xl border border-(--color-glass-border) bg-(--color-glass) px-3 py-2 text-sm font-medium text-(--color-ink-dim) transition hover:border-(--color-ink-dim)"
            >
              Cancelar
            </button>
            <ConfirmDeleteButton />
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-xl border border-red-500/40 bg-red-50/60 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-500"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-red-500/50 bg-red-600/90 px-3 py-2 text-sm font-medium text-white transition hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-4 py-2 text-sm font-medium text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
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
      className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-3 py-2 text-sm font-medium text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sent toggle (iPhone-style switch)                                          */
/* -------------------------------------------------------------------------- */

/* Manual "Enviada" per-card toggle. Persisted via `toggleGuestGroupSentAction`,
   which writes `guest_groups.sent_at` server-side. The accessible label stays
   Spanish ("Enviada") and the switch exposes `role="switch"` / `aria-checked`
   to assistive tech. The visual is an iPhone-like track with a circular knob:
   off = light/neutral track, on = green track; the knob always slides. */
function SentToggle({
  slug,
  sent,
  disabled,
}: {
  slug: string;
  sent: boolean;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    if (disabled || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await toggleGuestGroupSentAction(slug, !sent);
      if (!result.ok) {
        setError(result.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={sent}
        aria-label="Enviada"
        onClick={toggle}
        disabled={disabled || isPending}
        aria-disabled={disabled || isPending || undefined}
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
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  New invitation panel (create or reactivate)                               */
/* -------------------------------------------------------------------------- */

/* `Nueva invitación` inline form. The host types a family/group name and an
   optional seat count; the slug is derived LIVE (client-side preview only)
   from the name via the shared pure `slugifyGuestGroupName` helper, and the
   server recomputes it from the submitted name on the action so a tampered
   preview cannot poison the identifier.

   Lifecycle handled server-side by `createOrReactivateGuestGroupForAdmin`:
     - no row with the derived slug        -> INSERT
     - inactive row with the derived slug  -> reactivate (PATCH is_active=true,
       overwrite display_name + assigned_seats, preserve seats_note)
     - active row with the derived slug    -> `slug_taken` validation error

   This component owns its own `useActionState` so mounting/unmounting it
   (toggled by the parent's `createOpenNonce`) resets the form cleanly. The
   parent keys the panel by the nonce, so "Crear otra" remounts it fresh. */
function NewInvitationPanel({
  onClose,
  onReset,
}: {
  onClose: () => void;
  onReset: () => void;
}) {
  const [formState, formAction] = useActionState(
    createGuestGroupAction,
    INITIAL_GUEST_GROUP_CREATE_FORM_STATE
  );

  // Live preview of the derived `/i/[slug]` identifier. Pure: the boundary
  // recomputes the canonical slug on the server, so this is advisory only.
  const [displayName, setDisplayName] = useState("");
  const previewSlug = slugifyGuestGroupName(displayName);

  return (
    <form
      id="new-invitation-panel"
      action={formAction}
      className="leaf-panel space-y-4 rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
          Nueva invitación
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-full border border-(--color-glass-border) bg-(--color-glass) px-2.5 py-1 text-xs font-medium text-(--color-ink-dim) transition hover:border-(--color-ink-dim)"
        >
          Cerrar
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
          Nombre del grupo
        </span>
        <input
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          required
          autoComplete="off"
          placeholder="Ej. Familia García"
          className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
        />
        {formState.status === "error" &&
        formState.error.fields?.displayName ? (
          <span className="mt-1 block text-xs text-red-700">
            {formState.error.fields.displayName}
          </span>
        ) : null}
      </label>

      {/* Live slug preview. Read-only, advisory: the server recomputes the
          real slug from the submitted name. Empty while the host has not
          typed any letter/digit. */}
      <div className="rounded-xl border border-(--color-glass-border) bg-(--color-glass) px-3 py-2">
        <p className="text-xs font-medium text-(--color-ink-dim)">
          Enlace de invitación
        </p>
        <p className="mt-1 truncate text-xs text-(--color-ink-dim)">
          {previewSlug
            ? `/i/${previewSlug}`
            : "Aparecerá al escribir el nombre."}
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-(--color-ink-dim)">
          Lugares asignados
        </span>
        <input
          name="assignedSeats"
          type="number"
          min="0"
          max={MAX_ASSIGNED_SEATS}
          step="1"
          inputMode="numeric"
          placeholder="Por confirmar"
          className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
        />
        {formState.status === "error" &&
        formState.error.fields?.assignedSeats ? (
          <span className="mt-1 block text-xs text-red-700">
            {formState.error.fields.assignedSeats}
          </span>
        ) : null}
      </label>

      {formState.status === "success" ? (
        <div className="rounded-xl border border-(--color-dusty-teal)/35 bg-(--color-sage)/35 px-3 py-2.5 text-sm text-(--color-ink)">
          <p>Invitación creada. El enlace está listo:</p>
          <p className="mt-1 truncate text-xs text-(--color-ink-dim)">
            {`/i/${formState.slug}`}
          </p>
        </div>
      ) : null}

      {formState.status === "error" ? (
        <p className="rounded-xl border border-(--color-gold)/40 bg-(--color-pale-yellow-green)/35 px-3 py-2 text-sm text-(--color-ink)">
          {formState.error.message}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {formState.status === "success" ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-(--color-dusty-teal)/45 bg-(--color-sage)/35 px-3 py-2 text-sm font-medium text-(--color-ink) transition hover:border-(--color-dusty-teal)"
          >
            Crear otra
          </button>
        ) : null}
        <CreateButton />
      </div>
    </form>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-4 py-2 text-sm font-medium text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creando…" : "Crear invitación"}
    </button>
  );
}
