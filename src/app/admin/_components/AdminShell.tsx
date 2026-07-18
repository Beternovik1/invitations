/**
 * Shared page chrome for all admin routes (login, overview, setup-required).
 *
 * A Server Component — no `"use client"` — so it can host Server-Action forms
 * (e.g. the logout form passed via `headerActions`) directly in the header.
 * Reuses the project's design tokens so the admin screens read as the same
 * product without inheriting the wedding-invitation ceremony.
 *
 * `headerActions` is optional and renders baseline-aligned on the right of the
 * title row; pass a logout form there for authenticated routes.
 */
function AdminShell({
  title,
  eyebrow = "administrador",
  headerActions,
  children,
}: {
  title: string;
  eyebrow?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-5 py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-(--color-gold-soft)">
            Sarahi XV · {eyebrow}
          </p>
          <h1 className="mt-2 font-serif text-3xl text-(--color-ink) sm:text-4xl">
            {title}
          </h1>
        </div>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </header>
      {children}
    </main>
  );
}

export default AdminShell;