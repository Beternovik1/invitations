// Source-contract tests for the personalized envelope gate.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const ENVELOPE = "src/components/ui/EnvelopeGate.tsx";

test("Envelope addressed text uses stable breakpoint sizes instead of viewport clamp", async () => {
  const src = await readSrc(ENVELOPE);

  assert.match(src, /Para:/, "envelope must render the addressed Para label");
  assert.doesNotMatch(
    src,
    /text-\[clamp\([^\]]+vw/,
    "envelope text must not use viewport-fluid clamp sizing",
  );
  assert.match(src, /text-\[3\.75rem\]/, "mobile envelope text must keep the approved stable size");
  assert.match(src, /sm:text-\[3\.75rem\]/, "tablet envelope text must not grow beyond the mobile-approved size");
  assert.match(src, /lg:text-\[3\.25rem\]/, "large-screen envelope text must shrink to avoid the open button area");
  assert.match(src, /xl:text-\[3rem\]/, "extra-large screens must cap addressed text even further");
  assert.match(src, /top-\[24%\]/, "addressed text must keep the approved envelope position");
});
