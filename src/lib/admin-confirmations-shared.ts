/**
 * Runtime-safe shared types and helpers for the unified Confirmaciones admin
 * page (`/admin/confirmaciones`).
 *
 * This module MUST stay free of any server-only or Supabase imports —
 * including a dynamic import of the Supabase server client. The client view
 * (`ConfirmationsView.tsx`) imports runtime values from here (status labels,
 * the match/sort helpers), so pulling the server boundary graph would drag
 * `server-only` into the client bundle and break the build. This mirrors the
 * `rsvps-shared.ts` / `admin-guest-groups-shared.ts` convention.
 *
 * The page reuses the admin-overview data boundary (`getActiveGuestGroupsWithRsvp`),
 * which already returns `AdminGuestGroup` (active group + joined RSVP). This
 * module owns only the status MODEL the new page needs — which is finer-grained
 * than the existing read-only `RsvpStatus`:
 *
 *   - `sin_lugares`    -> assignedSeats == null (cannot RSVP yet)
 *   - `sin_respuesta`  -> assignedSeats != null and rsvp == null
 *   - `confirmado`     -> rsvp != null and attendingCount > 0
 *   - `sin_asistencia` -> rsvp != null and attendingCount === 0
 *
 * The existing `/admin/rsvps` overview collapses the last two into "Confirmado"
 * (any RSVP row counts as confirmed); the new page the host asked for splits
 * "confirmed attending" from "confirmed not attending", so the new helper lives
 * here instead of mutating `rsvpStatusFor` (the old page's contract is pinned
 * by its source-contract tests).
 */

import type { AdminGuestGroup } from "@/lib/admin-overview";

/** Five-state confirmation model for the unified Confirmaciones page.
 *
 *  Status priority (highest first):
 *    1. `sin_lugares`     — `assignedSeats == null`: the row cannot RSVP yet,
 *                            so this dominates everything else (a host cannot
 *                            mark "Enviada" without seats anyway — the toggle
 *                            is disabled on this card).
 *    2. `confirmado`       — `rsvp != null && attendingCount > 0`: the family
 *                            has ANSWERED, so a final state wins over the
 *                            host's internal "I sent it" marker.
 *    3. `sin_asistencia`   — `rsvp != null && attendingCount === 0`: same as
 *                            above, a final declining answer wins over `Sent`.
 *    4. `enviada`          — `sentAt != null && rsvp == null`: the host has
 *                            recorded that the link was sent, but the family
 *                            has not answered yet. This is the intermediate
 *                            "I've done my part, now I wait" state.
 *    5. `sin_respuesta`    — `sentAt == null && rsvp == null`: actionable
 *                            default — seats assigned, no answer, not marked
 *                            sent. The host sees this row as the next one to
 *                            act on.
 *
 *  An RSVP answer is a terminal state and intentionally ranks above
 *  `enviada`: once the family replies, the host no longer cares whether they
 *  had logged "I shared the link"; the answer is the fact that matters now.
 *  The user-approved priority is pinned by the source-contract test in
 *  `tests/admin-confirmations-sent.test.mjs`.
 */
export type ConfirmationStatus =
  | "sin_lugares"
  | "confirmado"
  | "sin_asistencia"
  | "enviada"
  | "sin_respuesta";

/** Spanish UI labels, indexed by status. Kept here so the page and any future
 *  summary helpers share one definition of "what does this card say?". */
export const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  sin_lugares: "Sin lugares",
  sin_respuesta: "Sin respuesta",
  enviada: "Enviada",
  confirmado: "Confirmado",
  sin_asistencia: "Sin asistencia",
};

/** Tailwind tone classes per status. Colors stay semantic for quick scanning,
 *  but use softer admin-dashboard tints so badges sit calmly on white cards. */
export const CONFIRMATION_STATUS_TONE: Record<ConfirmationStatus, string> = {
  sin_lugares:
    "bg-slate-50 text-slate-600 border-slate-200",
  sin_respuesta:
    "bg-amber-50 text-amber-800 border-amber-200",
  enviada:
    "bg-blue-50 text-(--color-admin-navy) border-blue-200",
  confirmado:
    "bg-emerald-50 text-emerald-800 border-emerald-200",
  sin_asistencia:
    "bg-rose-50 text-rose-800 border-rose-200",
};

/** Compute the five-state confirmation status for a group. Kept here (not on
 *  the data boundary) so the client view can call it from a pure function the
 *  source-contract test can import without crossing the server boundary.
 *
 *  See `ConfirmationStatus` for the documented priority. */
export function confirmationStatusFor(
  group: Pick<AdminGuestGroup, "assignedSeats" | "rsvp" | "sentAt">
): ConfirmationStatus {
  if (group.assignedSeats == null) return "sin_lugares";
  if (group.rsvp) {
    return group.rsvp.attendingCount > 0 ? "confirmado" : "sin_asistencia";
  }
  // No RSVP yet: `enviada` if the host marked the link as sent, otherwise the
  // actionable default `sin_respuesta`. Mock mode never populates `sentAt`,
  // so an un-marked row resolves to `sin_respuesta` and the toggle's `unavailable`
  // boundary refuses to fabricate a sent state (see `setGuestGroupSentAtForAdmin`).
  return group.sentAt != null ? "enviada" : "sin_respuesta";
}

/* -------------------------------------------------------------------------- */
/*  Search                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Normalize text for accent-insensitive, case-insensitive contains matching.
 *
 * Strips combining marks via NFD decomposition + the Unicode `Diacritics`
 * property, then lowercases. "Jiménez" -> "jimenez", "Ávila" -> "avila", so a
 * host typing "jimenez" with no accents still finds the accented group.
 *
 * Uses `\p{Diacritics}` (Unicode property escape) which Node 16+ supports in
 * regex literals when the `u` flag is set. Kept pure and dependency-free so the
 * source-contract test can import and exercise it directly.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** True when `query` (normalized) is contained in any normalized target. */
export function matchesQuery(
  query: string,
  targets: ReadonlyArray<string>
): boolean {
  const needle = normalizeForSearch(query.trim());
  if (needle.length === 0) return true;
  return targets.some(
    (target) => normalizeForSearch(target).includes(needle)
  );
}

/* -------------------------------------------------------------------------- */
/*  Sorting                                                                     */
/* -------------------------------------------------------------------------- */

/** Sort keys surfaced to the host. The vague "Estado" sort was removed from
 *  the visible dropdown because it never explained *which* status order the
 *  rows followed; an explicit status filter (`CONFIRMATION_FILTER_OPTIONS`)
 *  replaces it. The `estado` branch of `sortConfirmations` is kept as a pure
 *  internal helper (and stays pinned by its source-contract test) so callers
 *  that want status rank ordering can still reach it. */
export type ConfirmationSortKey = "estado" | "az" | "mas-lugares";

export const CONFIRMATION_SORT_OPTIONS: ReadonlyArray<{
  value: ConfirmationSortKey;
  label: string;
}> = [
  { value: "az", label: "A-Z" },
  { value: "mas-lugares", label: "Más lugares" },
];

/* -------------------------------------------------------------------------- */
/*  Status filter                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Status filter keys surfaced to the host. This is the explicit replacement
 * for the old vague "Ordenar por: Estado" dropdown: instead of a silent
 * sort order that did not name the states, the host now picks a state
 * directly and the list filters down to it.
 *
 * Every state (including `enviada`) now maps 1:1 to the persisted
 * `ConfirmationStatus` and resolves against the server-loaded `sentAt`
 * field — the toggle is persisted via migration 0005, so the filter no
 * longer reads session-only state. `confirmada` is the feminine card label
 * for the underlying `confirmado` status.
 */
export type ConfirmationFilterKey =
  | "todos"
  | "sin_lugares"
  | "sin_respuesta"
  | "enviada"
  | "confirmada"
  | "sin_asistencia";

export const CONFIRMATION_FILTER_OPTIONS: ReadonlyArray<{
  value: ConfirmationFilterKey;
  label: string;
}> = [
  { value: "todos", label: "Todos" },
  { value: "sin_lugares", label: "Sin lugares" },
  { value: "sin_respuesta", label: "Sin respuesta" },
  { value: "enviada", label: "Enviada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "sin_asistencia", label: "Sin asistencia" },
];

/** Maps the feminine UI filter labels to the underlying confirmation status
 *  codes so the filter helper can reuse `confirmationStatusFor`. `todos` is
 *  the only pass-through (handled before this map is consulted). */
const FILTER_TO_STATUS: Partial<
  Record<ConfirmationFilterKey, ConfirmationStatus>
> = {
  sin_lugares: "sin_lugares",
  sin_respuesta: "sin_respuesta",
  enviada: "enviada",
  confirmada: "confirmado",
  sin_asistencia: "sin_asistencia",
};

/**
 * Filter groups by the host's chosen status view. Pure so the source-contract
 * test can import and exercise it directly.
 *
 * Every state (including `enviada`) resolves against the persisted row via
 * `confirmationStatusFor(group)`. The `sentAt` column was added by migration
 * 0005 and is written by `toggleGuestGroupSentAction`, so the `Enviada`
 * filter survives reload and is consistent across devices.
 */
export function filterConfirmations(
  groups: ReadonlyArray<AdminGuestGroup>,
  filter: ConfirmationFilterKey
): AdminGuestGroup[] {
  if (filter === "todos") return [...groups];
  const targetStatus = FILTER_TO_STATUS[filter];
  if (!targetStatus) return [...groups];
  return groups.filter(
    (group) => confirmationStatusFor(group) === targetStatus
  );
}

/** Stable rank for status, used by the "Estado" sort so the host sees the
 *  most actionable rows (Sin lugares, Sin respuesta) first. `enviada` sits
 *  between "not yet answered" and the final answered states so the sort keeps
 *  the host's actionable order without burying the eventual answers. Lower =
 *  first. */
const STATUS_SORT_RANK: Record<ConfirmationStatus, number> = {
  sin_lugares: 0,
  sin_respuesta: 1,
  enviada: 2,
  sin_asistencia: 3,
  confirmado: 4,
};

/** Sort a copy of the groups by the chosen key. Returns a new array; does not
 *  mutate the input. Pure so the test can import and exercise it directly. */
export function sortConfirmations(
  groups: ReadonlyArray<AdminGuestGroup>,
  key: ConfirmationSortKey
): AdminGuestGroup[] {
  const copy = [...groups];
  switch (key) {
    case "az":
      copy.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "es", {
          sensitivity: "base",
        })
      );
      break;
    case "mas-lugares":
      // Descending by assigned seats; pending (null) sorts last. Tiebreak by
      // display name so equal-seat groups stay in a stable order.
      copy.sort((a, b) => {
        const aSeats = a.assignedSeats ?? -1;
        const bSeats = b.assignedSeats ?? -1;
        if (aSeats !== bSeats) return bSeats - aSeats;
        return a.displayName.localeCompare(b.displayName, "es", {
          sensitivity: "base",
        });
      });
      break;
    case "estado":
    default:
      copy.sort((a, b) => {
        const aRank = STATUS_SORT_RANK[confirmationStatusFor(a)];
        const bRank = STATUS_SORT_RANK[confirmationStatusFor(b)];
        if (aRank !== bRank) return aRank - bRank;
        return a.displayName.localeCompare(b.displayName, "es", {
          sensitivity: "base",
        });
      });
      break;
  }
  return copy;
}
