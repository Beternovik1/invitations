// Source-contract tests for the final thanks section and floating music button.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = async (rel) =>
  (await readFile(join(ROOT, rel), "utf8")).toString();

const INVITATION = "src/components/InvitationContent.tsx";
const FINAL_THANKS = "src/components/sections/FinalThanks.tsx";
const GIFTS = "src/components/sections/Gifts.tsx";
const MUSIC_BUTTON = "src/components/ui/FloatingMusicButton.tsx";

test("InvitationContent removes MusicSection and ends with FinalThanks", async () => {
  const src = await readSrc(INVITATION);

  assert.doesNotMatch(src, /MusicSection/, "standalone MusicSection must not render");
  assert.match(src, /import FinalThanks/, "FinalThanks must be imported");
  assert.match(src, /<Gallery \/>\s*<FinalThanks \/>/, "FinalThanks must render after Gallery");
});

test("FinalThanks uses Edwardian Script text and a drawn heart", async () => {
  const src = await readSrc(FINAL_THANKS);

  assert.match(src, /var\(--font-edwardian-script\)/, "must use Edwardian Script variable");
  assert.match(src, /import Reveal, \{ RevealItem \}/, "must use the shared reveal components");
  assert.match(src, /variant="soft-scale"/, "heart must use the soft-scale reveal");
  assert.match(
    src,
    /Gracias por acompañarme en este día tan especial/,
    "must render the requested closing text",
  );
  assert.match(src, /<svg[\s\S]*<path/, "must draw the heart with SVG");
});

test("Gifts section marks the registry as optional", async () => {
  const src = await readSrc(GIFTS);

  assert.match(src, /\(Opcional\)/, "Gifts must show the optional subtitle");
  assert.match(src, /var\(--font-baskervville\)/, "Gifts optional subtitle must use Baskervville styling");
  assert.doesNotMatch(
    src,
    /<Reveal stagger=\{0\.1\}/,
    "Gifts card content must not use a nested viewport reveal that can stay hidden on reload",
  );
});

test("FloatingMusicButton is icon-only night-blue with white play-pause icons", async () => {
  const src = await readSrc(MUSIC_BUTTON);

  assert.doesNotMatch(src, /titleLine/, "must not render the visible song-title label");
  assert.match(src, /bg-\[#2E3E50\]/, "music button must use dark blue fill");
  assert.match(src, /text-white/, "music button icons must render white");
  assert.match(src, /aria-label=\{buttonLabel\}/, "icon-only button must keep accessible labels");
  assert.match(src, /isPlaying \? <PauseGlyph \/> : <PlayGlyph \/>/, "must keep play/pause icons only");
});
