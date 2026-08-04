import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (relativePath) =>
  readFile(join(ROOT, relativePath), "utf8");

const withoutComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const sliceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `expected start marker: ${startMarker}`);

  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `expected end marker: ${endMarker}`);
  return source.slice(start, end);
};

const assertOrdered = (source, markers, message) => {
  const positions = markers.map((marker) => source.indexOf(marker));
  assert.ok(
    positions.every((position) => position !== -1),
    `${message}: every marker must exist`,
  );
  assert.ok(
    positions.every((position, index) => index === 0 || positions[index - 1] < position),
    `${message}: markers must appear in control-flow order`,
  );
};

const PAGE = "src/app/i/[slug]/page.tsx";
const RSVP_SECTION = "src/components/sections/Rsvp.tsx";
const RSVP_BOUNDARY = "src/lib/rsvps.ts";
const SUPABASE_SERVER = "src/lib/supabase/server.ts";
const ADMIN_BOUNDARY = "src/lib/admin-guest-groups.ts";
const RSVP_MIGRATION = "supabase/migrations/0002_create_rsvps.sql";

test("the public route resolves group by token-capable identifier but reads RSVP by legacy slug", async () => {
  const page = withoutComments(await readSrc(PAGE));
  const invitationPage = page.slice(
    page.indexOf("export default async function InvitationPage"),
  );

  assertOrdered(
    invitationPage,
    [
      "const { slug } = await params;",
      "const group = await getGuestGroupByIdentifier(slug);",
      "if (!group) notFound();",
      "const initialRsvp = await getRsvpBySlug(group.slug);",
    ],
    "InvitationPage must resolve by identifier but keep RSVP reads slug-keyed",
  );

  const rsvpSection = sliceBetween(invitationPage, "<RsvpSection", "/>");
  assertOrdered(
    rsvpSection,
    ["<RsvpSection", "group={group}", "initialRsvp={initialRsvp}"],
    "RsvpSection must receive the group and RSVP resolved by InvitationPage",
  );
});

test("missing and inactive public groups become null before mapping, then reach notFound before page return", async () => {
  const server = withoutComments(await readSrc(SUPABASE_SERVER));
  const lookup = sliceBetween(
    server,
    "async function fetchSingleGuestGroupByFilterFromSupabase",
    "export async function fetchGuestGroupByIdentifierFromSupabase",
  );

  assertOrdered(
    lookup,
    [
      "const row = rows[0];",
      "if (!row) return null;",
      "if (!row.is_active) return null;",
      "return mapRow(row);",
    ],
    "the missing and inactive guards must run before row mapping",
  );

  const page = withoutComments(await readSrc(PAGE));
  const invitationPage = page.slice(
    page.indexOf("export default async function InvitationPage"),
  );
  assertOrdered(
    invitationPage,
    [
      "const group = await getGuestGroupByIdentifier(slug);",
      "if (!group) notFound();",
      "const initialRsvp = await getRsvpBySlug(group.slug);",
      "return (",
    ],
    "a null public lookup must stop at notFound before RSVP work or rendering",
  );
});

test("Supabase public route lookup checks access_token before legacy slug fallback", async () => {
  const server = withoutComments(await readSrc(SUPABASE_SERVER));
  const lookup = sliceBetween(
    server,
    "export async function fetchGuestGroupByIdentifierFromSupabase",
    "export async function fetchGuestGroupBySlugFromSupabase",
  );

  assertOrdered(
    lookup,
    [
      "if (isUuidIdentifier(identifier))",
      "`access_token=eq.${encodeURIComponent(identifier)}`",
      "if (byAccessToken) return byAccessToken;",
      "return fetchGuestGroupBySlugFromSupabase(identifier);",
    ],
    "identifier lookup must prefer access_token and then fall back to legacy slug",
  );
  assert.match(
    server,
    /function isUuidIdentifier\(identifier: string\): boolean[\s\S]*?\.test\(\s*identifier\s*\)/,
    "legacy non-UUID slugs must not be sent to a uuid access_token filter before fallback",
  );
});

test("the executable RSVP action binding uses group.slug", async () => {
  const section = withoutComments(await readSrc(RSVP_SECTION));
  const component = section.slice(
    section.indexOf("export default function RsvpSection"),
  );

  assert.match(
    component,
    /const boundAction = rsvpEnabled\s*\?\s*submitRsvpAction\.bind\(null, group\.slug\)\s*:\s*null;/,
    "the live Server Action binding must use the rendered group's slug",
  );
  assert.match(
    component,
    /useActionState<RsvpFormState, FormData>\(\s*boundAction \?\? noopAction,/,
    "the group-slug-bound action must be the action executed by the forms",
  );
});

test("the RSVP server boundary re-resolves the group and validates integer range before persistence", async () => {
  const boundary = withoutComments(await readSrc(RSVP_BOUNDARY));
  const submit = boundary.slice(boundary.indexOf("export async function submitRsvp"));

  assertOrdered(
    submit,
    [
      "const group = await getGuestGroupBySlug(slug);",
      "if (!group)",
      "if (group.assignedSeats == null)",
      "!Number.isInteger(attendingCount)",
      "attendingCount < 0",
      "attendingCount > group.assignedSeats",
      "const rsvp = await upsertRsvpInSupabase(slug, attendingCount, message);",
    ],
    "group resolution and count validation must precede the RSVP write",
  );
});

test("Supabase reads and merging upserts use guest_group_slug as the single RSVP row identity", async () => {
  const server = withoutComments(await readSrc(SUPABASE_SERVER));
  const readRsvp = sliceBetween(
    server,
    "export async function fetchRsvpBySlugFromSupabase",
    "interface GuestGroupWithRsvpRow",
  );
  const upsertRsvp = server.slice(
    server.indexOf("export async function upsertRsvpInSupabase"),
  );
  const migration = withoutComments(await readSrc(RSVP_MIGRATION));

  assert.match(
    readRsvp,
    /\?guest_group_slug=eq\.\$\{encodeURIComponent\(slug\)\}/,
    "RSVP reads must filter by guest_group_slug",
  );
  assert.match(
    upsertRsvp,
    /Prefer:\s*"return=representation,resolution=merge-duplicates"/,
    "repeated submissions must merge rather than create duplicate RSVP rows",
  );
  assert.match(
    upsertRsvp,
    /body:\s*JSON\.stringify\(\{\s*guest_group_slug:\s*slug,\s*attending_count:\s*attendingCount,\s*message,?\s*\}\)/,
    "RSVP upserts must persist the route identity in guest_group_slug",
  );
  assert.match(
    migration,
    /guest_group_slug text primary key references public\.guest_groups\(slug\) on delete cascade,/,
    "the database key must keep one RSVP row per guest-group slug",
  );
});

test("in-place reactivation preserves the slug-keyed RSVP foreign-key target", async () => {
  const boundary = withoutComments(await readSrc(ADMIN_BOUNDARY));
  const reactivation = sliceBetween(
    boundary,
    "if (existing) {",
    "const created = await insertGuestGroupInSupabase",
  );
  const migration = withoutComments(await readSrc(RSVP_MIGRATION));

  assert.match(
    reactivation,
    /updateGuestGroupInSupabase\(slug, \{[\s\S]*?isActive:\s*true,/,
    "reactivation must update the existing row selected by the same slug",
  );
  assert.doesNotMatch(
    reactivation,
    /insertGuestGroupInSupabase|softDeleteGuestGroupInSupabase|method:\s*"DELETE"/,
    "reactivation must not replace or delete the guest-group row",
  );
  assert.match(
    migration,
    /guest_group_slug text primary key references public\.guest_groups\(slug\) on delete cascade,/,
    "retaining the guest_groups.slug row retains the existing RSVP linkage",
  );
});
