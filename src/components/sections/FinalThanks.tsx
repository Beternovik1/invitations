import Image from "next/image";

import Reveal, { RevealItem } from "@/components/ui/Reveal";

const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;
const GOLD = "#C7A96A";
const INK = "#1A1A1A";
const IVORY = "#F5F3EE";
const NIGHT = "#2E3E50";

/**
 * Final closing note for the invitation.
 *
 * A quiet farewell after the gallery: one Edwardian Script line and a hand-drawn
 * heart below it. No cards, buttons, or extra copy — the page has already done
 * its job, so the ending should feel personal and light.
 */
export default function FinalThanks() {
  return (
    <section id="gracias" style={{ backgroundColor: "var(--color-mist-blue)" }}>
      <div className="flex w-full flex-col items-center px-6 py-20 text-center sm:py-24">
        <Reveal className="flex flex-col items-center" stagger={0.18}>
          <RevealItem
            as="p"
            className="mx-auto max-w-3xl text-[clamp(3.2rem,9vw,5.5rem)] leading-[0.95]"
            style={{ ...EDWARDIAN, color: INK }}
          >
            Gracias por acompañarme en este día tan especial.
          </RevealItem>

          <RevealItem variant="soft-scale" className="mt-8">
            <svg
              viewBox="0 0 120 96"
              className="h-16 w-20 sm:h-20 sm:w-24"
              aria-hidden="true"
              fill="none"
            >
              <path
                d="M60 83C35 62 18 47 18 29c0-10 7-17 17-17 8 0 15 5 19 12 4-7 11-12 20-12 10 0 18 7 18 17 0 18-17 33-42 54Z"
                stroke={GOLD}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </RevealItem>
        </Reveal>
      </div>

      <footer
        className="flex w-full items-center justify-center gap-2 px-6 py-3 text-center"
        style={{ ...BASKERVVILLE, backgroundColor: NIGHT, color: IVORY }}
      >
        <span className="text-[0.85rem] tracking-[0.06em]">
          Desarrollada por Edgar Alfaro
        </span>
        <a
          href="https://github.com/Beternovik1"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Edgar Alfaro on GitHub"
          className="inline-flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E3E50]"
        >
          <Image
            src="/github-65x64.png"
            alt=""
            width={24}
            height={24}
            className="h-5 w-5 invert"
            aria-hidden="true"
          />
        </a>
      </footer>
    </section>
  );
}
