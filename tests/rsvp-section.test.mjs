// Deterministic source-contract tests for the RSVP section slice.
//
// The repo has no JS test harness yet, so these read the section's source
// file from disk and assert the externally-visible contract reviewers asked
// for. They make no network calls, render nothing, and depend only on
// `node:test` + `node:assert` — built into Node, no deps added.
//
// These are source-contract tests on purpose: the RSVP UI is a Client
// Component whose real behavior only shows up after a Server Action
// roundtrip through `useActionState`, which a unit harness would have to
// mock heavily. The contract that reviewers care about — no message UI, the
// direct-confirm form submits the full seat count, the modify form carries
// the stepper's `count` and clamps 0..seats, and the stepper resyncs to the
// latest confirmed RSVP — is all expressible as static structural facts about
// `Rsvp.tsx`, which is what these tests pin down.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const SECTION = "src/components/sections/Rsvp.tsx";

test("Rsvp exposes no optional message UI: no MAX_RSVP_MESSAGE_LENGTH, no <textarea>", async () => {
  const src = await readSrc(SECTION);

  assert.doesNotMatch(
    src,
    /MAX_RSVP_MESSAGE_LENGTH/,
    "must not import or reference MAX_RSVP_MESSAGE_LENGTH (message UI removed)",
  );

  assert.doesNotMatch(
    src,
    /<textarea\b/i,
    "must not render a <textarea> for a free-text message field",
  );
});

test("direct Confirmar form submits hidden attendingCount=seats and empty message via formAction", async () => {
  const src = await readSrc(SECTION);

  // The direct confirm form is its own <form> using the shared formAction.
  assert.match(
    src,
    /<form action=\{formAction\}>/,
    "direct confirm form must submit through the shared formAction",
  );

  // Hidden attendingCount carries the full reserved seat count, not the
  // stepper's `count` — one tap confirms every seat.
  assert.match(
    src,
    /<input type="hidden" name="attendingCount" value=\{seats\} \/>/,
    "direct confirm form must submit hidden attendingCount=seats",
  );

  // Hidden message is pinned empty so the server action always receives a
  // string for `message` (no optional message UI is offered).
  assert.match(
    src,
    /<input type="hidden" name="message" value="" \/>/,
    'direct confirm form must submit hidden empty message',
  );
});

test("modify form carries the stepper count as hidden attendingCount and uses guarded clamping", async () => {
  const src = await readSrc(SECTION);

  // The modify form is a second <form> revealed by `showModify` and uses the
  // SAME formAction as the direct confirm.
  assert.match(
    src,
    /showModify && \(\s*<form/,
    "modify form must be gated by showModify",
  );
  assert.match(
    src,
    /<form\s[^>]*action=\{formAction\}/,
    "modify form must use the shared formAction",
  );

  // The stepper's current value rides to the server as a hidden
  // attendingCount field — the visible number is not directly editable.
  assert.match(
    src,
    /<input type="hidden" name="attendingCount" value=\{count\} \/>/,
    "modify form must submit hidden attendingCount=count",
  );

  // Circular +/- stepper: both buttons route through the guarded update helper.
  // The helper clamps at 0..seats and keeps <output>{count}</output> as the
  // single source of truth.
  assert.match(
    src,
    /onClick=\{\(\) => updateCount\(-1\)\}/,
    "minus button must route through the guarded update handler",
  );
  assert.match(
    src,
    /onClick=\{\(\) => updateCount\(1\)\}/,
    "plus button must route through the guarded update handler",
  );
  assert.match(
    src,
    /setCount\(\(current\) =>\s*Math\.min\(seats,\s*Math\.max\(0,\s*current \+ direction\)\),\s*\);/,
    "guarded update handler must clamp count to 0..seats",
  );
});

test("stepper count resets only when modify opens, not during render", async () => {
  const src = await readSrc(SECTION);

  // The resync must reuse the same helper as the useState initializer so the
  // two paths can never drift apart (clamp to 0..seats, fall back to seats).
  assert.match(
    src,
    /function computeInitialCount\(/,
    "must declare a computeInitialCount helper shared by useState and the resync",
  );
  assert.match(
    src,
    /useState<number>\(\(\)\s*=>\s*computeInitialCount\(/,
    "useState initializer must call computeInitialCount",
  );

  // A direct `Confirmar` submit updates `confirmed.attendingCount` AFTER mount.
  // The stepper should sync when the user OPENS modify, not while they are
  // already clicking +/- quickly, because a delayed Server Action result can
  // otherwise clobber in-progress edits and make numbers jump backward.
  assert.match(
    src,
    /const toggleModify = \(\) => \{[\s\S]*setCount\(computeInitialCount\(confirmed\?\.attendingCount,\s*seats\)\);[\s\S]*\};/,
    "must reset count only from the modify toggle handler",
  );

  assert.doesNotMatch(
    src,
    /confirmed\?\.attendingCount !==/,
    "must not resync solely because confirmed changed while user may be editing",
  );
  assert.doesNotMatch(
    src,
    /setCount\(computeInitialCount\(confirmed\?\.attendingCount,\s*seats\)\);\s*}\s*if/s,
    "must not run a render-time resync block after state declarations",
  );
});

test("stepper guards against duplicate rapid tap events", async () => {
  const src = await readSrc(SECTION);

  assert.match(
    src,
    /const STEPPER_TAP_GUARD_MS = 160;/,
    "must define a short duplicate-tap guard window",
  );
  assert.match(
    src,
    /const lastStepperTapAt = useRef\(0\);/,
    "must track the last accepted stepper tap outside render state",
  );
  assert.match(
    src,
    /if \(now - lastStepperTapAt\.current < STEPPER_TAP_GUARD_MS\) \{\s*return;\s*\}/,
    "must ignore duplicate stepper activations within the guard window",
  );
  assert.match(
    src,
    /onClick=\{\(\) => updateCount\(-1\)\}/,
    "minus button must use guarded update handler",
  );
  assert.match(
    src,
    /onClick=\{\(\) => updateCount\(1\)\}/,
    "plus button must use guarded update handler",
  );
});
