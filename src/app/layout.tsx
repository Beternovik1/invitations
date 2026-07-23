import type { Metadata } from "next";
import localFont from "next/font/local";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";

import { ASSETS, SITE } from "@/lib/constants";

// Local display face for the celebrant's name — the "princess movie title"
// flourish. Self-hosted via next/font/local so it ships with the rest of the
// static assets (no external request) and loads with zero layout shift.
const lightfootTitle = localFont({
  src: "../../fonts/lightfoot_s.ttf",
  variable: "--font-lightfoot",
  display: "swap",
});

// Local serif face for the intro message section. Self-hosted Baskervville so
// the invitation line feels more ceremonial without an external request and
// with zero layout shift.
const baskervville = localFont({
  src: "../../fonts/Baskervville/Baskervville-VariableFont_wght.ttf",
  variable: "--font-baskervville",
  display: "swap",
});

// Local calligraphic display face for the "blessing / hosts" section — a
// formal script (Edwardian Script ITC) for the celebrant's parents and
// padrinos names. Self-hosted via next/font/local so it ships with the rest
// of the static assets (no external request) and loads with zero layout
// shift. Labels inside that section stay in the serif face for legibility;
// this face owns the names and the ceremonial lines.
const edwardianScript = localFont({
  src: "../../fonts/edwardianscriptitc.woff2",
  variable: "--font-edwardian-script",
  display: "swap",
});

// Local sans face for host names in the blessing section. The user provided
// the Google Sans directory and asked that only the names use this family.
const googleSans = localFont({
  src: "../../fonts/Google_Sans/GoogleSans-VariableFont_GRAD,opsz,wght.ttf",
  variable: "--font-google-sans",
  display: "swap",
});

// Art Deco serif display face for headings and elegant labels.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

// Geometric sans for body copy, buttons, and countdown numerals.
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: SITE.title,
  description: SITE.description,
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    type: "website",
    locale: SITE.locale,
    siteName: SITE.title,
    images: [
      {
        url: ASSETS.ogImage,
        width: 1200,
        height: 630,
        alt: "Sarahí — celebración de XV años",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: [ASSETS.ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${lightfootTitle.variable} ${baskervville.variable} ${edwardianScript.variable} ${googleSans.variable} ${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
