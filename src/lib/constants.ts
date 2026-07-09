/**
 * Event content for Lupita's quinceañera invitation.
 *
 * Keep event-specific copy out of components; components consume these
 * constants so the invitation can be retuned without touching JSX.
 */

export const EVENT = {
  /** Name of the celebrant, used in display copy. Uppercase per the princess
      movie-title treatment request. */
  celebrantName: "SARAHI",
  /** Spanish label for the celebration type. */
  eventType: "Mis XV Años",
  /**
   * Target instant of the celebration as an absolute UTC ISO timestamp.
   *
   * The event takes place on 2026-10-17 at 19:00 in Mexico City. Mexico City
   * observes UTC-6 year-round since the 2022 time-zone reform removed DST for
   * most of the country, so 19:00 local = 01:00 UTC the following calendar day.
   *
   * Storing the instant as UTC keeps countdown math independent of the
   * visitor's own time zone: `Date.parse(startISO)` always returns the same
   * absolute epoch millis regardless of where the page is viewed.
   */
  startISO: "2026-10-18T01:00:00.000Z",
  /** Human-readable, locale-formatted event facts (es-MX). */
  dateLabel: "17 de octubre de 2026",
  timeLabel: "19:00 hrs",
  cityLabel: "Ciudad de México",
  /** Pre-RSVP banner copy; backend not wired yet. */
  rsvpSoonLabel: "Pronto podrás confirmar tu asistencia",
} as const;

/**
 * Generic placeholder asset paths.
 *
 * None of these reference any existing franchise, character, or film art.
 * They are intentionally generic labels so a designer can drop real assets in
 * later without refactoring components.
 */
export const ASSETS = {
  bayouBackground: "/bayou-background-placeholder.jpg",
  goldFrame: "/gold-frame-placeholder.png",
  ogImage: "/og-image.jpg",
  heroPortrait: "/sarahi-portrait.png",
} as const;

/**
 * Site-level metadata used for SEO and link previews.
 *
 * `SITE.url` is a placeholder domain used as `metadataBase`; replace with the
 * final deployment URL before going live.
 */
export const SITE = {
  url: "https://invitaciones-lupita.example",
  title: "Lupita — Mis XV Años",
  description:
    "Acompáñame a celebrar mis XV años. Una noche de cuento entre luces del bayou y música de Nueva Orleans.",
  locale: "es_MX",
} as const;
