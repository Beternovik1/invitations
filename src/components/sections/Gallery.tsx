import SectionShell from "@/components/ui/SectionShell";
import { GALLERY } from "@/lib/constants";

/* Each tone maps to a gradient built from the invitation palette so the
   placeholder cards feel like part of the design rather than grey boxes. */
const GRADIENTS: Record<(typeof GALLERY)[number]["tone"], string> = {
  sage: "linear-gradient(135deg, #b8dba0 0%, #77a291 100%)",
  teal: "linear-gradient(135deg, #77a291 0%, #213a32 100%)",
  gold: "linear-gradient(135deg, #f2d27a 0%, #c79a3c 100%)",
  cream: "linear-gradient(135deg, #f9fce4 0%, #eef8c8 100%)",
};

/**
 * Gallery placeholder grid.
 *
 * No real images are rendered: each card is a CLS-safe gradient block (fixed
 * aspect-ratio reserves space) with a thin inner gold frame and a caption.
 * When real assets are added, the gradient layer can be swapped for an
 * `<Image>` without changing the grid.
 */
export default function Gallery() {
  return (
    <SectionShell id="galeria" eyebrow="Galería" title="Momentos por venir">
      <div className="grid w-full gap-4 sm:grid-cols-2 sm:gap-5">
        {GALLERY.map((item) => (
          <figure
            key={item.id}
            className="relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] shadow-[0_12px_30px_rgba(33,58,50,0.22)]"
            style={{ aspectRatio: "4 / 3" }}
          >
            <div
              className="absolute inset-0"
              style={{ background: GRADIENTS[item.tone] }}
              aria-hidden="true"
            />
            {/* Inner gold hairline echoes the ornamental frame language. */}
            <div
              className="pointer-events-none absolute inset-3 rounded-xl border"
              style={{ borderColor: "rgba(199, 154, 60, 0.55)" }}
              aria-hidden="true"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(33,58,50,0.55)] to-transparent px-4 py-3 text-left">
              <span
                className="font-serif text-lg text-[var(--color-cream-bright)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {item.caption}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <p
        className="font-sans text-xs text-[var(--color-ink-dim)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Pronto compartiremos los momentos de esta noche.
      </p>
    </SectionShell>
  );
}
