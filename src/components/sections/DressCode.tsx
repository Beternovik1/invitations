import Image from "next/image";

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
      <h2
        className="text-[clamp(3.25rem,6vw,3.75rem)] leading-none text-[#1A1A1A]"
        style={{ fontFamily: "var(--font-edwardian-script)" }}
      >
        Código de vestimenta
      </h2>

      <p
        className="mt-3 text-[clamp(1.3rem,4.5vw,1.9rem)] text-[#2E3E50]"
        style={{ fontFamily: "var(--font-baskervville)" }}
      >
        Formal
      </p>

      <Image
        src="/photo/iconodresscode.png"
        alt=""
        width={180}
        height={180}
        className="mt-8 h-auto w-[150px] sm:w-[180px]"
        sizes="180px"
        aria-hidden="true"
      />
    </section>
  );
}
