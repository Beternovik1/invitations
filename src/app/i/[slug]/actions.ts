"use server";

import { submitRsvp, type RsvpFormState } from "@/lib/rsvps";

/**
 * RSVP Server Action.
 *
 * Bound to a specific guest group slug by the client form with
 * `submitRsvpAction.bind(null, slug)` and consumed via `useActionState`, so the
 * bound signature is `(prevState, formData)` as React expects. Running on the
 * server keeps the service-role key and all Supabase access off the client.
 *
 * Returns a structured `RsvpFormState` — never throws for expected validation
 * failures (`submitRsvp` already converts those into `{ ok: false, error }`).
 * Only transport-level failures throw; they are caught here and surfaced as an
 * `error` state so the form stays usable.
 */
export async function submitRsvpAction(
  slug: string,
  prevState: RsvpFormState,
  formData: FormData
): Promise<RsvpFormState> {
  const rawCount = formData.get("attendingCount");
  const rawMessage = formData.get("message");

  const attendingCount =
    rawCount == null || rawCount === "" ? Number.NaN : Number(rawCount);

  const message = typeof rawMessage === "string" ? rawMessage : null;

  try {
    const result = await submitRsvp(slug, { attendingCount, message });
    if (result.ok) {
      return { status: "success", rsvp: result.rsvp };
    }
    return { status: "error", error: result.error, rsvp: prevState.rsvp };
  } catch {
    return {
      status: "error",
      error: {
        code: "unexpected",
        message:
          "Ocurrió un problema al guardar tu confirmación. Inténtalo de nuevo en un momento.",
      },
      rsvp: prevState.rsvp,
    };
  }
}