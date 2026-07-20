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
  assert.match(src, /text-\[3\.75rem\]/, "mobile envelope text must have a stable fixed size");
});
