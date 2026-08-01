import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/0006_add_event_guest_group_identity.sql";
const GUEST_GROUPS_MIGRATION = "supabase/migrations/0001_create_guest_groups.sql";
const CURRENT_EVENT_ID = "4d7634e2-1f61-4e94-9b44-26f93144d534";
const CURRENT_EVENT_KEY = "sarahi-xv-2026";

const readSrc = async (relativePath) =>
  readFile(join(ROOT, relativePath), "utf8");

const withoutSqlComments = (source) => source.replace(/--.*$/gm, "");

test("0006 creates and seeds exactly the verified current event with server-only read access", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /create table if not exists public\.events\s*\(\s*id uuid primary key default gen_random_uuid\(\),\s*event_key text not null unique\s*\);/,
    "events must contain only UUID identity and a stable unique event key",
  );
  assert.equal(
    migration.match(/insert into public\.events/gi)?.length,
    1,
    "the migration must insert exactly one event row",
  );
  assert.match(
    migration,
    new RegExp(
      `values\\s*\\(\\s*'${CURRENT_EVENT_ID}',\\s*'${CURRENT_EVENT_KEY}'\\s*\\);`,
      "i",
    ),
    "the seeded row must use the stable identity and verified Sarahí XV event key",
  );
  assert.match(
    migration,
    /grant select on table public\.events to service_role;/i,
    "only the server service role needs event reads",
  );
  assert.doesNotMatch(
    migration,
    /grant\s+[^;]+\s+to\s+(anon|authenticated)\b/i,
    "browser roles must not receive event-table privileges",
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(insert|update|delete|all)\b[^;]*public\.events/i,
    "the event seed does not require runtime write grants",
  );
});

test("0006 adds UUID and event identity, safely backfills both, then requires them", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /alter table public\.guest_groups\s+add column id uuid null default gen_random_uuid\(\),\s+add column event_id uuid null default '[0-9a-f-]+'::uuid;/i,
    "both columns must be additive and defaults must preserve existing inserts",
  );
  assert.match(
    migration,
    /update public\.guest_groups\s+set id = gen_random_uuid\(\)\s+where id is null;/i,
    "every existing guest group must receive a UUID",
  );
  assert.match(
    migration,
    new RegExp(
      `update public\\.guest_groups\\s+set event_id = \\(\\s*select id\\s+from public\\.events\\s+where event_key = '${CURRENT_EVENT_KEY}'\\s*\\)\\s+where event_id is null;`,
      "i",
    ),
    "every existing guest group must be attached to the seeded current event",
  );

  const backfillId = migration.indexOf("set id = gen_random_uuid()");
  const backfillEvent = migration.indexOf("set event_id = (");
  const requireId = migration.indexOf("alter column id set not null");
  const requireEvent = migration.indexOf("alter column event_id set not null");
  assert.ok(
    backfillId !== -1 && backfillId < requireId,
    "UUID backfill must precede its NOT NULL constraint",
  );
  assert.ok(
    backfillEvent !== -1 && backfillEvent < requireEvent,
    "event backfill must precede its NOT NULL constraint",
  );
});

test("0006 makes UUID unique and event_id foreign-keyed to the current event root", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /add constraint guest_groups_id_key unique \(id\)/i,
    "guest-group UUID identity must be unique without becoming the primary key",
  );
  assert.match(
    migration,
    /add constraint guest_groups_event_id_fkey\s+foreign key \(event_id\) references public\.events\(id\)/i,
    "event_id must reference the event root",
  );
  assert.match(
    migration,
    new RegExp(
      `add column event_id uuid null default '${CURRENT_EVENT_ID}'::uuid`,
      "i",
    ),
    "new rows from the unchanged application path must default to the current event",
  );
});

test("0006 explicitly preserves slug as the physical guest_groups primary key", async () => {
  const original = withoutSqlComments(await readSrc(GUEST_GROUPS_MIGRATION));
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    original,
    /slug text primary key,/i,
    "0001 establishes the legacy slug primary-key contract",
  );
  assert.doesNotMatch(
    migration,
    /alter table public\.guest_groups[\s\S]*?(drop constraint|drop column|alter column slug|add primary key|primary key \()/i,
    "0006 must not replace, remove, or mutate the slug primary key",
  );
});

test("0006 stays inside the additive event and guest-group identity slice", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.doesNotMatch(
    migration,
    /public\.rsvps|guest_group_slug|invitation_links?|tokens?|\/i\/|src\/|components?|templates?|seating|qr\b/i,
    "the migration must not touch RSVP, links, routes, UI, tokens, templates, seating, or QR behavior",
  );
  assert.doesNotMatch(
    migration,
    /drop\s+(table|column|constraint)|truncate\b|delete\s+from|alter\s+column\s+slug|rename\s+(table|column)/i,
    "the migration must not contain destructive schema or data operations",
  );
  assert.doesNotMatch(
    migration,
    /create\s+table\s+(?!if\s+not\s+exists\s+public\.events\b)|alter\s+table\s+(?!public\.guest_groups\b)/i,
    "events and guest_groups must be the only schema surfaces in this slice",
  );
});
