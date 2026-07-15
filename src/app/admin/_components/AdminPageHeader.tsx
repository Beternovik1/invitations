import type { ReactNode } from "react";

/**
 * In-page title block for an admin dashboard section.
 *
 * The dashboard chrome (`AdminDashboardChrome`) owns the shared sidebar,
 * brand, and sign-out control, so they stay consistent across every admin
 * section. Each admin page still renders its own name through this header —
 * only the page knows its own title and sub-section eyebrow.
 *
 * Deliberately a Server Component (no interactivity), so nothing here ships
 * to the client bundle. `children` lets a page slot an inline action beside
 * the title when it needs one (e.g. a future "Refresh" button for the RSVP
 * overview); the dashboard sign-out stays in the sidebar, not here.
 */
export default function AdminPageHeader({
  title,
  eyebrow = "admin",
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-baseline justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-(--color-gold-soft)">
          Sarahi XV · {eyebrow}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-(--color-ink) sm:text-4xl">
          {title}
        </h1>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </header>
  );
}