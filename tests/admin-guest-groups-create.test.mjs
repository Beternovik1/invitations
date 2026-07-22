// Deterministic source-contract tests for the `Nueva invitación` create/
// reactivate flow.
//
// The repo's test style (see `admin-confirmations.test.mjs` and
// `admin-guest-groups-grant.test.mjs`) is deterministic source-contract tests:
// read source files from disk and assert externally-visible facts with
// `node:assert`, plus direct exercise of pure runtime-safe helpers. No network,
// no DB, no render — only `node:test` and `node:assert`.
//
// These tests pin down the slice's contract:
//   1. `slugifyGuestGroupName` produces slugs consistent with the existing
//      mock slugs in `src/lib/guest-groups.ts` (accents stripped, punctuation
//      dropped, spaces -> hyphens) and is deterministic/stable.
//   2. The new `GuestGroupCreateFormState`/slug error codes ship in the shared
//      client-safe module (no server imports).
//   3. The boundary `createOrReactivateGuestGroupForAdmin` branches INSERT vs
//      reactivate vs `slug_taken` against the existing row state, and validates
//      displayName/assignedSeats/slug.
//   4. The server impl exposes a SELECT-including-inactive helper, an INSERT
//      helper, and reuses the UPDATE helper for reactivation; the INSERT path
//      uses HTTP POST (requires the INSERT grant).
//   5. Migration 0004 grants INSERT on guest_groups to service_role without
//      touching the already-applied 0001/0003 grants.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  slugifyGuestGroupName,
  MAX_ASSIGNED_SEATS,
  MAX_SLUG_LENGTH,
} from "../src/lib/admin-guest-groups-shared.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const SHARED = "src/lib/admin-guest-groups-shared.ts";
const BOUNDARY = "src/lib/admin-guest-groups.ts";
const SERVER_IMPL = "src/lib/supabase/server.ts";
const ACTION = "src/app/admin/(dashboard)/guest-groups/actions.ts";
const MIGRATIONS_DIR = "supabase/migrations";
const INSERT_GRANT_MIGRATION = "0004_grant_insert_guest_groups.sql";

/* -------------------------------------------------------------------------- */
/*  slugifyGuestGroupName                                                      */
/* -------------------------------------------------------------------------- */

test("slugifyGuestGroupName: matches the existing mock slug conventions", () => {
  // Each tuple is `[displayName, expectedSlug]` taken from
  // src/lib/guest-groups.ts so the create flow stays consistent with the
  // seeded list — the whole point is that a host re-typing "Ma. de Jesús
  // Almanza y fam." lands on the same identifier the seed used.
  const cases = [
    ["Alfaro Padilla", "alfaro-padilla"],
    ["Alfaro Jiménez", "alfaro-jimenez"],
    ["Ávila Hernández", "avila-hernandez"],
    ["Ma. de Jesús Almanza y fam.", "ma-de-jesus-almanza-y-fam"],
    ["Fco. Rico Hernández", "fco-rico-hernandez"],
    ["Luis, Marcela y fam.", "luis-marcela-y-fam"],
    ["Tía Chuy", "tia-chuy"],
    ["Gutiérrez Mosqueda", "gutierrez-mosqueda"],
  ];
  for (const [name, expected] of cases) {
    assert.equal(
      slugifyGuestGroupName(name),
      expected,
      `"${name}" must slugify to the seeded slug \`${expected}\``
    );
  }
});

test("slugifyGuestGroupName: is lowercase, strips accents, drops punctuation, collapses spaces/hyphens, trims edges", () => {
  assert.equal(slugifyGuestGroupName("Jiménez"), "jimenez");
  assert.equal(slugifyGuestGroupName("García"), "garcia");
  assert.equal(slugifyGuestGroupName("Hernández Rocha"), "hernandez-rocha");
  // Punctuation (periods, commas, quotes, exclamation) is dropped, not turned
  // into hyphens, so `Ma.` becomes `ma` (not `ma-`).
  assert.equal(slugifyGuestGroupName("Ma. de Jesús"), "ma-de-jesus");
  // Double spaces and existing hyphens collapse to a single hyphen.
  assert.equal(slugifyGuestGroupName("Familia  García"), "familia-garcia");
  assert.equal(slugifyGuestGroupName("Familia--García"), "familia-garcia");
  // Leading/trailing hyphens (from surrounding punctuation/spaces) are trimmed.
  assert.equal(slugifyGuestGroupName(" ¡Hola! "), "hola");
  // Em-width or accented whitespace punctuation should not sneak through.
  assert.equal(slugifyGuestGroupName("Niño & Niña"), "nino-nina");
});

test("slugifyGuestGroupName: returns empty string for names with no alphanumerics", () => {
  for (const bad of ["", "   ", "!!!", "—", "...", "¡!¿?"]) {
    assert.equal(
      slugifyGuestGroupName(bad),
      "",
      `"${bad}" must slugify to empty (no alphanumerics)`
    );
  }
});

test("slugifyGuestGroupName: is deterministic (idempotent on its own output)", () => {
  // Idempotence: slugifying a slug keeps it stable, so re-running the helper
  // on a previously-derived slug never changes the identifier.
  const sample = "Familia García López";
  const once = slugifyGuestGroupName(sample);
  const twice = slugifyGuestGroupName(once);
  assert.equal(twice, once, "slugifying an existing slug is a no-op");
});

test("MAX_SLUG_LENGTH is a positive defensive ceiling", () => {
  assert.ok(
    typeof MAX_SLUG_LENGTH === "number" && MAX_SLUG_LENGTH > 0,
    "MAX_SLUG_LENGTH must be a positive number"
  );
});

test("MAX_ASSIGNED_SEATS is exactly 20 (the host's per-invitation seat cap)", () => {
  assert.equal(
    MAX_ASSIGNED_SEATS,
    20,
    "the per-invitation assigned-seats cap must be 20"
  );
  assert.ok(
    typeof MAX_ASSIGNED_SEATS === "number" &&
      Number.isInteger(MAX_ASSIGNED_SEATS) &&
      MAX_ASSIGNED_SEATS > 0,
    "MAX_ASSIGNED_SEATS must be a positive integer"
  );
});

/* -------------------------------------------------------------------------- */
/*  Shared module stays client-safe                                            */
/* -------------------------------------------------------------------------- */

test("the shared module still avoids server-only / Supabase imports (client-safe)", async () => {
  const shared = await readSrc(SHARED);

  // Strip doc-comment / line-comment lines before matching so an explanatory
  // doc comment like `* dynamic import("@/lib/supabase/server")` (which the
  // shared module's header uses to describe the convention) does not trigger
  // a false positive. Only REAL import statements on code lines are banned.
  const codeOnly = shared
    .split(/\n/)
    .filter((line) => !/^\s*(\*|\/\/)/.test(line))
    .join("\n");

  assert.doesNotMatch(
    codeOnly,
    /^import "server-only";?\s*$/m,
    "shared module must not run a top-level `import \"server-only\"` (client-safe)"
  );
  // And no real import (static or dynamic) of the server-only Supabase client.
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

test("the shared module exports the slugify helper and the new error codes", async () => {
  const shared = await readSrc(SHARED);

  assert.match(
    shared,
    /export function slugifyGuestGroupName\(/,
    "shared module must export `slugifyGuestGroupName`"
  );
  // The two new create-flow error codes must be part of the union so the
  // boundary can return them and the UI can branch on them without parsing
  // Spanish strings.
  assert.match(
    shared,
    /\|\s*"slug_empty"/,
    "shared module must include the `slug_empty` error code"
  );
  assert.match(
    shared,
    /\|\s*"slug_taken"/,
    "shared module must include the `slug_taken` error code"
  );
});

/* -------------------------------------------------------------------------- */
/*  Boundary (admin-guest-groups.ts)                                            */
/* -------------------------------------------------------------------------- */

test("boundary exports `createOrReactivateGuestGroupForAdmin` and re-exports the slugify helper", async () => {
  const boundary = await readSrc(BOUNDARY);

  assert.match(
    boundary,
    /export async function createOrReactivateGuestGroupForAdmin\(/,
    "boundary must export `createOrReactivateGuestGroupForAdmin`"
  );
  assert.match(
    boundary,
    /slugifyGuestGroupName,/,
    "boundary must re-export the slugify helper from the shared module"
  );
});

test("boundary: the three-way branch is explicitly present (insert / reactivate / slug_taken)", async () => {
  const boundary = await readSrc(BOUNDARY);

  // REACTIVATE: an inactive existing row must be re-activated via UPDATE,
  // preserving seats_note, flipping is_active to true.
  assert.match(
    boundary,
    /if \(existing\.isActive\)[\s\S]*?return \{ ok: false, error: error\("slug_taken"\) \};/,
    "boundary must reject a collision against an ACTIVE row as `slug_taken`"
  );
  assert.match(
    boundary,
    /await updateGuestGroupInSupabase\(slug, \{[\s\S]*?isActive: true,?[\s\S]*?\}\);/,
    "reactivate path must call updateGuestGroupInSupabase with isActive: true"
  );

  // INSERT: a genuinely new slug must call insertGuestGroupInSupabase.
  assert.match(
    boundary,
    /const created = await insertGuestGroupInSupabase\(slug,/,
    "insert path must call `insertGuestGroupInSupabase`"
  );

  // The boundary must look up the existing row INCLUDING inactive ones (the
  // normal public lookup hides inactive rows, which would defeat reactivation).
  assert.match(
    boundary,
    /findGuestGroupBySlugIncludingInactiveFromSupabase\(/,
    "boundary must look up the slug via the including-inactive helper"
  );

  // Validation: empty slug (from a name with no alphanumerics) must be
  // rejected as `slug_empty` BEFORE any Supabase call.
  assert.match(
    boundary,
    /const slug = slugifyGuestGroupName\(displayName\);[\s\S]*?error\("slug_empty"/,
    "boundary must derive the slug from displayName and reject empty as `slug_empty`"
  );
});

test("boundary: mock mode never pretends a create landed (unavailable error)", async () => {
  const boundary = await readSrc(BOUNDARY);

  // The create boundary must keep the same honesty contract as the update
  // boundary: in zero-config mode (no Supabase env) it returns `unavailable`
  // rather than fabricating a created group.
  assert.match(
    boundary,
    /if \(!isSupabaseConfigured\(\)\)[\s\S]*?return \{ ok: false, error: error\("unavailable"\) \};/,
    "boundary must return `unavailable` in mock mode (no fake creates)"
  );
});

/* -------------------------------------------------------------------------- */
/*  Server impl (supabase/server.ts)                                            */
/* -------------------------------------------------------------------------- */

test("server impl: exposes a select-including-inactive helper and an insert helper using POST", async () => {
  const impl = await readSrc(SERVER_IMPL);

  assert.match(
    impl,
    /export async function findGuestGroupBySlugIncludingInactiveFromSupabase\(/,
    "server impl must export `findGuestGroupBySlugIncludingInactiveFromSupabase`"
  );
  assert.match(
    impl,
    /export async function insertGuestGroupInSupabase\(/,
    "server impl must export `insertGuestGroupInSupabase`"
  );

  // The insert must NOT use merge-duplicates resolution: a collision here is a
  // genuine race or missed pre-check and should surface as an error, not a
  // silent overwrite. Pin the absence of `resolution=merge-duplicates` on the
  // insert path.
  assert.match(
    impl,
    /Prefer:\s*"return=representation"/,
    "insert helper must request `return=representation` to read back the row"
  );
  // Match the POST that targets the guest_groups endpoint. The insert helper
  // uses POST; the existing upsert for RSVPs uses POST too, so match the
  // insert helper's identifier to disambiguate.
  assert.match(
    impl,
    /insertGuestGroupInSupabase[\s\S]*?method:\s*"POST"/,
    "insert helper must issue a POST against guest_groups (requires INSERT grant)"
  );
  // The active lookup must NOT reuse the public inactive-hiding mapping.
  // Verify the new helper does not strip inactive rows (it must NOT call
  // `if (!row.is_active) return null`).
  const helperStart = impl.indexOf(
    "findGuestGroupBySlugIncludingInactiveFromSupabase"
  );
  const helperBody = impl.slice(helperStart, helperStart + 1200);
  assert.doesNotMatch(
    helperBody,
    /if \(!row\.is_active\) return null/,
    "the including-inactive helper must NOT drop inactive rows"
  );
});

/* -------------------------------------------------------------------------- */
/*  Migration 0004 (INSERT grant)                                             */
/* -------------------------------------------------------------------------- */

test("migration 0004 exists and grants INSERT on guest_groups to service_role", async () => {
  const migrations = await readdir(join(ROOT, MIGRATIONS_DIR));
  assert.ok(
    migrations.includes(INSERT_GRANT_MIGRATION),
    `expected migration ${INSERT_GRANT_MIGRATION} to exist in ${MIGRATIONS_DIR}`
  );

  const src = await readSrc(join(MIGRATIONS_DIR, INSERT_GRANT_MIGRATION));

  assert.match(
    src,
    /grant insert on table public\.guest_groups to service_role;/,
    "0004 must grant INSERT on public.guest_groups to service_role"
  );
  // Do not grant DELETE in the create-flow migration (Eliminar is deferred).
  // UPDATE was already granted by 0003 and is reused for the reactivate path,
  // so 0004 should not re-issue it either.
  assert.doesNotMatch(
    src,
    /\b(delete|update)\b.*public\.guest_groups/i,
    "0004 must not widen DELETE/UPDATE on guest_groups (out of scope for this slice)"
  );
});

test("migrations 0001 and 0003 stay untouched (no INSERT grant leaked into them)", async () => {
  const m1 = await readSrc(join(MIGRATIONS_DIR, "0001_create_guest_groups.sql"));
  assert.doesNotMatch(
    m1,
    /grant\s+insert\b/i,
    "0001 must keep its original SELECT-only grant (no INSERT reshuffling)"
  );
  const m3 = await readSrc(join(MIGRATIONS_DIR, "0003_grant_update_guest_groups.sql"));
  assert.doesNotMatch(
    m3,
    /grant\s+insert\b/i,
    "0003 must stay UPDATE-only (the create grant lives in 0004)"
  );
});

/* -------------------------------------------------------------------------- */
/*  Server action                                                              */
/* -------------------------------------------------------------------------- */

test("action: `createGuestGroupAction` parses displayName + assignedSeats the same way as the update action (blank seats => null)", async () => {
  const action = await readSrc(ACTION);

  // Blank seats must short-circuit to `null` BEFORE Number coercion, otherwise
  // Number("") === 0 would silently turn "pending" into a 0-seat group (which
  // is semantically "0 attending", a different state).
  assert.match(
    action,
    /rawAssignedSeats === ""/,
    "create action must short-circuit blank assignedSeats to null"
  );
  assert.match(
    action,
    /assignedSeats[\s\S]*?\?\s*null/,
    "create action must map blank to null"
  );
});

/* -------------------------------------------------------------------------- */
/*  Assigned-seats cap (MAX_ASSIGNED_SEATS = 20)                               */
/* -------------------------------------------------------------------------- */

const VIEW =
  "src/app/admin/(dashboard)/confirmaciones/ConfirmationsView.tsx";

test("shared module exports the `assigned_seats_too_many` error code so the UI can branch on the cap", async () => {
  const shared = await readSrc(SHARED);

  assert.match(
    shared,
    /export const MAX_ASSIGNED_SEATS = 20;/,
    "shared module must export `MAX_ASSIGNED_SEATS` pinned to 20"
  );
  // The new error code must be part of the union so the boundary can return it
  // and the UI can branch without parsing Spanish strings.
  assert.match(
    shared,
    /\|\s*"assigned_seats_too_many"/,
    "shared module must include the `assigned_seats_too_many` error code"
  );
});

test("boundary re-exports MAX_ASSIGNED_SEATS so server callers share the single constant with the client", async () => {
  const boundary = await readSrc(BOUNDARY);

  assert.match(
    boundary,
    /MAX_ASSIGNED_SEATS,/,
    "boundary must import MAX_ASSIGNED_SEATS from the shared module"
  );
  assert.match(
    boundary,
    /export \{[\s\S]*?MAX_ASSIGNED_SEATS,[\s\S]*?\}/,
    "boundary must re-export MAX_ASSIGNED_SEATS"
  );
});

test("create boundary rejects assignedSeats above the cap with a clear Spanish `assigned_seats_too_many` error (server-side, not only client HTML)", async () => {
  const boundary = await readSrc(BOUNDARY);

  // The create path must enforce the cap server-side: a tampered client
  // bypassing the HTML `max` cannot land a 100-seat group.
  assert.match(
    boundary,
    /assignedSeats !== null && assignedSeats > MAX_ASSIGNED_SEATS/,
    "create boundary must guard assignedSeats against MAX_ASSIGNED_SEATS"
  );
  assert.match(
    boundary,
    /error\("assigned_seats_too_many", \{[\s\S]*?No puedes asignar más de \$\{MAX_ASSIGNED_SEATS\} lugares por invitación\./,
    "create boundary must surface the clear Spanish over-cap message"
  );
});

test("update boundary also rejects assignedSeats above the cap (the modify flow shares the same constant)", async () => {
  const boundary = await readSrc(BOUNDARY);

  // The update path used by the confirmaciones `Modificar` panel must enforce
  // the SAME cap so the create flow cannot be bypassed by editing an existing
  // group to a huge number.
  const updateIdx = boundary.indexOf("updateGuestGroupForAdmin");
  const updateSlice = boundary.slice(updateIdx);
  assert.match(
    updateSlice,
    /assignedSeats !== null && assignedSeats > MAX_ASSIGNED_SEATS/,
    "update boundary must also guard assignedSeats against MAX_ASSIGNED_SEATS"
  );
});

test("client create and modify inputs (confirmaciones) carry the HTML `max` so the host cannot type past 20 by accident", async () => {
  const view = await readSrc(VIEW);

  // The view must import the shared constant so the input max and the server
  // validation never drift apart.
  assert.match(
    view,
    /MAX_ASSIGNED_SEATS,/,
    "view must import MAX_ASSIGNED_SEATS from the shared module"
  );

  // Both assignedSeats inputs (the create panel and the inline Modificar
  // panel) must carry the `max` attribute. There are exactly two
  // `name="assignedSeats"` number inputs in this view.
  const maxHits = view.match(/max=\{MAX_ASSIGNED_SEATS\}/g) ?? [];
  assert.equal(
    maxHits.length,
    2,
    "both assignedSeats inputs on the confirmaciones view must carry `max={MAX_ASSIGNED_SEATS}`"
  );
});

// The legacy `/admin/guest-groups` editor (`GuestGroupEditor.tsx`) was removed
// when Confirmaciones became the single official admin route — its inline
// `Modificar` panel now covers the same update flow. There is therefore no
// separate editor surface left to assert the shared `max` cap against; the
// confirmaciones view test above is the single source of truth for the
// `MAX_ASSIGNED_SEATS` HTML guard.
