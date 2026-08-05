"use client";

import type { ComponentType } from "react";
import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/admin/_actions/logout";

/**
 * Admin dashboard chrome — the collapsible sidebar, the mobile top bar, and
 * the content slot, coordinated by one client component.
 *
 * Why one client component (instead of a Next layout)?
 *
 * The sidebar needs three pieces of interactivity that only exist in the
 * browser: current-page highlighting (`usePathname()`), a desktop
 * collapse/expand toggle, and a mobile drawer with a backdrop. A Next.js
 * route `layout.tsx` must be a Server Component when it reads cookies / does
 * auth (see `app/admin/(dashboard)/layout.tsx`); it cannot also hold the
 * client state for the sidebar. So the server layout runs the access gate and
 * hands the authenticated children to this client chrome, which just places
 * them inside the sidebar shell. The children are already server-rendered —
 * this component never re-renders them, it only owns the chrome.
 *
 * Responsive model:
 *
 *   - `md` and up: the sidebar is a static, in-flow column on the left. The
 *     collapse toggle shrinks it to an icon rail (`md:w-[4.5rem]`) and hides
 *     the labels; expanding restores labels (`md:w-64`). `collapsed` only
 *     affects the desktop width — it never hides the sidebar on desktop.
 *   - Below `md`: the sidebar is an off-canvas drawer (`fixed`), hidden off
 *     the left edge until `mobileOpen` slides it in with a backdrop. A
 *     hamburger in the top bar opens it; the close button, the backdrop, and
 *     any nav link tap close it. The collapse toggle is desktop-only.
 *
 * Access: this component NEVER gates auth. The server layout already verified
 * the admin cookie before rendering it, so the sign-out form and every nav
 * link only ever render for an authenticated host. The sign-out form uses a
 * plain `action={logoutAction}` so it still posts correctly without JS
 * (progressive enhancement), exactly like the login form.
 */

/* -------------------------------------------------------------------------- */
/*  Icons (inline, no icon dependency)                                        */
/* -------------------------------------------------------------------------- */

type IconProps = { className?: string };

function IconChecklist(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 5l1.5 1.5L8 4" />
      <path d="M4 11l1.5 1.5L8 10" />
      <path d="M4 17l1.5 1.5L8 16" />
    </svg>
  );
}

function IconTable(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h16" />
      <path d="M5 8l1.5 11" />
      <path d="M19 8l-1.5 11" />
      <path d="M9 8l-.5 11" />
      <path d="M15 8l.5 11" />
      <path d="M7 14h10" />
    </svg>
  );
}

function IconLogout(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconMenu(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function IconChevron(props: IconProps & { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: props.collapsed ? "rotate(180deg)" : undefined }}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Navigation                                                                */
/* -------------------------------------------------------------------------- */

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/confirmaciones", label: "Confirmaciones", icon: IconChecklist },
  { href: "/admin/seating", label: "Mesas", icon: IconTable },
];

/** Active when `pathname` is the section root or any nested segment under it. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/* -------------------------------------------------------------------------- */
/*  Chrome                                                                    */
/* -------------------------------------------------------------------------- */

export default function AdminDashboardChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sidebarId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex min-h-[100dvh]">
      {/* Mobile backdrop — sits beneath the drawer (z-40) and above content. */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar navegación"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-(--color-ink)/40 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        id={sidebarId}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-(--color-admin-navy-hairline) bg-(--color-admin-navy) backdrop-blur transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none",
          "md:static md:z-30",
          collapsed ? "md:w-[4.5rem]" : "md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {/* Brand row */}
        <div className="flex items-center justify-between gap-2 border-b border-(--color-admin-navy-hairline) px-3 py-4">
          <Link
            href="/admin/confirmaciones"
            onClick={closeMobile}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-(--color-gold)/55 bg-white/5 text-sm font-semibold leading-none tracking-[0.12em] text-(--color-gold-bright)">
              B
            </span>
            <span className={collapsed ? "md:hidden" : ""}>
              <span className="block text-[0.65rem] uppercase tracking-[0.32em] text-(--color-gold-bright)/90">
                Beternovik
              </span>
              <span className="block text-sm font-semibold tracking-[0.02em] text-(--color-cream-bright)">
                Administrador
              </span>
            </span>
          </Link>

          {/* Collapse toggle — desktop only. Chevron points left when
              expanded (collapse hides the sidebar to the left); rotated to
              point right when collapsed (expand pulls it back out). */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir panel" : "Contraer panel"}
            aria-expanded={!collapsed}
            className="hidden rounded-md border border-(--color-admin-navy-hairline) p-1.5 text-(--color-admin-navy-ink) transition hover:text-(--color-cream-bright) md:inline-flex"
          >
            <IconChevron collapsed={collapsed} className="h-4 w-4" />
          </button>

          {/* Close — mobile only. */}
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Cerrar navegación"
            className="rounded-md border border-(--color-admin-navy-hairline) p-1.5 text-(--color-admin-navy-ink) md:hidden"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-4"
          aria-label="Secciones de administración"
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition",
                      collapsed ? "md:justify-center md:px-2" : "",
                      active
                        ? "bg-(--color-cream-white)/10 text-(--color-cream-bright)"
                        : "text-(--color-admin-navy-ink) hover:bg-(--color-cream-white)/8 hover:text-(--color-cream-bright)",
                    ].join(" ")}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span
                      className={[
                        "min-w-0 flex-1 truncate",
                        collapsed ? "md:hidden" : "",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sign out */}
        <div className="border-t border-(--color-admin-navy-hairline) px-2 py-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className={[
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-(--color-admin-navy-ink) transition hover:bg-(--color-cream-white)/8 hover:text-(--color-cream-bright)",
                collapsed ? "md:justify-center md:px-2" : "",
              ].join(" ")}
            >
              <IconLogout className="h-5 w-5 shrink-0" />
              <span className={collapsed ? "md:hidden" : ""}>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-h-[100dvh] flex-1 flex-col">
        {/* Mobile top bar — replaces the sidebar on small screens. */}
        <div className="flex items-center justify-between border-b border-(--color-admin-navy-hairline) bg-(--color-admin-navy) px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación"
            aria-controls={sidebarId}
            aria-expanded={mobileOpen}
            className="rounded-md border border-(--color-admin-navy-hairline) p-2 text-(--color-admin-navy-ink)"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-[0.02em] text-(--color-cream-bright)">
            Beternovik Admin
          </span>
          <span className="w-9" aria-hidden="true" />
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 sm:px-6 lg:px-8 py-10 sm:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
