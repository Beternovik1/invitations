import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/0009_add_event_seating_foundation.sql";

const readSrc = async (relativePath) =>
  readFile(join(ROOT, relativePath), "utf8");

const withoutSqlComments = (source) => source.replace(/--.*$/gm, "");

test("0009 creates reusable event-scoped seating tables with UUID identity", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /create table if not exists public\.event_tables\s*\(\s*id uuid primary key default gen_random_uuid\(\),\s*event_id uuid not null references public\.events\(id\) on delete cascade,\s*label text not null check \(length\(btrim\(label\)\) > 0\),\s*capacity integer not null check \(capacity > 0\),\s*display_order integer not null check \(display_order > 0\),/i,
    "event tables must be reusable, event-scoped, and use seating table UUIDs",
  );
  assert.match(
    migration,
    /constraint event_tables_event_id_id_key unique \(event_id, id\)/i,
    "event table UUIDs must also be valid event-scoped FK targets",
  );
  assert.match(
    migration,
    /constraint event_tables_event_id_label_key unique \(event_id, label\)/i,
    "table labels should be unique within one event only",
  );
  assert.match(
    migration,
    /constraint event_tables_event_id_display_order_key unique \(event_id, display_order\)/i,
    "display order should be unique within one event only",
  );
});

test("0009 assigns one current table per guest group per event", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /create table if not exists public\.guest_group_table_assignments\s*\(\s*event_id uuid not null references public\.events\(id\) on delete cascade,\s*guest_group_id uuid not null,\s*table_id uuid not null,/i,
    "assignments must use event, guest-group UUID, and seating-table UUID relationships",
  );
  assert.match(
    migration,
    /constraint guest_group_table_assignments_pkey primary key \(event_id, guest_group_id\)/i,
    "a guest group must have at most one current table assignment per event",
  );
  assert.match(
    migration,
    /constraint guest_group_table_assignments_guest_group_fkey\s+foreign key \(event_id, guest_group_id\)\s+references public\.guest_groups\(event_id, id\)\s+on delete cascade/i,
    "guest-group assignments must be event-scoped and cascade when the group is removed",
  );
  assert.match(
    migration,
    /constraint guest_group_table_assignments_table_fkey\s+foreign key \(event_id, table_id\)\s+references public\.event_tables\(event_id, id\)\s+on delete cascade/i,
    "table assignments must be event-scoped and cascade when the table is removed",
  );
});

test("0009 keeps seating additive, server-only, and free of deferred features", async () => {
  const migration = withoutSqlComments(await readSrc(MIGRATION));

  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.event_tables to service_role;/i,
    "server-side admin flows need narrow service-role access to seating tables",
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.guest_group_table_assignments to service_role;/i,
    "server-side admin flows need narrow service-role access to seating assignments",
  );
  assert.doesNotMatch(
    migration,
    /grant\s+[^;]+\s+to\s+(anon|authenticated)\b/i,
    "browser roles must not receive seating table privileges",
  );
  assert.doesNotMatch(
    migration,
    /insert\s+into|values\s*\(|sarahi|alvori|invitation_links?|tokens?|\/i\/|src\/|components?|templates?|qr\b|check-?in|route/i,
    "the migration must not seed event-specific tables or add routes, links, tokens, UI, QR, or check-in behavior",
  );
  assert.doesNotMatch(
    migration,
    /public\.rsvps|guest_group_slug|drop\s+(table|column)|truncate\b|delete\s+from|rename\s+(table|column)|alter\s+column\s+slug/i,
    "the seating foundation must not touch RSVP, slug compatibility, or destructive operations",
  );
});
