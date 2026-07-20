// Source-contract tests for the shared reveal animation wrapper.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const REVEAL = "src/components/ui/Reveal.tsx";

test("Reveal uses scroll-triggered once-only Framer Motion reveals", async () => {
  const src = await readSrc(REVEAL);

  assert.match(src, /"use client"/, "Reveal must be a client component");
  assert.match(src, /whileInView="show"/, "Reveal must trigger on scroll into view");
  assert.match(src, /viewport=\{\{ once: true, amount \}\}/, "Reveal must run once per section");
  assert.match(src, /staggerChildren/, "Reveal must support staggered children");
});

test("Reveal respects reduced motion", async () => {
  const src = await readSrc(REVEAL);

  assert.match(src, /useReducedMotion/, "Reveal must read reduced-motion preference");
  assert.match(src, /REDUCED_ITEM_VARIANTS/, "Reveal must provide reduced item variants");
  assert.match(src, /REDUCED_CONTAINER_VARIANTS/, "Reveal must provide reduced container variants");
});
