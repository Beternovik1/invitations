-- Establish the current event and additive internal guest-group identity.
--
-- Existing invitation URLs and RSVP records continue to use guest_groups.slug.
-- The new UUID is unique internal identity, but slug remains the physical
-- primary key in this slice. Defaults preserve the existing server insert path,
-- which does not yet send either new column.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique
);

comment on table public.events is
  'Event roots used to scope invitation data.';
comment on column public.events.id is
  'Stable internal event identity.';
comment on column public.events.event_key is
  'Stable unique key for an event.';

-- Current production event, verified from src/lib/constants.ts: Sarahí's
-- quinceañera on October 17, 2026.
insert into public.events (id, event_key)
values ('4d7634e2-1f61-4e94-9b44-26f93144d534', 'sarahi-xv-2026');

alter table public.guest_groups
  add column id uuid null default gen_random_uuid(),
  add column event_id uuid null default '4d7634e2-1f61-4e94-9b44-26f93144d534'::uuid;

-- Backfill explicitly before tightening constraints so every pre-existing row
-- receives stable identity even if column-default behavior changes.
update public.guest_groups
set id = gen_random_uuid()
where id is null;

update public.guest_groups
set event_id = (
  select id
  from public.events
  where event_key = 'sarahi-xv-2026'
)
where event_id is null;

alter table public.guest_groups
  alter column id set not null,
  alter column event_id set not null,
  add constraint guest_groups_id_key unique (id),
  add constraint guest_groups_event_id_fkey
    foreign key (event_id) references public.events(id);

comment on column public.guest_groups.id is
  'Stable internal UUID identity; slug remains the physical primary key.';
comment on column public.guest_groups.event_id is
  'Event root for this guest group.';

-- Event metadata remains server-only, matching the repository's existing
-- service-role table access. No browser role receives access in this slice.
grant select on table public.events to service_role;
