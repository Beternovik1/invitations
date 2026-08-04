import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/0007_add_rsvp_guest_group_identity.sql";
const RSVP_MIGRATION = "supabase/migrations/0002_create_rsvps.sql";
const SUPABASE_SERVER = "src/lib/supabase/server.ts";

const readSrc = async (relativePath) =>
  readFile(join(ROOT, relativePath), "utf8");

const withoutSqlComments = (source) => source.replace(/--.*$/gm, "");

const assertOrdered = (source, markers, message) => {
  const positions = markers.map((marker) => source.indexOf(marker));
  assert.ok(
    positions.every((position) => position !== -1),
    `${message}: every marker must exist`,
  );
  assert.ok(
    positions.every(
      (position, index) => index === 0 || positions[index - 1] < position,
    ),
    `${message}: markers must appear in migration order`,
  );
};

test("0007 adds the nullable UUID, backfills by slug, then installs compatibility before NOT NULL", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /alter table public\.rsvps\s+add column guest_group_id uuid null;/i,
    "guest_group_id must begin as an additive nullable column",
  );
  assert.match(
    migration,
    /update public\.rsvps as rsvp\s+set guest_group_id = guest_group\.id\s+from public\.guest_groups as guest_group\s+where rsvp\.guest_group_slug = guest_group\.slug\s+and rsvp\.guest_group_id is null;/i,
    "existing RSVPs must copy the UUID resolved from their slug",
  );
  assertOrdered(
    migration,
    [
      "add column guest_group_id uuid null",
      "update public.rsvps as rsvp",
      "create or replace function public.resolve_rsvp_guest_group_id()",
      "create trigger rsvps_resolve_guest_group_id",
      "alter column guest_group_id set not null",
    ],
    "nullable addition, backfill, trigger setup, and constraint tightening",
  );
});

test("0007 resolves current slug-only inserts and updates to stable UUID identity", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /select guest_group\.id\s+into resolved_guest_group_id\s+from public\.guest_groups as guest_group\s+where guest_group\.slug = new\.guest_group_slug;/i,
    "the trigger must resolve guest_groups.id from the current slug input",
  );
  assert.match(
    migration,
    /new\.guest_group_id = resolved_guest_group_id;\s+return new;/i,
    "slug-only writes must receive the resolved UUID before persistence",
  );
  assert.match(
    migration,
    /create trigger rsvps_resolve_guest_group_id\s+before insert or update on public\.rsvps\s+for each row\s+execute function public\.resolve_rsvp_guest_group_id\(\);/i,
    "all current RSVP inserts and updates must pass through compatibility resolution",
  );
});

test("0007 rejects unresolved slugs and mismatched provided UUIDs", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /if resolved_guest_group_id is null then\s+raise foreign_key_violation using[\s\S]*?constraint = 'rsvps_guest_group_slug_fkey';/i,
    "an unresolved slug must raise a clear foreign-key-style error",
  );
  assert.match(
    migration,
    /if new\.guest_group_id is not null\s+and new\.guest_group_id <> resolved_guest_group_id then\s+raise check_violation using[\s\S]*?constraint = 'rsvps_guest_group_identity_match';/i,
    "a caller-provided UUID must not disagree with the slug-resolved UUID",
  );
});

test("0007 adds unique UUID identity and a cascade FK without promoting it to primary key", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /add constraint rsvps_guest_group_id_key unique \(guest_group_id\)/i,
    "one stable guest-group UUID must identify at most one RSVP",
  );
  assert.match(
    migration,
    /add constraint rsvps_guest_group_id_fkey\s+foreign key \(guest_group_id\) references public\.guest_groups\(id\) on delete cascade/i,
    "the UUID FK must match the legacy slug FK delete behavior",
  );
  assert.doesNotMatch(
    migration,
    /primary key\s*\(guest_group_id\)|alter column guest_group_id add generated|drop constraint/i,
    "UUID identity must not replace or remove the current primary key",
  );
});

test("0007 preserves the slug PK/FK and the application keeps its slug write contract", async () => {
  const original = withoutSqlComments(await readSrc(RSVP_MIGRATION));
  const migration = withoutSqlComments(await readSrc(MIGRATION));
  const server = await readSrc(SUPABASE_SERVER);

  assert.match(
    original,
    /guest_group_slug text primary key references public\.guest_groups\(slug\) on delete cascade,/i,
    "0002 must retain the slug primary key, FK, and cascade behavior",
  );
  assert.doesNotMatch(
    migration,
    /drop\s+(column|constraint)|alter\s+column\s+guest_group_slug|rename\s+(column|table)/i,
    "0007 must not mutate or remove legacy slug identity",
  );
  assert.match(
    server,
    /body:\s*JSON\.stringify\(\{\s*guest_group_slug:\s*slug,\s*attending_count:\s*attendingCount,\s*message,?\s*\}\)/,
    "the application must continue sending slug-only RSVP identity",
  );
});

test("the admin embed explicitly selects the stable UUID FK relationship", async () => {
  const server = await readSrc(SUPABASE_SERVER);

  assert.match(
    server,
    /rsvps!rsvps_guest_group_id_fkey\(\$\{RSVP_COLUMNS\}\)/,
    "admin RSVP reads must use the stable UUID FK and keep the PostgREST embed unambiguous",
  );
});

test("0007 remains narrow, additive, server-only, and free of deferred features", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.doesNotMatch(
    migration,
    /\b(grant|revoke)\b|\b(anon|authenticated)\b/i,
    "identity linkage must not change database access",
  );
  assert.doesNotMatch(
    migration,
    /invitation_links?|tokens?|\/i\/|src\/|components?|templates?|seating|qr\b|\bauth\b/i,
    "the migration must not add routes, links, tokens, UI, templates, seating, QR, or auth",
  );
  assert.doesNotMatch(
    migration,
    /drop\s+(table|column|constraint)|truncate\b|delete\s+from|rename\s+(table|column)/i,
    "the migration must not contain destructive schema or data changes",
  );
  assert.doesNotMatch(
    migration,
    /create\s+table|alter\s+table\s+(?!public\.rsvps\b)/i,
    "rsvps must be the only altered table",
  );
});
