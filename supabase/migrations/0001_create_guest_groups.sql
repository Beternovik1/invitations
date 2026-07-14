-- Guest groups for personalized invitations.
--
-- One row per family/group that receives a personalized link at /i/[slug].
-- The slug identifies the group (a family or a named invitee), never an
-- individual person, so one link serves a whole household and their seats.
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting this file into
-- the Supabase SQL editor. No secrets are required to run this migration.
--
-- This schema is the database half of the guest-group data boundary in
-- src/lib/guest-groups.ts. The app reads it via the Supabase REST API when
-- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are present, and falls back to
-- in-repo mock data otherwise.

create table if not exists public.guest_groups (
  -- Route identifier. Primary key, so it is unique; stable across renames of
  -- display_name so links keep working when mom edits a label.
  slug text primary key,
  -- Name shown on the envelope (a family name or a named invitee).
  display_name text not null,
  -- Seats assigned, or null when the count is still pending confirmation.
  -- null is the explicit "pending" state, never 0 or a guess.
  assigned_seats integer null,
  -- Soft-delete/disable flag. Inactive groups behave as not found on /i/[slug]
  -- so a deactivated link stops rendering a personalized invitation without
  -- deleting the row (useful for RSVP history and re-enabling later).
  is_active boolean not null default true,
  -- Short note shown under the seats line (e.g. "Por confirmar").
  seats_note text null,
  -- Free-form admin note. Not displayed to guests yet; reserved for the future
  -- admin/RSVP slice so this schema does not need to change then.
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.guest_groups is
  'Guest groups for personalized invitations (/i/[slug]).';
comment on column public.guest_groups.slug is
  'URL-safe identifier used in the /i/[slug] route. Primary key, so unique.';
comment on column public.guest_groups.display_name is
  'Name shown on the envelope (a family name or named invitee).';
comment on column public.guest_groups.assigned_seats is
  'Seats assigned, or null when the count is still pending confirmation.';
comment on column public.guest_groups.is_active is
  'Soft-delete/disable flag. Inactive groups behave as not found on /i/[slug].';
comment on column public.guest_groups.seats_note is
  'Short note shown under the seats line (e.g. "Por confirmar").';
comment on column public.guest_groups.notes is
  'Free-form admin note. Not displayed to guests yet; reserved for future admin/RSVP.';
comment on column public.guest_groups.created_at is 'Row creation timestamp.';
comment on column public.guest_groups.updated_at is 'Row last-update timestamp.';

-- Keep updated_at honest on future admin edits. Postgres does not auto-update
-- it, so a trigger is the standard approach.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guest_groups_touch_updated_at on public.guest_groups;
create trigger guest_groups_touch_updated_at
  before update on public.guest_groups
  for each row
  execute function public.touch_updated_at();

-- Supabase REST/PostgREST still requires explicit table privileges for the API
-- role, even when the request uses the service-role key. RLS bypass is not the
-- same thing as table permission. Keep the grant narrow for this slice: the app
-- only reads guest groups; inserts/updates stay in SQL/admin tools for now.
grant select on table public.guest_groups to service_role;
