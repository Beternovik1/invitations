// Source-contract test for the admin guest-group update grant.
//
// The repo's test style is deterministic source-contract tests: read source
// files from disk and assert externally-visible facts with node:assert. No
// network, no DB, no render. The same style is used in
// `rsvp-section.test.mjs`.
//
// The bug: migration 0001 granted only SELECT on public.guest_groups to
// service_role, so admin PATCH/UPDATE saves failed with a permission error
// surfaced as "Ocurrió un problema al guardar este grupo". Migration 0003
// widens the grant to include UPDATE. This test pins that down so a future
// regression (e.g. someone editing 0001 to remove UPDATE, or dropping 0003)
// fails the suite instead of breaking admin saves in prod again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = "supabase/migrations";
const EDITOR_ACTION = "src/app/admin/(dashboard)/guest-groups/actions.ts";
const BOUNDARY = "src/lib/admin-guest-groups.ts";
const SERVER_ACTION_IMPL = "src/lib/supabase/server.ts";

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

// The UPDATE grant is provided by migration 0003 (a separate file, so applied
// migration 0001 stays untouched). Hard-coding the filename keeps this test
// honest: if someone renames or deletes 0003, the test must fail loudly.
const UPDATE_GRANT_MIGRATION = "0003_grant_update_guest_groups.sql";

test("migration 0001 stays read-only on guest_groups (no UPDATE grant)", async () => {
  const src = await readSrc(join(MIGRATIONS_DIR, "0001_create_guest_groups.sql"));

  // The historical/intentional narrow grant. Editing 0001 to add UPDATE would
  // silently rewrite an already-applied prod migration, which we forbid.
  assert.match(
    src,
    /grant select on table public\.guest_groups to service_role;/,
    "0001 must keep its original SELECT-only grant",
  );
  // Forbid a GRANT of UPDATE in 0001 (allow the `before update` trigger,
  // which is not a privilege grant). Adding UPDATE to 0001 would silently
  // rewrite an already-applied prod migration; use migration 0003 instead.
  assert.doesNotMatch(
    src,
    /grant\s+update\b/i,
    "0001 must not GRANT UPDATE (use migration 0003 instead)",
  );
});

test("migration 0003 grants UPDATE on guest_groups to service_role", async () => {
  const migrations = await readdir(join(ROOT, MIGRATIONS_DIR));

  assert.ok(
    migrations.includes(UPDATE_GRANT_MIGRATION),
    `expected migration ${UPDATE_GRANT_MIGRATION} to exist in ${MIGRATIONS_DIR}`,
  );

  const src = await readSrc(join(MIGRATIONS_DIR, UPDATE_GRANT_MIGRATION));

  // One explicit, narrow grant of UPDATE (not INSERT/DELETE) to the same role
  // and table 0001 used.
  assert.match(
    src,
    /grant update on table public\.guest_groups to service_role;/,
    "0003 must grant UPDATE on public.guest_groups to service_role",
  );
  assert.doesNotMatch(
    src,
    /\b(insert|delete)\b.*public\.guest_groups/i,
    "0003 must not widen INSERT/DELETE on guest_groups (out of scope for this slice)",
  );
});

test("admin guest-groups code path actually issues an UPDATE against guest_groups", async () => {
  // Proves the grant is needed: the boundary + server impl must reference a
  // guest_groups update. If the write path is ever removed, the grant becomes
  // dead config and this test catches it before the privilege drifts.
  const action = await readSrc(EDITOR_ACTION);
  assert.match(
    action,
    /updateGuestGroupForAdmin\(/,
    "admin action must call updateGuestGroupForAdmin",
  );

  const boundary = await readSrc(BOUNDARY);
  assert.match(
    boundary,
    /updateGuestGroupInSupabase\(/,
    "boundary must call updateGuestGroupInSupabase",
  );

  const impl = await readSrc(SERVER_ACTION_IMPL);

  // The server impl issues a raw PostgREST PATCH against /rest/v1/guest_groups
  // (not the supabase-js `.update()` chain), so the grant test must match the
  // real path. The REST_PATH constant points at the guest_groups endpoint and
  // the fetch uses method: "PATCH".
  assert.match(
    impl,
    /const REST_PATH = "\/rest\/v1\/guest_groups";/,
    "server impl must target the guest_groups REST endpoint",
  );
  assert.match(
    impl,
    /method:\s*"PATCH"/,
    "server impl must issue a PATCH against guest_groups (requires UPDATE grant)",
  );
});