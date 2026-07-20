/**
 * Gallery photo list for the Lupita photo carousel.
 *
 * Adding a new photo later is exactly one new line: drop `lupita8.jpeg` into
 * `public/photo/lupita/` and append an entry to `GALLERY_PHOTOS` below. The
 * carousel picks the count up automatically — no component edits required.
 *
 * `alt` is meaningful accessibility copy for screen-reader users and anyone
 * browsing with images disabled. The carousel intentionally renders no visible
 * per-photo captions so the portraits stay immersive and uncluttered.
 */

export interface GalleryPhoto {
  /** Next.js public asset path, e.g. "/photo/lupita/lupita1.jpeg". */
  src: string;
  /**
   * Accessible description of the photo. Read by screen readers and used as
   * the lightbox's primary label. Must be unique per photo so the carousel
   * controls ('photo 1 of 7') stay unambiguous.
   */
  alt: string;
}

/**
 * Single source of truth for the gallery. The Lupita series currently runs
 * `lupita1.jpeg` through `lupita7.jpeg`; extend the array to add more.
 */
export const GALLERY_PHOTOS: readonly GalleryPhoto[] = [
  {
    src: "/photo/lupita/lupita1.jpeg",
    alt: "Lupita posando para la sesión de fotos de los XV años",
  },
  {
    src: "/photo/lupita/lupita2.jpeg",
    alt: "Lupita de cuerpo entero con el vestido de quinceañera",
  },
  {
    src: "/photo/lupita/lupita3.jpeg",
    alt: "Retrato de Lupita mirando a la cámara",
  },
  {
    src: "/photo/lupita/lupita4.jpeg",
    alt: "Lupita sonriendo durante la sesión de fotos",
  },
  {
    src: "/photo/lupita/lupita5.jpeg",
    alt: "Lupita en un detalle del vestido y los accesorios",
  },
  {
    src: "/photo/lupita/lupita6.jpeg",
    alt: "Lupita en un segundo plano de la sesión",
  },
  {
    src: "/photo/lupita/lupita7.jpeg",
    alt: "Lupita cerrando la sesión de fotografía",
  },
];
