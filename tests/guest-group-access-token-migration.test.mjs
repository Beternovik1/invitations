import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/0008_add_guest_group_access_token.sql";

const readSrc = async (relativePath) =>
  readFile(join(ROOT, relativePath), "utf8");

const withoutSqlComments = (source) => source.replace(/--.*$/gm, "");

test("0008 adds a dedicated random UUID access token and safely requires it", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /alter table public\.guest_groups\s+add column access_token uuid null default gen_random_uuid\(\);/i,
    "access tokens must be additive, random UUIDs with a default for future rows",
  );
  assert.match(
    migration,
    /update public\.guest_groups\s+set access_token = gen_random_uuid\(\)\s+where access_token is null;/i,
    "every existing guest group must receive an access token",
  );

  const addToken = migration.indexOf("add column access_token");
  const backfillToken = migration.indexOf("set access_token = gen_random_uuid()");
  const requireToken = migration.indexOf("alter column access_token set not null");
  assert.ok(
    addToken !== -1 && addToken < backfillToken && backfillToken < requireToken,
    "nullable addition and backfill must precede the NOT NULL constraint",
  );
});

test("0008 makes access tokens unique without replacing id or slug identity", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /add constraint guest_groups_access_token_key unique \(access_token\)/i,
    "each capability token must identify exactly one guest group",
  );
  assert.doesNotMatch(
    migration,
    /primary key\s*\(access_token\)|alter\s+column\s+(id|slug)|drop\s+(column|constraint)|rename\s+(column|table)/i,
    "access_token must remain distinct from internal UUID and legacy slug identity",
  );
});

test("0008 stays inside the additive access-token foundation slice", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.doesNotMatch(
    migration,
    /public\.rsvps|guest_group_id|guest_group_slug|\b(grant|revoke)\b|\b(anon|authenticated)\b/i,
    "the token foundation must not change RSVP identity or database access",
  );
  assert.doesNotMatch(
    migration,
    /invitation_links?|\/i\/|src\/|components?|templates?|seating|qr\b|\bauth\b/i,
    "the migration must not add routes, links, UI, templates, seating, QR, or auth behavior",
  );
  assert.doesNotMatch(
    migration,
    /drop\s+(table|column|constraint)|truncate\b|delete\s+from|rename\s+(table|column)|create\s+(table|trigger|function)/i,
    "the migration must remain additive and avoid unrelated database objects",
  );
  assert.doesNotMatch(
    migration,
    /alter\s+table\s+(?!public\.guest_groups\b)/i,
    "guest_groups must be the only altered table",
  );
});
