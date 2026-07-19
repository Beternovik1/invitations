// Deterministic source-contract tests for the countdown section slice.
//
// The repo has no JS test harness yet, so these read the section's source
// files from disk and assert the externally-visible contract reviewers asked
// for. They make no network calls, touch no clock, and depend only on
// `node:test` + `node:assert` — built into Node, no deps added.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const INVITATION = "src/components/InvitationContent.tsx";
const SECTION = "src/components/sections/CountdownSection.tsx";
const SHARED_COUNTDOWN = "src/components/ui/Countdown.tsx";
const REMOVED_HOOK = "src/lib/useCountdownParts.ts";

test("InvitationContent renders CountdownSection after BlessingHosts and before rsvpSlot", async () => {
  const src = await readSrc(INVITATION);

  // Import is present.
  assert.match(
    src,
    /import\s+CountdownSection\s+from\s+"@\/components\/sections\/CountdownSection"/,
    "CountdownSection must be imported from its section module",
  );

  // The JSX order: <BlessingHosts />, then <CountdownSection />, then {rsvpSlot}.
  const blessingIdx = src.indexOf("<BlessingHosts />");
  const countdownIdx = src.indexOf("<CountdownSection />");
  const rsvpIdx = src.indexOf("{rsvpSlot}");

  assert.notEqual(blessingIdx, -1, "<BlessingHosts /> must appear in the tree");
  assert.notEqual(countdownIdx, -1, "<CountdownSection /> must appear in the tree");
  assert.notEqual(rsvpIdx, -1, "{rsvpSlot} must appear in the tree");

  assert.ok(
    blessingIdx < countdownIdx,
    "<CountdownSection /> must come after <BlessingHosts />",
  );
  assert.ok(
    countdownIdx < rsvpIdx,
    "<CountdownSection /> must come before {rsvpSlot}",
  );
});

test("CountdownSection uses the /photo/count_down.jpeg background image", async () => {
  const src = await readSrc(SECTION);
  assert.match(
    src,
    /["'`]?\/photo\/count_down\.jpeg["'`]?/,
    "section must reference the /photo/count_down.jpeg asset",
  );
});

test("CountdownSection renders the dias / hrs / min / seg labels verbatim", async () => {
  const src = await readSrc(SECTION);
  for (const label of ["dias", "hrs", "min", "seg"]) {
    assert.match(
      src,
      new RegExp(`label:\\s*"${label}"`),
      `UNITS must include label "${label}" verbatim (no accents, lowercase)`,
    );
  }
});

test("CountdownSection computes the countdown locally from EVENT.startISO + getCountdown/pad2", async () => {
  const src = await readSrc(SECTION);

  // Local imports from the time helpers + constants — not from a shared hook.
  assert.match(src, /from\s+"@\/lib\/constants"/, 'must import EVENT from "@/lib/constants"');
  assert.match(src, /from\s+"@\/lib\/time"/, 'must import from "@/lib/time"');
  assert.match(src, /\bEVENT\.startISO\b/, "must reference EVENT.startISO as the target");
  assert.match(src, /\bgetCountdown\b/, "must call getCountdown locally");
  assert.match(src, /\bpad2\b/, "must use pad2 locally");

  // Must NOT import the removed shared hook.
  assert.doesNotMatch(
    src,
    /useCountdownParts/,
    "must not import the removed useCountdownParts hook",
  );
});

test("CountdownSection uses --font-edwardian-script and --font-baskervville", async () => {
  const src = await readSrc(SECTION);
  assert.match(
    src,
    /var\(--font-edwardian-script\)/,
    "must use var(--font-edwardian-script)",
  );
  assert.match(
    src,
    /var\(--font-baskervville\)/,
    "must use var(--font-baskervville)",
  );
});

test("CountdownSection does not depend on the shared ui/Countdown", async () => {
  const src = await readSrc(SECTION);
  assert.doesNotMatch(
    src,
    /@\/components\/ui\/Countdown/,
    "CountdownSection must not import @/components/ui/Countdown",
  );

  // The shared file itself should still exist (this slice does not delete it).
  let sharedExists = true;
  try {
    await readSrc(SHARED_COUNTDOWN);
  } catch {
    sharedExists = false;
  }
  assert.ok(sharedExists, "src/components/ui/Countdown.tsx should still exist");
});

test("the removed useCountdownParts hook is not present on disk", async () => {
  await assert.rejects(
    () => readSrc(REMOVED_HOOK),
    /ENOENT/,
    "src/lib/useCountdownParts.ts must not exist (it was removed)",
  );
});