// Deterministic source-contract tests for the gallery carousel slice.
//
// These read source files from disk and assert the visible UI contract the
// carousel must keep: local Lupita images, no visible per-photo captions, large
// responsive photo frame, night-blue circular navigation, circular indicators,
// and lightbox affordances. No browser harness is needed for this level.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const GALLERY_DATA = "src/lib/gallery.ts";
const CAROUSEL = "src/components/ui/PhotoCarousel.tsx";
const SECTION = "src/components/sections/Gallery.tsx";

test("gallery photos are data-driven from the Lupita public image folder", async () => {
  const src = await readSrc(GALLERY_DATA);

  assert.match(src, /export const GALLERY_PHOTOS/, "must export the gallery list");
  for (let i = 1; i <= 7; i += 1) {
    assert.match(
      src,
      new RegExp(`/photo/lupita/lupita${i}\\.jpeg`),
      `must include lupita${i}.jpeg`,
    );
  }
});

test("gallery data keeps accessible alt text but no visible caption field", async () => {
  const src = await readSrc(GALLERY_DATA);

  assert.match(src, /alt:\s*string/, "GalleryPhoto must keep alt text");
  assert.doesNotMatch(
    src,
    /caption:\s*string|caption:\s*"/,
    "gallery data must not define visible per-photo captions",
  );
});

test("PhotoCarousel uses a larger responsive portrait window", async () => {
  const src = await readSrc(CAROUSEL);

  assert.match(src, /max-w-4xl/, "outer carousel row must allow a wider layout");
  assert.match(src, /sm:max-w-xl/, "photo frame must grow beyond the old tablet width");
  assert.match(src, /md:max-w-2xl/, "photo frame must grow on larger screens");
  assert.match(src, /aspectRatio:\s*"4 \/ 5"/, "frame must stay portrait-oriented");
});

test("Gallery section uses the requested personal subtitle", async () => {
  const src = await readSrc(SECTION);

  assert.match(src, /import Reveal, \{ RevealItem \}/, "Gallery title/subtitle must use shared reveal components");
  assert.match(
    src,
    /Un vistazo por algunos momentos de mi vida\./,
    "Gallery subtitle must match the requested copy",
  );
});

test("PhotoCarousel uses circular night-blue controls with white symbols", async () => {
  const src = await readSrc(CAROUSEL);

  assert.match(src, /const NIGHT = "#2E3E50"/, "must use the shared night-blue button color");
  assert.match(src, /rounded-full[^\n]+text-white/, "inline nav buttons must be circular with white symbols");
  assert.match(src, /backgroundColor:\s*NIGHT/, "nav buttons must use night-blue background");
  assert.match(src, /borderColor:\s*NIGHT/, "nav button border should match the night-blue fill");
});

test("PhotoCarousel uses circular dot indicators", async () => {
  const src = await readSrc(CAROUSEL);

  assert.match(src, /role="tablist"/, "dot row must remain a tablist");
  assert.match(src, /rounded-full p-0/, "dot buttons must be circular hit targets");
  assert.match(src, /className="block rounded-full"/, "inner indicators must be circular");
});

test("Gallery section renders the carousel with the shared photo list", async () => {
  const src = await readSrc(SECTION);

  assert.match(src, /import PhotoCarousel/, "Gallery must import the carousel island");
  assert.match(src, /GALLERY_PHOTOS/, "Gallery must use the shared photo list");
  assert.match(src, /<PhotoCarousel photos=\{GALLERY_PHOTOS\}/, "Gallery must pass photos to carousel");
});
