import Image from "next/image";

import Reveal, { RevealItem } from "@/components/ui/Reveal";

/**
 * Dress code section.
 *
 * The section mirrors the invitation's current visual language: Edwardian
 * Script for the chapter title, Baskervville for the short formal note, and a
 * single centered gold dress-code icon as the only ornament.
 */
export default function DressCode() {
  return (
    <section
      id="vestimenta"
      className="flex w-full flex-col items-center px-6 py-16 text-center sm:py-20"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
      <Reveal
        className="flex w-full flex-col items-center"
        stagger={0.14}
        delayChildren={0.05}
      >
        <RevealItem
          as="h2"
          className="text-[clamp(3.25rem,6vw,3.75rem)] leading-none text-[#1A1A1A]"
          style={{ fontFamily: "var(--font-edwardian-script)" }}
        >
          Código de vestimenta
        </RevealItem>

        <RevealItem
          as="p"
          className="mt-3 text-[clamp(1.3rem,4.5vw,1.9rem)] text-[#2E3E50]"
          style={{ fontFamily: "var(--font-baskervville)" }}
        >
          Formal
        </RevealItem>

        {/* Decorative dress-code icon — the only ornament this section earns.
            `soft-scale` is a tiny 4% scale-in landing on 1 so it reads heavier
            than the matching text fade without becoming a flashy effect. */}
        <RevealItem variant="soft-scale" className="mt-8">
          <Image
            src="/photo/iconodresscode.webp"
            alt=""
            width={180}
            height={180}
            className="h-auto w-[150px] sm:w-[180px]"
            sizes="180px"
            aria-hidden="true"
          />
        </RevealItem>
      </Reveal>
    </section>
  );
}
