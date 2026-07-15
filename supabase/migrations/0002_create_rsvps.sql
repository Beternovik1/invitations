-- RSVPs for guest groups.
--
-- One row per guest group (`guest_group_slug` is the primary key), recording how
-- many seats they confirm and an optional message to the host. Because the
-- primary key is the guest group slug, a group can confirm exactly once; a
-- repeat submission upserts (updates) the existing row.
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting this file into
-- the Supabase SQL editor. No secrets are required to run this migration.
--
-- This schema is the database half of the RSVP data boundary in `src/lib/rsvps.ts`.
-- The app reads and writes it via the Supabase REST API when
-- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, using the
-- service-role key (server-only). Only the server/API role is granted access;
-- no auth/admin RLS policies are added in this slice.

create table if not exists public.rsvps (
  -- Primary key and foreign key to the guest group. One RSVP per group, so the
  -- slug doubles as the row identity. `on delete cascade` so removing a guest
  -- group also drops its RSVP (the admin slice can revisit this if history must
  -- survive group deletion).
  guest_group_slug text primary key references public.guest_groups(slug) on delete cascade,
  -- How many seats the group confirms. The DB guarantees a non-negative
  -- integer; the upper bound (0..assigned_seats) is enforced in the application
  -- boundary because `assigned_seats` can be null (pending) and can change, so a
  -- static check constraint cannot express it cleanly.
  attending_count integer not null check (attending_count >= 0),
  -- Optional message to the host. Trimmed and length-capped in the boundary.
  message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rsvps is
  'RSVP confirmations for guest groups (/i/[slug]). One row per group.';
comment on column public.rsvps.guest_group_slug is
  'Guest group slug; primary key (one RSVP per group) and foreign key to guest_groups(slug).';
comment on column public.rsvps.attending_count is
  'Seats the group confirms. Non-negative; upper bound enforced in the app boundary.';
comment on column public.rsvps.message is
  'Optional guest message to the host. Trimmed and length-capped in the app boundary.';
comment on column public.rsvps.created_at is 'Row creation timestamp.';
comment on column public.rsvps.updated_at is 'Row last-update timestamp.';

-- Keep updated_at honest on updates. The touch_updated_at() function was
-- created by migration 0001 for guest_groups; reuse it here so there is one
-- shared definition rather than a per-table copy.
drop trigger if exists rsvps_touch_updated_at on public.rsvps;
create trigger rsvps_touch_updated_at
  before update on public.rsvps
  for each row
  execute function public.touch_updated_at();

-- Supabase REST/PostgREST requires explicit table privileges for the API role,
-- even when the request uses the service-role key (RLS bypass is not the same
-- as table permission). Keep the grant narrow to what this slice needs: read an
-- existing RSVP, insert a new RSVP, and update an existing RSVP. Deletes stay in
-- SQL/admin tools for now (there is no "un-RSVP" user flow in this slice).
grant select, insert, update on table public.rsvps to service_role;