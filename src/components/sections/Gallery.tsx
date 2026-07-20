import PhotoCarousel from "@/components/ui/PhotoCarousel";
import Reveal, { RevealItem } from "@/components/ui/Reveal";
import { GALLERY_PHOTOS } from "@/lib/gallery";

/* Self-hosted Edwardian Script + Baskervville, already mounted in
   `layout.tsx`. Matches Locations / BlessingHosts / DressCode so this
   section reads as part of the same invitation rather than an outlier. */
const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

const INK = "#1A1A1A";
const NIGHT = "#2E3E50";

/**
 * Gallery — Lupita photo carousel.
 *
 * Replaces the previous placeholder gradient grid. The carousel itself
 * (PhotoCarousel) is the single client island in this section; everything
 * around it is plain server-rendered markup so the RSVP flow, public route
 * behavior and invitation composition above stay byte-for-byte unchanged.
 *
 * Visual language matches the rest of the invitation: mist-blue ground,
 * Edwardian Script for the chapter title, Baskervville for the subtitle,
 * square corners and thin gold borders, no decoration on the slides. The
 * photos are the experience — the section just frames them.
 *
 * Adding a new photo is one line in `src/lib/gallery.ts`; this file does not
 * change.
 */
export default function Gallery() {
  return (
    <section
      id="galeria"
      className="w-full px-6 py-16 sm:py-20"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
      {/* Title + subtitle staggered as a single quiet reveal on scroll-into
          view. The carousel stays a separate client island below, untouched. */}
      <Reveal className="flex flex-col items-center">
        <RevealItem
          as="h2"
          className="mx-auto mb-3 text-center text-[clamp(3.25rem,6vw,3.75rem)] leading-none"
          style={{ ...EDWARDIAN, color: INK }}
        >
          Galería
        </RevealItem>

        <RevealItem
          as="p"
          className="mx-auto mb-12 max-w-md text-center text-[1.05rem] italic leading-relaxed"
          style={{ ...BASKERVVILLE, color: NIGHT }}
        >
          Un vistazo por algunos momentos de mi vida.
        </RevealItem>
      </Reveal>

      {/* The single client island. */}
      <div className="mx-auto flex w-full max-w-5xl justify-center">
        <PhotoCarousel photos={GALLERY_PHOTOS} />
      </div>
    </section>
  );
}
