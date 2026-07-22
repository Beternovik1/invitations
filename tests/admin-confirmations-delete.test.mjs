// Deterministic source-contract tests for the inline `Eliminar` (soft-delete)
// flow on `/admin/confirmaciones`.
//
// The repo's test style (see `admin-confirmations.test.mjs` and
// `admin-guest-groups-create.test.mjs`) is deterministic source-contract
// tests: read source files from disk and assert externally-visible facts with
// `node:assert`. No network, no DB, no render — only `node:test` and
// `node:assert`.
//
// These tests pin down the slice's contract:
//   1. The dedicated `GuestGroupDeleteFormState` ships in the shared
//      client-safe module (no server imports), with `idle` / `success` /
//      `error` branches and an INITIAL constant.
//   2. The admin boundary `deleteGuestGroupForAdmin` soft-deletes via a
//      dedicated server helper (NOT via the full-row update helper), rejects
//      empty slugs, and refuses to pretend a mock delete landed
//      (`unavailable`).
//   3. The server impl helper `softDeleteGuestGroupInSupabase` PATCHes ONLY
//      `is_active` and never issues a DELETE — confirmed by no DELETE grant
//      being added in any migration.
//   4. `deleteGuestGroupAction` re-verifies admin auth before mutating,
//      revalidates the official `/admin/confirmaciones` surface, and shares the
//      actions module's single mutation surface. The legacy `/admin/rsvps` and
//      `/admin/guest-groups` routes are now redirect stubs, so they are no
//      longer revalidated.
//   5. The view mounts the `Eliminar` control INSIDE the `Modificar` panel
//      with a two-step confirmation, uses the shared delete action through
//      `useActionState`, and ships no client-side Supabase / service-role env.
//   6. Migration 0003 already grants UPDATE; this slice adds NO new migration
//      and grants neither DELETE nor INSERT on top of 0003.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  INITIAL_GUEST_GROUP_DELETE_FORM_STATE,
} from "../src/lib/admin-guest-groups-shared.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const SHARED = "src/lib/admin-guest-groups-shared.ts";
const BOUNDARY = "src/lib/admin-guest-groups.ts";
const SERVER_IMPL = "src/lib/supabase/server.ts";
const ACTION = "src/app/admin/(dashboard)/guest-groups/actions.ts";
const VIEW = "src/app/admin/(dashboard)/confirmaciones/ConfirmationsView.tsx";
const MIGRATIONS_DIR = "supabase/migrations";
const UPDATE_GRANT_MIGRATION = "0003_grant_update_guest_groups.sql";
const DELETE_GRANT_MIGRATION = "0005_grant_delete_guest_groups.sql";

/* -------------------------------------------------------------------------- */
/*  Shared delete form-state                                                   */
/* -------------------------------------------------------------------------- */

test("INITIAL_GUEST_GROUP_DELETE_FORM_STATE is an `idle` state carrying an empty slug", () => {
  assert.equal(INITIAL_GUEST_GROUP_DELETE_FORM_STATE.status, "idle");
  assert.equal(INITIAL_GUEST_GROUP_DELETE_FORM_STATE.slug, "");
});

test("GuestGroupDeleteFormState union: idle / success / error, all key feedback by slug", async () => {
  // We import the type only at compile time, so assert the union via the
  // shared module's source text. This pins the contract reviewers care about
  // (status names + slug discriminator) without spawning a TS type-checker.
  const shared = await readSrc(SHARED);
  assert.match(
    shared,
    /export type GuestGroupDeleteFormState\s*=[\s\S]*?"idle";\s*slug: string[\s\S]*?"success";\s*slug: string[\s\S]*?"error";\s*slug: string;[\s\S]*?AdminGuestGroupError[\s\S]*?};/,
    "GuestGroupDeleteFormState must be a slug-discriminated idle/success/error union matching the update flow shape"
  );
  assert.match(
    shared,
    /export const INITIAL_GUEST_GROUP_DELETE_FORM_STATE/,
    "shared module must export the INITIAL delete form state"
  );
  assert.match(
    shared,
    /export type AdminGuestGroupDeleteResult\s*=\s*\|\s*\{\s*ok:\s*true\s*\}\s*\|\s*\{\s*ok:\s*false;\s*error:\s*AdminGuestGroupError\s*\};/,
    "shared module must export the `AdminGuestGroupDeleteResult` type (success has no `group` payload)"
  );
});

test("the shared module still avoids server-only / Supabase imports (client-safe)", async () => {
  const shared = await readSrc(SHARED);
  // Strip doc-comment / line-comment lines before matching so explanatory
  // doc comments referencing `@/lib/supabase/server` do not trigger a false
  // positive. Only REAL import statements on code lines are banned.
  const codeOnly = shared
    .split(/\n/)
    .filter((line) => !/^\s*(\*|\/\/)/.test(line))
    .join("\n");

  assert.doesNotMatch(
    codeOnly,
    /^import "server-only";?\s*$/m,
    "shared module must not run a top-level `import \"server-only\"` (client-safe)"
  );
  assert.doesNotMatch(
    codeOnly,
    /import\s+[^;]*["']@\/lib\/supabase\/server["']/,
    "shared module must not statically import the Supabase server client"
  );
  assert.doesNotMatch(
    codeOnly,
    /import\(["']@\/lib\/supabase\/server["']\)/,
    "shared module must not dynamically import the Supabase server client"
  );
});

/* -------------------------------------------------------------------------- */
/*  Boundary (admin-guest-groups.ts)                                            */
/* -------------------------------------------------------------------------- */

test("boundary exports `deleteGuestGroupForAdmin` and the delete result type re-exported", async () => {
  const boundary = await readSrc(BOUNDARY);

  assert.match(
    boundary,
    /export async function deleteGuestGroupForAdmin\(/,
    "boundary must export `deleteGuestGroupForAdmin`"
  );
  assert.match(
    boundary,
    /type AdminGuestGroupDeleteResult,/,
    "boundary must import the delete result type from the shared module"
  );
  assert.match(
    boundary,
    /type GuestGroupDeleteFormState,/,
    "boundary must re-export the delete form state type"
  );
});

test("boundary: empty slug is rejected as `group_not_found` BEFORE any Supabase call", async () => {
  const boundary = await readSrc(BOUNDARY);

  assert.match(
    boundary,
    /export async function deleteGuestGroupForAdmin\([\s\S]*?const trimmedSlug = slug\.trim\(\);[\s\S]*?if \(trimmedSlug\.length === 0\)[\s\S]*?return \{ ok: false, error: error\("group_not_found"\) \};/,
    "delete boundary must trim the slug and reject an empty one with `group_not_found`"
  );
});

test("boundary: in mock mode the delete is refused as `unavailable`, matching the update/create honesty contract", async () => {
  const boundary = await readSrc(BOUNDARY);

  assert.match(
    boundary,
    /export async function deleteGuestGroupForAdmin\([\s\S]*?if \(!isSupabaseConfigured\(\)\)[\s\S]*?return \{ ok: false, error: error\("unavailable"\) \};/,
    "delete boundary must return `unavailable` in zero-config / mock mode (no fake deletes)"
  );
});

test("boundary: soft-deletes via the dedicated `softDeleteGuestGroupInSupabase` helper, not the full-row update helper", async () => {
  const boundary = await readSrc(BOUNDARY);

  // The delete path MUST NOT reuse the full-row update helper: that would
  // force the boundary to fetch the existing row just to preserve columns, and
  // would also PATCH display_name/assigned_seats/seats_note making the delete
  // less surgical. A dedicated helper PATCHes is_active only.
  assert.match(
    boundary,
    /const \{\s*softDeleteGuestGroupInSupabase\s*\} = await import\(\s*"@\/lib\/supabase\/server"\s*\);/,
    "delete boundary must import the dedicated `softDeleteGuestGroupInSupabase` helper"
  );
  assert.match(
    boundary,
    /const deleted = await softDeleteGuestGroupInSupabase\(trimmedSlug\);/,
    "delete boundary must call `softDeleteGuestGroupInSupabase(trimmedSlug)`"
  );
  // And it must NOT call the general update helper from the delete path.
  const deleteIdx = boundary.indexOf("export async function deleteGuestGroupForAdmin");
  const deleteEnd = boundary.indexOf("\n}\n", deleteIdx);
  const deleteSlice = boundary.slice(deleteIdx, deleteEnd === -1 ? undefined : deleteEnd);
  assert.doesNotMatch(
    deleteSlice,
    /updateGuestGroupInSupabase/,
    "delete boundary must NOT call the full-row `updateGuestGroupInSupabase` (use the dedicated soft-delete helper)"
  );
});

test("boundary: a no-row match (deleted out-of-band) maps to `group_not_found`, not a throw", async () => {
  const boundary = await readSrc(BOUNDARY);
  assert.match(
    boundary,
    /const deleted = await softDeleteGuestGroupInSupabase\(trimmedSlug\);[\s\S]*?if \(!deleted\)[\s\S]*?return \{ ok: false, error: error\("group_not_found"\) \};/,
    "delete boundary must map a no-match PATCH to `group_not_found`"
  );
});

test("boundary: transport-level failures are caught and surfaced as `unexpected` (never thrown to the action)", async () => {
  const boundary = await readSrc(BOUNDARY);
  assert.match(
    boundary,
    /export async function deleteGuestGroupForAdmin\([\s\S]*?try \{[\s\S]*?\} catch \{[\s\S]*?return \{ ok: false, error: error\("unexpected"\) \};[\s\S]*?\}/,
    "delete boundary must catch unexpected failures and return `unexpected`"
  );
});

/* -------------------------------------------------------------------------- */
/*  Server impl (supabase/server.ts)                                            */
/* -------------------------------------------------------------------------- */

test("server impl: exports `softDeleteGuestGroupInSupabase` that PATCHes ONLY `is_active`", async () => {
  const impl = await readSrc(SERVER_IMPL);

  assert.match(
    impl,
    /export async function softDeleteGuestGroupInSupabase\(/,
    "server impl must export `softDeleteGuestGroupInSupabase`"
  );

  // Slice the helper's body so we only assert about IT, not the general
  // update helper that lives above it.
  const helperStart = impl.indexOf(
    "export async function softDeleteGuestGroupInSupabase"
  );
  assert.ok(helperStart > -1, "softDeleteGuestGroupInSupabase must be present");
  const helperBody = impl.slice(helperStart, helperStart + 2000);

  // Soft-delete = PATCH with a body of only `{ is_active: false }`. Pin the
  // exact body so a future refactor cannot silently start rewriting
  // display_name / assigned_seats / seats_note on the way out.
  assert.match(
    helperBody,
    /method:\s*"PATCH"/,
    "soft-delete helper must issue a PATCH (UPDATE privilege, not DELETE/INSERT)"
  );
  assert.match(
    helperBody,
    /body:\s*JSON\.stringify\(\{\s*is_active:\s*false,?\s*\}\)/,
    "soft-delete helper must PATCH a body of ONLY `{ is_active: false }` (no other columns mutated)"
  );
  assert.match(
    helperBody,
    /Prefer:\s*"return=representation"/,
    "soft-delete helper must request `return=representation` so the boundary can tell match from no-match"
  );
  // The helper must NOT issue a DELETE method anywhere in its body.
  assert.doesNotMatch(
    helperBody,
    /method:\s*"DELETE"/,
    "soft-delete helper must NOT issue an HTTP DELETE (hard-delete is out of scope; only is_active flips)"
  );
});

test("server impl: the soft-delete helper does not drop or modify RSVP rows", async () => {
  const impl = await readSrc(SERVER_IMPL);
  // The slice is `guest_groups`-only; rsvps REST path is for RSVPs. The delete
  // helper must not touch the rsvps endpoint at all.
  const helperStart = impl.indexOf("softDeleteGuestGroupInSupabase");
  const helperBody = impl.slice(helperStart, helperStart + 2000);
  assert.doesNotMatch(
    helperBody,
    /RSVP_REST_PATH|\/rest\/v1\/rsvps/,
    "soft-delete helper must NOT touch the rsvps endpoint (RSVP rows are preserved)"
  );
  assert.doesNotMatch(
    helperBody,
    /upsertRsvpInSupabase|fetchRsvpBySlugFromSupabase/,
    "soft-delete helper must NOT call any RSVP helper"
  );
});

/* -------------------------------------------------------------------------- */
/*  Server action                                                               */
/* -------------------------------------------------------------------------- */

test("action: `deleteGuestGroupAction` exists in the shared actions module and imports the delete form state", async () => {
  const action = await readSrc(ACTION);

  assert.match(
    action,
    /export async function deleteGuestGroupAction\(/,
    "actions module must export `deleteGuestGroupAction`"
  );
  assert.match(
    action,
    /deleteGuestGroupForAdmin,/,
    "action must import `deleteGuestGroupForAdmin` from the boundary"
  );
  assert.match(
    action,
    /INITIAL_GUEST_GROUP_DELETE_FORM_STATE/,
    "action must use `INITIAL_GUEST_GROUP_DELETE_FORM_STATE` as the idle state"
  );
  assert.match(
    action,
    /type GuestGroupDeleteFormState,/,
    "action must import the delete form state type from the boundary"
  );
});

test("action: an empty slug returns idle without hitting auth or the boundary (tampered form guard)", async () => {
  const action = await readSrc(ACTION);
  assert.match(
    action,
    /export async function deleteGuestGroupAction\([\s\S]*?const slug = typeof rawSlug === "string" \? rawSlug\.trim\(\) : "";[\s\S]*?if \(slug\.length === 0\)[\s\S]*?return INITIAL_GUEST_GROUP_DELETE_FORM_STATE;/,
    "action must parse + trim the slug and short-circuit to idle when missing"
  );
});

test("action: re-verifies admin auth immediately before the soft-delete", async () => {
  const action = await readSrc(ACTION);
  assert.match(
    action,
    /export async function deleteGuestGroupAction\([\s\S]*?if \(!isAdminAccessConfigured\(\) \|\| !\(await isAdminAuthenticated\(\)\)\)[\s\S]*?status: "error",[\s\S]*?Tu sesión de administrador expiró/,
    "delete action must re-verify admin auth before mutating (Server Actions are independently invokable)"
  );
});

test("action: revalidates only `/admin/confirmaciones` on success (legacy routes are redirect stubs)", async () => {
  const action = await readSrc(ACTION);
  // Confirmaciones is the single official admin surface; the legacy
  // `/admin/rsvps` and `/admin/guest-groups` routes are now redirect stubs, so
  // revalidating them would be meaningless. Pinning only the official path
  // keeps a future refactor from silently re-introducing references to the
  // dead routes.
  assert.match(
    action,
    /revalidatePath\("\/admin\/confirmaciones"\)/,
    "delete action must revalidate `/admin/confirmaciones` (unified list — card disappears)"
  );
  assert.doesNotMatch(
    action,
    /revalidatePath\("\/admin\/guest-groups"\)/,
    "delete action must NOT revalidate the legacy `/admin/guest-groups` (now a redirect)"
  );
  assert.doesNotMatch(
    action,
    /revalidatePath\("\/admin\/rsvps"\)/,
    "delete action must NOT revalidate the legacy `/admin/rsvps` (now a redirect)"
  );

  // The delete action must call the boundary and fan success/error back.
  assert.match(
    action,
    /const result = await deleteGuestGroupForAdmin\(slug\)/,
    "action must call the delete boundary"
  );
  assert.match(
    action,
    /if \(result\.ok\)[\s\S]*?return \{ status: "success", slug \};/,
    "on success the action returns `{ status: 'success', slug }`"
  );
  assert.match(
    action,
    /return \{ status: "error", slug, error: result\.error \};/,
    "on a known failure the action carries the structured error back"
  );
});

test("action: transport-level failures are caught and surfaced in Spanish", async () => {
  const action = await readSrc(ACTION);
  assert.match(
    action,
    /deleteGuestGroupAction[\s\S]*?try \{[\s\S]*?\} catch \{[\s\S]*?Ocurrió un problema al eliminar esta invitación/,
    "action must catch unexpected failures and surface the Spanish `Eliminar` error inline"
  );
});

/* -------------------------------------------------------------------------- */
/*  View (ConfirmationsView.tsx)                                               */
/* -------------------------------------------------------------------------- */

test("view imports `deleteGuestGroupAction` from the shared actions module (single mutation surface, no client Supabase)", async () => {
  const view = await readSrc(VIEW);

  assert.match(
    view,
    /from "@\/app\/admin\/\(dashboard\)\/guest-groups\/actions"/,
    "view must import the actions module"
  );
  assert.match(
    view,
    /deleteGuestGroupAction,/,
    "view must import `deleteGuestGroupAction`"
  );
  // No service-role env name, no server Supabase import — the action is the
  // only mutation path and runs on the server.
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

test("modificar panel hosts the inline `Eliminar` control with a dedicated `useActionState` for the delete action", async () => {
  const view = await readSrc(VIEW);

  // The delete action is wired through its own `useActionState`, separate from
  // the update form's, so the two flows never share feedback state on the same
  // card.
  assert.match(
    view,
    /useActionState\(\s*deleteGuestGroupAction,/,
    "view must wire `deleteGuestGroupAction` through its own `useActionState`"
  );
  assert.match(
    view,
    /INITIAL_GUEST_GROUP_DELETE_FORM_STATE/,
    "view must initialize the delete `useActionState` from the shared idle constant"
  );
});

test("eliminar: the modify panel renders an `Eliminar` button (host copy is delete/remove, not the implementation term)", async () => {
  const view = await readSrc(VIEW);

  assert.match(
    view,
    /<\/>Eliminar<\/button>|>\s*Eliminar\s*</,
    "the `Eliminar` button is rendered inside the modify panel"
  );
  // The host-facing vocabulary must be `Eliminar` / `Eliminando…` (delete),
  // never the implementation term in Spanish ("eliminación suave"). English
  // code comments legitimately explain `soft-delete`, so we only forbid the
  // Spanish implementation phrase leaking into UI strings.
  assert.doesNotMatch(
    view,
    /eliminación suave|eliminaci[oó]n l[oó]gica/i,
    "host-facing copy must NOT use Spanish implementation terms like `eliminación suave`"
  );
});

test("eliminar: a single tap on `Eliminar` does NOT delete — it reveals the confirmation prompt", async () => {
  const view = await readSrc(VIEW);

  // The first `Eliminar` is a type=button that only toggles the confirmation
  // state; the destructive submit is a separate form submitted by a second
  // button. This is the two-step confirmation contract.
  assert.match(
    view,
    /confirming\s*\?\s*\(?\s*<form action=\{deleteAction\}/,
    "the confirm step is a <form> whose action is the delete action"
  );
  assert.match(
    view,
    /<button[\s\S]*?type="button"[\s\S]*?onClick=\{\(\) => setConfirming\(true\)\}[\s\S]*?Eliminar/,
    "the first `Eliminar` is a type=button toggle that calls setConfirming(true)"
  );
  // The initial state must be NOT confirming, so the prompt is hidden until
  // the host taps.
  assert.match(
    view,
    /const \[confirming, setConfirming\] = useState\(false\)/,
    "confirm state starts false (prompt hidden until the host taps Eliminar)"
  );
});

test("eliminar: confirmation prompt copy is Spanish `¿Eliminar esta invitación?` with `Cancelar` and `Eliminar` buttons", async () => {
  const view = await readSrc(VIEW);

  // REQUIRED prompt wording per the host's instruction.
  assert.match(
    view,
    /¿Eliminar esta invitación\?/,
    "the confirmation prompt must ask `¿Eliminar esta invitación?`"
  );
  // The helper copy must honestly explain what happens (link stops working,
  // can be reactivated later).
  assert.match(
    view,
    /El enlace dejará de funcionar/,
    "the helper must tell the host the invitation link will stop working"
  );
  assert.match(
    view,
    /reactivarlo después/,
    "the helper must mention the invitation can be reactivated later via `Nueva invitación`"
  );
  // Two buttons inside the confirm form: `Cancelar` (dismiss) and `Eliminar`
  // (submit). Both labels must be present.
  assert.match(view, /Cancelar/, "the confirm step has a `Cancelar` button");
  // The final submit button is inside the confirm <form> and uses
  // `useFormStatus` for the pending label.
  assert.match(
    view,
    /function ConfirmDeleteButton\(/,
    "the confirm submit button is a dedicated component reading useFormStatus"
  );
  assert.match(
    view,
    /pending \? "Eliminando…" : "Eliminar"/,
    "the confirm submit button shows `Eliminando…` while pending and `Eliminar` at idle"
  );
});

test("eliminar: error feedback from the action is rendered inline in the confirm form", async () => {
  const view = await readSrc(VIEW);

  // The delete action's `error.message` is surfaced inside the confirm form,
  // and the slug guard fans it only to the matching card.
  assert.match(
    view,
    /deleteFeedback\?\.status === "error"/,
    "the confirm form detects the error branch from the delete action state"
  );
  assert.match(
    view,
    /\{deleteFeedback\.error\.message\}/,
    "the confirm form renders the action's Spanish error message inline"
  );
  assert.match(
    view,
    /deleteState\.slug === group\.slug \? deleteState : null/,
    "delete feedback is fanned to the matching card only (slug guard)"
  );
});

test("eliminar: success needs no UI on the card itself because revalidatePath refreshes the list", async () => {
  const view = await readSrc(VIEW);
  // The success branch does not need a "deleted" banner: after `revalidatePath`
  // refreshes `/admin/confirmaciones`, the card simply disappears on the next
  // render. We assert there is no dedicated success message (e.g. "Eliminado.")
  // that would be momentarily visible on a card that should already be gone.
  assert.doesNotMatch(
    view,
    /Eliminado\.?/,
    "the delete success branch must not render a now-irrelevant success banner — revalidatePath removes the card"
  );
});

test("eliminar: the delete form submits the card's slug as a hidden field (matches the update form shape)", async () => {
  const view = await readSrc(VIEW);
  // There must be a second hidden slug input inside the delete confirm form.
  // The update form also has one, so we assert at least two occurrences.
  const slugHits = view.match(/<input type="hidden" name="slug" value=\{group\.slug\} \/>/g) ?? [];
  assert.ok(
    slugHits.length >= 2,
    "the view must have at least two hidden slug inputs (one per ModifyPanel: update + delete)"
  );
});

/* -------------------------------------------------------------------------- */
/*  Migrations: no new DELETE grant added                                      */
/* -------------------------------------------------------------------------- */

test("no migration grants DELETE on guest_groups for this slice (2003 covers it, and DELETE is out of scope)", async () => {
  const migrations = await readdir(join(ROOT, MIGRATIONS_DIR));

  assert.ok(
    migrations.includes(UPDATE_GRANT_MIGRATION),
    `expected migration ${UPDATE_GRANT_MIGRATION} to still exist (its UPDATE grant covers PATCHing is_active)`
  );
  assert.ok(
    !migrations.includes(DELETE_GRANT_MIGRATION),
    "this slice must NOT add a DELETE-grant migration (no hard-delete is issued)"
  );

  // No migration file may GRANT DELETE on guest_groups — keep the schema
  // DELETE-free so the host's only destroy path is the soft-delete flip. We
  // match only real SQL `grant delete` statements (the existing 0003 comment
  // legitimately says "DELETE" in prose explaining what it does NOT grant).
  for (const name of migrations) {
    const src = await readSrc(join(MIGRATIONS_DIR, name));
    assert.doesNotMatch(
      src,
      /grant\s+delete\b/i,
      `migration ${name} must not GRANT DELETE on guest_groups (soft-delete reuses UPDATE from 0003)`
    );
  }

  // The 0003 UPDATE grant text must keep its original wording so the soft
  // delete PATCH continues to be authorized by it.
  const m3 = await readSrc(join(MIGRATIONS_DIR, UPDATE_GRANT_MIGRATION));
  assert.match(
    m3,
    /grant update on table public\.guest_groups to service_role;/,
    "0003 must keep its UPDATE grant on guest_groups (the soft delete PATCH reuses it)"
  );
  // 0003 must not have grown a real `grant delete` statement (its prose may
  // still mention DELETE in explanation, which is fine).
  assert.doesNotMatch(
    m3,
    /grant\s+delete\b/i,
    "0003 must not GRANT DELETE (only UPDATE; the word `delete` in prose is fine)"
  );
});