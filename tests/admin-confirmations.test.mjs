// Deterministic source-contract tests for the unified Confirmaciones admin page.
//
// The repo's established test style (see `rsvp-section.test.mjs` and
// `admin-guest-groups-grant.test.mjs`) is deterministic source-contract tests:
// read source files from disk and assert externally-visible facts with
// `node:assert`. No network, no DB, no render — only `node:test` and
// `node:assert`, which ship with Node and need no deps.
//
// These tests pin down the static contract reviewers care about for the new
// `/admin/confirmaciones` page: it reuses the read-only data boundary (no new
// server fetch), exposes the four-state confirmation model the host asked for,
// shows search + sort, has a `Copiar` button with the disabled state and helper
// text for groups without seats, copies with the Spanish success message, and
// persists the `Enviada` state through the server-loaded `sentAt` field. The
// accent-insensitive match helper is also exercised directly since it is a pure
// runtime-safe function exported from the shared module.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CONFIRMATION_FILTER_OPTIONS,
  CONFIRMATION_SORT_OPTIONS,
  CONFIRMATION_STATUS_LABELS,
  filterConfirmations,
  confirmationStatusFor,
  matchesQuery,
  normalizeForSearch,
  sortConfirmations,
} from "../src/lib/admin-confirmations-shared.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const PAGE = "src/app/admin/(dashboard)/confirmaciones/page.tsx";
const VIEW = "src/app/admin/(dashboard)/confirmaciones/ConfirmationsView.tsx";
const SHARED = "src/lib/admin-confirmations-shared.ts";
const OVERVIEW_BOUNDARY = "src/lib/admin-overview.ts";
const ACTION = "src/app/admin/(dashboard)/guest-groups/actions.ts";

/* Helpers copied from the runtime types so the tests stay self-contained. */
const group = (overrides) => ({
  slug: "alfaro-padilla",
  displayName: "Alfaro Padilla",
  assignedSeats: 5,
  seatsNote: undefined,
  isActive: true,
  rsvp: null,
  ...overrides,
});

/* -------------------------------------------------------------------------- */
/*  Status model                                                                */
/* -------------------------------------------------------------------------- */

test("confirmationStatusFor: four states per the host's spec", () => {
  assert.equal(
    confirmationStatusFor(group({ assignedSeats: null, rsvp: null })),
    "sin_lugares",
    "no assigned seats => sin_lugares"
  );
  assert.equal(
    confirmationStatusFor(group({ assignedSeats: 4, rsvp: null })),
    "sin_respuesta",
    "assigned seats but no RSVP => sin_respuesta"
  );
  assert.equal(
    confirmationStatusFor(
      group({ assignedSeats: 4, rsvp: { attendingCount: 3 } })
    ),
    "confirmado",
    "RSVP with attendingCount > 0 => confirmado"
  );
  assert.equal(
    confirmationStatusFor(
      group({ assignedSeats: 4, rsvp: { attendingCount: 0 } })
    ),
    "sin_asistencia",
    "RSVP with attendingCount === 0 => sin_asistencia"
  );
});

test("status labels match the Spanish UI copy the host approved", () => {
  assert.equal(CONFIRMATION_STATUS_LABELS.sin_lugares, "Sin lugares");
  assert.equal(CONFIRMATION_STATUS_LABELS.sin_respuesta, "Sin respuesta");
  assert.equal(CONFIRMATION_STATUS_LABELS.confirmado, "Confirmado");
  assert.equal(CONFIRMATION_STATUS_LABELS.sin_asistencia, "Sin asistencia");
});

/* -------------------------------------------------------------------------- */
/*  Search (accent- and case-insensitive)                                      */
/* -------------------------------------------------------------------------- */

test("normalizeForSearch strips diacritics from accented names", () => {
  assert.equal(normalizeForSearch("Jiménez"), "jimenez");
  assert.equal(normalizeForSearch("Ávila Hernández"), "avila hernandez");
  assert.equal(normalizeForSearch("García"), "garcia");
  assert.equal(normalizeForSearch("Ma. de Jesús"), "ma. de jesus");
});

test("matchesQuery is accent- and case-insensitive, and empty-passes-all", () => {
  assert.ok(
    matchesQuery("jimenez", ["Alfaro Jiménez", "alfaro-jimenez"]),
    "accent-free query still matches the accented display name"
  );
  assert.ok(
    matchesQuery("Garcia", ["GARCÍA"]),
    "uppercase accented target still matches a lowercase query"
  );
  assert.equal(
    matchesQuery("", ["anything"]),
    true,
    "empty query passes everything (UI shows the full list)"
  );
  assert.equal(
    matchesQuery("zzzzz", ["Alfaro Padilla"]),
    false,
    "no-overlap query rejects"
  );
});

/* -------------------------------------------------------------------------- */
/*  Sorting                                                                     */
/* -------------------------------------------------------------------------- */

test("CONFIRMATION_SORT_OPTIONS exposes only A-Z and Más lugares (the vague `Estado` sort was replaced by the status filter)", () => {
  const values = CONFIRMATION_SORT_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, ["az", "mas-lugares"]);
  const labels = CONFIRMATION_SORT_OPTIONS.map((o) => o.label);
  assert.deepEqual(labels, ["A-Z", "Más lugares"]);
});

test("CONFIRMATION_FILTER_OPTIONS exposes Todos + the persisted Enviada state, in Spanish", () => {
  const values = CONFIRMATION_FILTER_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, [
    "todos",
    "sin_lugares",
    "sin_respuesta",
    "enviada",
    "confirmada",
    "sin_asistencia",
  ]);
  const labels = CONFIRMATION_FILTER_OPTIONS.map((o) => o.label);
  assert.deepEqual(labels, [
    "Todos",
    "Sin lugares",
    "Sin respuesta",
    "Enviada",
    "Confirmada",
    "Sin asistencia",
  ]);
});

test("sortConfirmations does not mutate its input", () => {
  const input = [
    group({ displayName: "Bravo", assignedSeats: 2, slug: "bravo" }),
    group({ displayName: "Alfa", assignedSeats: 5, slug: "alfa" }),
  ];
  sortConfirmations(input, "az");
  // Inputs must remain in their original order.
  assert.equal(input[0].slug, "bravo");
  assert.equal(input[1].slug, "alfa");
});

test("sortConfirmations 'mas-lugares' is descending with null last", () => {
  const input = [
    group({ displayName: "Alfa", assignedSeats: null, slug: "alfa" }),
    group({ displayName: "Bravo", assignedSeats: 2, slug: "bravo" }),
    group({ displayName: "Charlie", assignedSeats: 8, slug: "charlie" }),
  ];
  const sorted = sortConfirmations(input, "mas-lugares");
  assert.deepEqual(
    sorted.map((g) => g.slug),
    ["charlie", "bravo", "alfa"]
  );
});

test("sortConfirmations 'estado' puts sin_lugares first, then sin_respuesta", () => {
  const input = [
    group({
      displayName: "Confirmado",
      assignedSeats: 4,
      rsvp: { attendingCount: 3 },
      slug: "confirmado",
    }),
    group({ displayName: "SinLugares", assignedSeats: null, slug: "sinlugares" }),
    group({ displayName: "SinResp", assignedSeats: 4, slug: "sinresp" }),
    group({
      displayName: "SinAsis",
      assignedSeats: 4,
      rsvp: { attendingCount: 0 },
      slug: "sinasis",
    }),
  ];
  const sorted = sortConfirmations(input, "estado");
  assert.deepEqual(
    sorted.map((g) => g.slug),
    ["sinlugares", "sinresp", "sinasis", "confirmado"]
  );
});

test("sortConfirmations 'az' sorts by display name, case/accent-insensitive", () => {
  const input = [
    group({ displayName: "Ávila", slug: "avila" }),
    group({ displayName: "Alfaro", slug: "alfaro" }),
    group({ displayName: "alfaro", slug: "alfaro-lower" }),
  ];
  const sorted = sortConfirmations(input, "az");
  // localeCompare with sensitivity "base" treats 'Á' and 'A' as equal, so the
  // comparison falls through to the second letter: "l" (Alfaro) < "v" (Ávila),
  // so Alfaro sorts first. The accented and lowercase "Alfaro"/"alfaro" tie
  // (base sensitivity), so their relative order is the input order.
  assert.equal(sorted[0].slug, "alfaro");
  assert.equal(sorted[sorted.length - 1].slug, "avila");
});

/* -------------------------------------------------------------------------- */
/*  Status filter                                                              */
/* -------------------------------------------------------------------------- */

test("filterConfirmations: `todos` passes everything through as a new array", () => {
  const input = [
    group({ slug: "a", assignedSeats: null }),
    group({ slug: "b", assignedSeats: 3, rsvp: null }),
    group({ slug: "c", assignedSeats: 3, rsvp: { attendingCount: 2 } }),
    group({ slug: "d", assignedSeats: 3, rsvp: { attendingCount: 0 } }),
  ];
  const out = filterConfirmations(input, "todos", new Set());
  assert.deepEqual(
    out.map((g) => g.slug),
    ["a", "b", "c", "d"]
  );
  // Returns a new array (does not alias the input).
  assert.notEqual(out, input);
});

test("filterConfirmations: data-state filters resolve against persisted `(assignedSeats, rsvp)`", () => {
  const input = [
    group({ slug: "sinlugar", assignedSeats: null }),
    group({ slug: "sinresp", assignedSeats: 3, rsvp: null }),
    group({ slug: "confirm", assignedSeats: 3, rsvp: { attendingCount: 2 } }),
    group({ slug: "sinasis", assignedSeats: 3, rsvp: { attendingCount: 0 } }),
  ];
  assert.deepEqual(
    filterConfirmations(input, "sin_lugares", new Set()).map((g) => g.slug),
    ["sinlugar"]
  );
  assert.deepEqual(
    filterConfirmations(input, "sin_respuesta", new Set()).map((g) => g.slug),
    ["sinresp"]
  );
  assert.deepEqual(
    filterConfirmations(input, "confirmada", new Set()).map((g) => g.slug),
    ["confirm"]
  );
  assert.deepEqual(
    filterConfirmations(input, "sin_asistencia", new Set()).map((g) => g.slug),
    ["sinasis"]
  );
});

test("filterConfirmations: `enviada` reads persisted sentAt from the loaded groups", () => {
  const input = [
    group({ slug: "alpha", assignedSeats: 3, rsvp: null, sentAt: "2026-07-22T00:00:00.000Z" }),
    group({ slug: "beta", assignedSeats: 3, rsvp: { attendingCount: 2 }, sentAt: "2026-07-22T00:00:00.000Z" }),
    group({ slug: "gamma", assignedSeats: 3, rsvp: null, sentAt: null }),
  ];
  // Only unanswered rows with persisted `sentAt` are `Enviada`; answered rows
  // remain terminal (`Confirmado`/`Sin asistencia`) even if they were sent.
  assert.deepEqual(
    filterConfirmations(input, "enviada").map((g) => g.slug),
    ["alpha"]
  );
});

/* -------------------------------------------------------------------------- */
/*  Page-boundary contract                                                      */
/* -------------------------------------------------------------------------- */

test("the page reuses the admin-overview boundary and does not add a new fetch", async () => {
  const page = await readSrc(PAGE);

  // The new page must reuse the existing read-only boundary instead of
  // duplicating the Supabase call. Locking the import keeps a future refactor
  // from silently forking the data path or shipping a second service-role
  // fetch into the bundle.
  assert.match(
    page,
    /getActiveGuestGroupsWithRsvp/,
    "page must call getActiveGuestGroupsWithRsvp from the admin-overview boundary"
  );
  // The boundary export must really exist where the page imports it from.
  const boundary = await readSrc(OVERVIEW_BOUNDARY);
  assert.match(
    boundary,
    /export const getActiveGuestGroupsWithRsvp/,
    "admin-overview boundary must export getActiveGuestGroupsWithRsvp"
  );

  // No service-role env name leaks into the page source; the boundary keeps
  // the Supabase access server-side.
  assert.doesNotMatch(
    page,
    /SUPABASE_SERVICE_ROLE_KEY/,
    "page must not reference the service-role env name (boundary keeps it server-only)"
  );
});

test("the page passes its groups to ConfirmationsView as plain props", async () => {
  const page = await readSrc(PAGE);
  assert.match(
    page,
    /<ConfirmationsView groups=\{groups\} \/>/,
    "page must pass loaded groups to the client view as serializable props"
  );
});

test("the page intro explains status meanings and reminds the host to mark invitations sent", async () => {
  const page = await readSrc(PAGE);

  for (const copy of [
    "Sin lugares significa que todavía falta",
    "Sin respuesta significa que la invitación tiene",
    "Enviada significa que marcaste a mano",
    "Confirmada significa que ya respondieron",
    "Sin asistencia significa que confirmaron que no",
    "después de mandar",
    "el enlace por WhatsApp",
  ]) {
    assert.match(
      page,
      new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `intro copy must include: ${copy}`
    );
  }
});

test("the view re-exports the shared helpers and never imports the server boundary", async () => {
  const view = await readSrc(VIEW);

  assert.match(
    view,
    /from "@\/lib\/admin-confirmations-shared"/,
    "view must import runtime values from the shared (client-safe) module"
  );
  assert.doesNotMatch(
    view,
    /@\/lib\/supabase\/server/,
    "view must NEVER import the server-only Supabase module (would break the client bundle)"
  );
  assert.doesNotMatch(
    view,
    /SUPABASE_SERVICE_ROLE_KEY/,
    "view must never read the service-role env name"
  );
});

test("top insights expose all six metrics the host asked for, in Spanish", async () => {
  const view = await readSrc(VIEW);

  // The six insights must each be present, using the clearer
  // invitation-focused Spanish labels the host approved. The confirmed-place
  // count remains labeled as guests, not invitations, so the metric stays true.
  for (const label of [
    "Lugares asignados",
    "Invitados confirmados",
    "Invitaciones confirmadas",
    "Invitaciones sin respuesta",
    "Invitaciones enviadas",
    "Invitaciones sin lugares asignados",
  ]) {
    assert.match(
      view,
      new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `insight card label \`${label}\` must be present`
    );
  }

  // `Enviados` is backed by persisted `sent_at`, not session-only state.
  assert.match(
    view,
    /enviadosCount\s*=\s*summary\.groupsEnviados/,
    "Enviados count must come from persisted summary data"
  );
  assert.doesNotMatch(
    view,
    /solo en esta sesión/,
    "the sent insight must no longer claim session-only behavior"
  );
});

test("`Invitaciones totales` is rendered as a bigger hero summary card above the six supporting insights", async () => {
  const view = await readSrc(VIEW);

  // The hero label the host asked for as the first/bigger summary card.
  assert.match(
    view,
    /Invitaciones totales/,
    "the headline `Invitaciones totales` insight must be present"
  );

  // It must be wired to a dedicated hero component, not the small `SummaryCard`
  // used by the six supporting metrics, so it stays visually bigger.
  assert.match(
    view,
    /HeroSummaryCard/,
    "the hero insight must render through a dedicated `HeroSummaryCard` component"
  );
  assert.match(
    view,
    /label="Invitaciones totales"/,
    "the hero card must be labeled `Invitaciones totales`"
  );
  assert.match(
    view,
    /value=\{summary\.totalGroups\}/,
    "the hero card value must come from `summary.totalGroups`"
  );

  // The summary must expose `totalGroups`, derived from the data boundary
  // (active guest groups count), so the hero reads the size of the active list.
  assert.match(
    view,
    /const totalGroups = groups\.length/,
    "`computeSummary` must derive `totalGroups` from `groups.length`"
  );
  assert.match(
    view,
    /totalGroups,/g,
    "`totalGroups` must be returned from `computeSummary`"
  );

  // The hero must render BEFORE the grid of six small cards, so its position
  // in source encodes "first/bigger" rather than relying on CSS order alone.
  const heroIdx = view.indexOf("HeroSummaryCard");
  const gridIdx = view.indexOf(
    'grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6'
  );
  assert.ok(
    heroIdx > -1 && gridIdx > -1 && heroIdx < gridIdx,
    "the hero card must appear before the six-card grid in source order"
  );
});

test("the view surfaces an explicit status filter (reusing the shared options) and no vague `Ordenar por: Estado` sort label", async () => {
  const view = await readSrc(VIEW);

  // The new explicit status filter dropdown reuses the shared `OPTIONS` array
  // (the labels themselves are pinned by the `CONFIRMATION_FILTER_OPTIONS`
  // test above, so here we only assert the view wires the dropdown in and no
  // `estado` sort option leaked back into the source).
  assert.match(
    view,
    /CONFIRMATION_FILTER_OPTIONS/,
    "the status filter reuses the shared options array"
  );
  assert.match(
    view,
    /filterConfirmations\(groups,\s*filterKey\)/,
    "the visible list must be filtered through the shared helper using persisted group data"
  );

  // The default sort is A-Z (the old `estado` default was dropped along with
  // the vague `Estado` sort option). The visible sort options are still A-Z
  // and Más lugares only.
  assert.match(
    view,
    /useState<ConfirmationSortKey>\("az"\)/,
    "default sort must be A-Z now that the vague `Estado` sort is gone"
  );
  assert.match(
    view,
    /useState<ConfirmationFilterKey>\("todos"\)/,
    "default status filter must be `Todos`"
  );
  // The old `{ value: "estado", label: "Estado" }` sort entry must NOT leak
  // back into the source now that the explicit filter replaced it.
  assert.doesNotMatch(
    view,
    /value:\s*"estado"/,
    "no `estado` sort option should appear in the view source"
  );
});

test("empty state explains when no invitations match the selected status", async () => {
  const view = await readSrc(VIEW);

  assert.match(
    view,
    /selectedFilterLabel\s*=\s*\n?\s*CONFIRMATION_FILTER_OPTIONS\.find/,
    "empty-state copy must derive the human status label from the shared filter options"
  );
  assert.match(
    view,
    /No hay invitaciones que coincidan con estado: \$\{selectedFilterLabel\}\./,
    "status-filter empty state must name the selected status"
  );
  assert.doesNotMatch(
    view,
    /No hay grupos que coincidan/,
    "empty state should use `invitaciones`, not developer-facing `grupos`"
  );
});

test("copy-link action: disabled when no seats, success message is the Spanish one the host approved", async () => {
  const view = await readSrc(VIEW);

  // Button label REQUIRED to be "Copiar" (the host said so explicitly).
  assert.match(view, /"Copiar"/, "`Copiar` is the button's idle label");

  // Success message REQUIRED by the host.
  assert.match(
    view,
    /Link copiado en el portapapeles/,
    "the Spanish success message the host approved must be shown"
  );

  // Helper text REQUIRED when no seats are assigned.
  assert.match(
    view,
    /Asigna lugares primero/,
    "groups without seats show the `Asigna lugares primero` helper"
  );

  // The copy action must compose the URL from a SAFE path plus the page
  // origin, never from a server-built absolute URL carrying secrets.
  assert.match(
    view,
    /window\.location\.origin/,
    "copy builds the URL from `window.location.origin` plus a safe path (no server origin baked in)"
  );
});

test("sent-state toggle: present, accessible, and persisted through a Server Action", async () => {
  const view = await readSrc(VIEW);

  // The "Enviada" manual toggle the host asked for is present, with its
  // Spanish accessible label preserved.
  assert.match(view, /Enviada/, "the `Enviada` toggle is rendered");

  // The checkbox was replaced by an iPhone-style switch that exposes the
  // correct semantics to assistive tech (role="switch" + aria-checked), so
  // screen readers announce it as a two-state toggle, not a generic checkbox.
  assert.match(
    view,
    /role="switch"/,
    "the toggle uses `role=\"switch\"` instead of a native checkbox"
  );
  assert.match(
    view,
    /aria-checked=\{sent\}/,
    "the toggle reflects its on/off state via `aria-checked`"
  );
  ariaCheckedReflectsSentLabel(view);

  // The off state stays neutral/light and the on state turns green, matching
  // the iPhone-like visual the host asked for. Pinned to class names so a
  // future "professional redesign" cannot silently regress the affordance.
  assert.match(
    view,
    /bg-green-600/,
    "the on state paints the track green"
  );

  // Sent state is now persisted: the switch calls the dedicated Server Action,
  // and the client never imports Supabase or a service-role env directly.
  assert.match(
    view,
    /toggleGuestGroupSentAction/,
    "the sent toggle must call the persisted sent-state Server Action"
  );
  assert.match(
    view,
    /useTransition/,
    "the sent toggle should invoke the action in a transition"
  );
  assert.doesNotMatch(
    view,
    /solo visible en esta sesión|solo en esta sesión/,
    "the helper copy must no longer claim sent state is session-only"
  );
});

/* Used by the toggle test above to assert the switch's on/off state is bound
   to `aria-checked`, not a stale `value`/`checked` prop on a hidden checkbox. */
function ariaCheckedReflectsSentLabel(view) {
  assert.match(
    view,
    /aria-checked=\{sent\}/,
    "aria-checked must be bound to the `sent` prop (not a static boolean)"
  );
}

test("the shared module stays client-safe: no server-only or Supabase import", async () => {
  const shared = await readSrc(SHARED);

  // The shared module is imported by the client view, so it MUST NOT import
  // `server-only` or the Supabase server client. This mirrors the
  // `rsvps-shared.ts` convention and keeps Turbopack from dragging the
  // service-role key into the client bundle graph.
  assert.doesNotMatch(
    shared,
    /import "server-only"/,
    "shared module must not import `server-only` (client-safe)"
  );
  // Match only real import statements (static or dynamic), not the doc
  // comment, which references the path for explanatory reasons.
  assert.doesNotMatch(
    shared,
    /import\s+[^;]*["']@\/lib\/supabase\/server["']|import\(["']@\/lib\/supabase\/server["']\)/,
    "shared module must not import the Supabase server client"
  );
});

/* -------------------------------------------------------------------------- */
/*  Inline Modificar panel (modify existing cards only)                        */
/* -------------------------------------------------------------------------- */

test("modificar: the view reuses the existing guest-group update Server Action (no second mutation surface, no client-side Supabase)", async () => {
  const view = await readSrc(VIEW);

  // The view MUST import the shared guest-group action module — this is the
  // slice's reuse contract: no extra client-side mutation surface and no
  // duplicated unsafe Supabase client in the browser.
  assert.match(
    view,
    /from "@\/app\/admin\/\(dashboard\)\/guest-groups\/actions"/,
    "view must import `updateGuestGroupAction` from the existing guest-groups actions module"
  );
  assert.match(
    view,
    /useActionState\(\s*updateGuestGroupAction/,
    "view must wire the shared action through `useActionState`"
  );

  // No service-role env name leaks into the client view and no direct Supabase
  // server import (the action is the only mutation path and runs on the
  // server).
  assert.doesNotMatch(
    view,
    /SUPABASE_SERVICE_ROLE_KEY/,
    "view must never reference the service-role env name"
  );
  assert.doesNotMatch(
    view,
    /@\/lib\/supabase\/server/,
    "view must never import the server-only Supabase module"
  );
});

test("modificar: each card renders a `Modificar` button next to `Copiar`", async () => {
  const view = await readSrc(VIEW);

  // The button label REQUIRED by the host (Spanish copy). JSX text may span
  // lines, so allow whitespace between `>` and the label.
  assert.match(view, />\s*Modificar\s*</, "`Modificar` is a visible button label on each card");
  // The button is a plain toggle (type="button") opening the edit panel, never
  // a submit — submitting is reserved for the inline form's `Guardar`.
  assert.match(
    view,
    /onToggleEdit\(true\)/,
    "`Modificar` opens the edit panel via onToggleEdit(true)"
  );
  // The Modificar button itself must NOT be a submit (so it only toggles the
  // panel, never posts). Submit is reserved for the inline form's Save button.
  assert.match(
    view,
    /type="button"[\s\S]*?onToggleEdit\(true\)/,
    "`Modificar` is a type=button (not a submit) that opens the edit panel"
  );
});

test("modificar: the inline edit panel only edits displayName + assignedSeats and preserves the rest via hidden fields", async () => {
  const view = await readSrc(VIEW);

  // The panel is gated per card: only the card whose slug matches
  // `editingSlug` renders `ModifyPanel`, so two panels can never be open at
  // once and the rest of the card stays visible.
  assert.match(
    view,
    /isEditing=\{editingSlug === group\.slug\}/,
    "edit state is gated by comparing editingSlug to the card's slug"
  );

  // Only two fields are editable in the UPDATE form; the other mutable fields
  // are carried through hidden inputs so the shared update action does not
  // wipe them. `isActive="on"` keeps the invitation link enabled (this page
  // lists active groups only), and `seatsNote` is echoed back so a prior note
  // survives a name/seats edit.
  assert.match(view, /name="displayName"/, "panel exposes an editable displayName field");
  assert.match(view, /name="assignedSeats"/, "panel exposes an editable assignedSeats field");
  assert.match(view, /name="isActive"[^>]*value="on"/, "panel carries isActive as hidden 'on' to preserve the link");
  assert.match(view, /name="seatsNote"[^>]*value=\{group\.seatsNote \?\? ""\}/, "panel carries the existing seatsNote as a hidden field");

  // The slug is submitted as a hidden field so the shared action knows which
  // row to patch and can fan the feedback back to the matching card.
  assert.match(
    view,
    /<input type="hidden" name="slug" value=\{group\.slug\} \/>/,
    "panel submits the card's slug as a hidden field"
  );
});

/* -------------------------------------------------------------------------- */
/*  Nueva invitación panel                                                     */
/* -------------------------------------------------------------------------- */

test("nueva invitación: a normal rounded button labeled `+ Nueva invitación` sits below the search/filter area", async () => {
  const view = await readSrc(VIEW);

  // Label REQUIRED by the host (Spanish copy, with the `+` prefix).
  assert.match(
    view,
    />\s*\+\s*Nueva invitación\s*</,
    "the `Nueva invitación` button is rendered with the `+` prefix in Spanish"
  );
  // It is a type=button (toggle) so it cannot accidentally submit the inline
  // Modificar form.
  assert.match(
    view,
    /type="button"[\s\S]*?\+\s*Nueva invitación/,
    "the `Nueva invitación` button is type=button (toggles the panel, never submits)"
  );
  // No floating-plus / FAB pattern — must be a normal rounded button class.
  assert.match(
    view,
    /rounded-xl[^]*>\s*\+\s*Nueva invitación/,
    "the `Nueva invitación` button uses the same rounded style as the other admin buttons (no floating plus)"
  );
});

test("nueva invitación: the panel is gated by a single open state (only one create panel at a time)", async () => {
  const view = await readSrc(VIEW);

  // The parent owns an open nonce; when null the panel unmounts, so its
  // `useActionState` initializes fresh on each open.
  assert.match(
    view,
    /useState<number \| null>\(null\)/,
    "the view holds a nullable open-nonce state to gate the create panel"
  );
  assert.match(
    view,
    /createOpenNonce !== null \?[\s\S]*?NewInvitationPanel/,
    "the NewInvitationPanel is conditionally rendered from the open nonce"
  );
});

test("nueva invitación: the panel mounts its own `useActionState` for the create action (fresh per open)", async () => {
  const view = await readSrc(VIEW);

  // The create action is imported from the same actions module as the update
  // action, keeping a single mutation surface. No new client-side Supabase.
  assert.match(
    view,
    /createGuestGroupAction,/,
    "the view imports `createGuestGroupAction`"
  );
  // The panel uses the INITIAL create state (carries no slug), so success/error
  // feedback does not collide with the update form's slug-keyed fan-out.
  assert.match(
    view,
    /INITIAL_GUEST_GROUP_CREATE_FORM_STATE/,
    "the create panel initializes from the create-specific initial state"
  );
  assert.match(
    view,
    /useActionState\(\s*createGuestGroupAction/,
    "the create panel wires `createGuestGroupAction` through `useActionState`"
  );
});

test("nueva invitación: the create action is the create boundary (no client-side Supabase, no service-role env name)", async () => {
  const view = await readSrc(VIEW);

  assert.doesNotMatch(
    view,
    /SUPABASE_SERVICE_ROLE_KEY/,
    "the view must never reference the service-role env name"
  );
  assert.doesNotMatch(
    view,
    /@\/lib\/supabase\/server/,
    "the view must never import the server-only Supabase module"
  );
});

test("nueva invitación: the create action revalidates `/admin/confirmaciones` on success", async () => {
  const action = await readSrc(ACTION);

  // The create action must revalidate the official Confirmaciones surface so
  // the new/reactivated card appears. The legacy `/admin/guest-groups` route
  // is now a redirect stub, so it must NOT be revalidated — revalidating a
  // redirect would keep a meaningless reference alive.
  assert.match(
    action,
    /revalidatePath\("\/admin\/confirmaciones"\)/,
    "create action must revalidate `/admin/confirmaciones` on success"
  );
  assert.doesNotMatch(
    action,
    /revalidatePath\("\/admin\/guest-groups"\)/,
    "create action must NOT revalidate the legacy `/admin/guest-groups` (now a redirect)"
  );
  assert.doesNotMatch(
    action,
    /revalidatePath\("\/admin\/rsvps"\)/,
    "create action must NOT revalidate the legacy `/admin/rsvps` (now a redirect)"
  );
  // And it must call the create boundary (not reuse the update boundary).
  assert.match(
    action,
    /createOrReactivateGuestGroupForAdmin\(/,
    "create action must call `createOrReactivateGuestGroupForAdmin`"
  );
  // The action must re-verify admin auth before the write, mirroring the
  // update action's guard (Server Actions are independently invokable).
  assert.match(
    action,
    /export async function createGuestGroupAction[\s\S]*?isAdminAuthenticated\(\)/,
    "create action must re-verify admin auth before mutating"
  );
});

test("nueva invitación: the panel only edits `displayName` + `assignedSeats` and shows a live slug preview", async () => {
  const view = await readSrc(VIEW);

  // Only the two host-facing fields are exposed (no isActive/seatsNote from
  // the create panel — isActive defaults to true, seatsNote defaults to null
  // on the server).
  assert.match(
    view,
    /name="displayName"[\s\S]*?name="assignedSeats"/,
    "the create panel exposes displayName and assignedSeats fields"
  );
  // The slug preview is derived live via the shared pure helper. The server
  // recomputes the canonical slug, so the preview is advisory only.
  assert.match(
    view,
    /const previewSlug = slugifyGuestGroupName\(displayName\)/,
    "the live slug preview must be computed from the shared pure helper"
  );
  // The preview must render the `/i/[slug]` path shape the host will share,
  // and an empty-state hint when no alphanumerics have been typed.
  assert.match(
    view,
    /\/i\/\$\{previewSlug\}/,
    "the preview shows the `/i/[slug]` invitation path shape"
  );
  assert.match(
    view,
    /Aparecerá al escribir el nombre\./,
    "the preview empty state tells the host the slug will appear after typing"
  );
});

test("nueva invitación: success + error feedback is surfaced in Spanish, and `Crear otra` resets the panel fresh", async () => {
  const view = await readSrc(VIEW);

  // Pending submit feedback.
  assert.match(view, /Creando…/, "create button shows `Creando…` while submitting");
  assert.match(view, /Crear invitación/, "create button idle label is `Crear invitación`");

  // Success: a Spanish confirmation plus the resulting `/i/[slug]` link.
  assert.match(view, /Invitación creada\./, "success feedback is `Invitación creada.`");
  assert.match(
    view,
    /\/i\/\$\{formState\.slug\}/,
    "success feedback shows the resulting slug's invitation path"
  );

  // Error: the action's Spanish `error.message` is rendered inline.
  assert.match(
    view,
    /formState\.status === "error" ?\?[\s\S]*?\{formState\.error\.message\}/,
    "the create panel renders the action's Spanish error message inline"
  );

  // `Crear otra` remounts the panel via the parent's open nonce so the next
  // submission starts from the idle state (no stale success/error carried over).
  assert.match(
    view,
    /\bCrear otra\b/,
    "`Crear otra` button is present on success to reset the panel"
  );
  assert.match(
    view,
    /onReset=\{\(\) =>[\s\S]*?setCreateOpenNonce\(\(prev\) => \(prev \?\? 0\) \+ 1\)\s*\}/,
    "`Crear otra` increments the open nonce to remount the panel fresh"
  );
});

test("modificar: Spanish pending / success / error feedback is surfaced", async () => {
  const view = await readSrc(VIEW);

  // Pending (submit in flight): the Save button shows the Spanish pending
  // label while `useFormStatus().pending` is true.
  assert.match(view, /Guardando…/, "Save button shows `Guardando…` while submitting");
  assert.match(view, /Guardar cambios/, "Save button idle label is `Guardar cambios`");
  assert.match(view, /useFormStatus\(\)/, "pending state is read from `useFormStatus`");

  // Success: the same Spanish confirmation the guest-groups editor uses. JSX
  // text may span lines, so allow whitespace around the period.
  assert.match(view, />\s*Guardado\.\s*</, "success feedback is `Guardado.`");

  // Error: the action's Spanish `error.message` is rendered inline (it can
  // vary by code, so we only pin that the message is surfaced, not a single
  // literal). The fan-out guard keeps idle cards quiet.
  assert.match(
    view,
    /feedback\?\.status === "error"/,
    "error branch is detected from the action state"
  );
  assert.match(
    view,
    /\{feedback\.error\.message\}/,
    "the action's Spanish error message is rendered in the panel"
  );
  assert.match(
    view,
    /formState\.slug === group\.slug \? formState : null/,
    "feedback is fanned to the matching card only (slug guard)"
  );

  // A `Cancelar` button lets the host close the panel without saving.
  assert.match(view, />\s*Cancelar\s*</, "panel has a `Cancelar` button to dismiss without saving");
});

test("modificar: a successful save revalidates `/admin/confirmaciones` so the card refreshes from persisted data", async () => {
  const action = await readSrc(ACTION);

  // The shared action MUST revalidate the confirmaciones path (in addition to
  // the guest-groups path) so a save from the inline `Modificar` panel
  // refreshes the card's stats/status badge from the freshly persisted row —
  // including the `Sin lugares` flip when assignedSeats is cleared, which
  // disables copy and the `Enviada` toggle on the next render.
  assert.match(
    action,
    /revalidatePath\("\/admin\/confirmaciones"\)/,
    "action must revalidate `/admin/confirmaciones` on success"
  );
});

test("modificar: clearing assignedSeats surfaces as `Sin lugares` + disabled copy (driven by post-save data, not local state)", () => {
  // `confirmationStatusFor` already returns `sin_lugares` for null seats, and
  // the card disables copy when `!hasAssignedSeats`. After a save that clears
  // seats, `revalidatePath` refreshes `groups`, so the card re-evaluates from
  // the row's persisted `assignedSeats: null` and naturally shows `Sin
  // lugares`. This test pins the data contract those UI branches depend on so
  // the post-save behavior cannot regress.
  assert.equal(
    confirmationStatusFor(group({ assignedSeats: null, rsvp: null })),
    "sin_lugares",
    "clearing seats must resolve to `sin_lugares` so the card shows `Sin lugares`"
  );
  assert.equal(
    CONFIRMATION_STATUS_LABELS.sin_lugares,
    "Sin lugares",
    "the status label stays `Sin lugares`"
  );
});
