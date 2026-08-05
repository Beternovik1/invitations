-- Add reusable event-scoped seating tables and guest-group assignments.
--
-- This foundation is intentionally data-only: no default tables, no current
-- event assumptions, and no changes to invitation links, RSVPs, QR, or UI.

alter table public.guest_groups
  add constraint guest_groups_event_id_id_key unique (event_id, id);

create table if not exists public.event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  capacity integer not null check (capacity > 0),
  display_order integer not null check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_tables_event_id_id_key unique (event_id, id),
  constraint event_tables_event_id_label_key unique (event_id, label),
  constraint event_tables_event_id_display_order_key unique (event_id, display_order)
);

comment on table public.event_tables is
  'Reusable seating tables scoped to one event.';
comment on column public.event_tables.id is
  'Stable seating table UUID identity.';
comment on column public.event_tables.event_id is
  'Event root for this seating table.';
comment on column public.event_tables.label is
  'Human-facing seating table label, such as Mesa 1.';
comment on column public.event_tables.capacity is
  'Positive table capacity.';
comment on column public.event_tables.display_order is
  'Positive event-scoped display order for seating lists.';
comment on column public.event_tables.created_at is 'Row creation timestamp.';
comment on column public.event_tables.updated_at is 'Row last-update timestamp.';

drop trigger if exists event_tables_touch_updated_at on public.event_tables;
create trigger event_tables_touch_updated_at
  before update on public.event_tables
  for each row
  execute function public.touch_updated_at();

create table if not exists public.guest_group_table_assignments (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_group_id uuid not null,
  table_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_group_table_assignments_pkey primary key (event_id, guest_group_id),
  constraint guest_group_table_assignments_guest_group_fkey
    foreign key (event_id, guest_group_id)
    references public.guest_groups(event_id, id)
    on delete cascade,
  constraint guest_group_table_assignments_table_fkey
    foreign key (event_id, table_id)
    references public.event_tables(event_id, id)
    on delete cascade
);

comment on table public.guest_group_table_assignments is
  'Current event-scoped seating table assignment for each guest group.';
comment on column public.guest_group_table_assignments.event_id is
  'Event root for this guest-group seating assignment.';
comment on column public.guest_group_table_assignments.guest_group_id is
  'Stable guest-group UUID assigned to a seating table.';
comment on column public.guest_group_table_assignments.table_id is
  'Stable seating table UUID assigned to the guest group.';
comment on column public.guest_group_table_assignments.created_at is 'Row creation timestamp.';
comment on column public.guest_group_table_assignments.updated_at is 'Row last-update timestamp.';

drop trigger if exists guest_group_table_assignments_touch_updated_at on public.guest_group_table_assignments;
create trigger guest_group_table_assignments_touch_updated_at
  before update on public.guest_group_table_assignments
  for each row
  execute function public.touch_updated_at();

-- Keep access server-only. Do not grant browser roles direct seating access.
grant select, insert, update, delete on table public.event_tables to service_role;
grant select, insert, update, delete on table public.guest_group_table_assignments to service_role;
