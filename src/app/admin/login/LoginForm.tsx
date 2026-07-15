"use client";

import { useActionState, useId } from "react";

import { loginAction, type LoginState } from "@/app/admin/login/actions";

/**
 * Admin login form.
 *
 * A client component only because inline error feedback needs `useActionState`
 * — the actual secret verification runs in the `loginAction` Server Action, so
 * the access key and all cookie handling stay server-side. The form is
 * progressively enhanced: a plain POST to the Server Action works without
 * client JS; `useActionState` layers inline status feedback on top.
 */
export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    { error: null }
  );

  const inputId = useId();

  return (
    <form action={formAction} className="mt-8 max-w-md">
      <label
        htmlFor={inputId}
        className="block text-xs uppercase tracking-[0.18em] text-(--color-gold-soft)"
      >
        Access key
      </label>
      <input
        id={inputId}
        name="key"
        type="password"
        autoComplete="off"
        autoFocus
        required
        className="mt-2 w-full rounded-xl border border-(--color-glass-border) bg-(--color-glass) px-4 py-3 font-mono text-sm text-(--color-ink) outline-none focus:border-(--color-gold)/60 focus:ring-1 focus:ring-(--color-gold)/40"
        aria-describedby="login-error"
      />

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="mt-3 rounded-lg border border-(--color-gold)/40 bg-(--color-pale-yellow-green)/50 px-4 py-3 text-sm text-(--color-ink)"
        >
          {state.error}
        </p>
      ) : (
        <p id="login-error" className="sr-only">
          Enter the admin access key to continue.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-(--color-dusty-teal) px-5 py-3 text-sm font-medium text-(--color-cream-white) transition hover:bg-(--color-ink) disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}