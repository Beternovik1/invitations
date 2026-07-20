import Reveal, { RevealItem } from "@/components/ui/Reveal";

const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const GOLD = "#C7A96A";
const INK = "#1A1A1A";

/**
 * Final closing note for the invitation.
 *
 * A quiet farewell after the gallery: one Edwardian Script line and a hand-drawn
 * heart below it. No cards, buttons, or extra copy — the page has already done
 * its job, so the ending should feel personal and light.
 */
export default function FinalThanks() {
  return (
    <section
      id="gracias"
      className="flex w-full flex-col items-center px-6 py-20 text-center sm:py-24"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
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
    </section>
  );
}
