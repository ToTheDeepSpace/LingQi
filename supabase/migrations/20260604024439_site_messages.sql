create table if not exists public.lc_site_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.lc_profiles(id) on delete set null,
  sender_name text not null,
  subject text not null,
  content text not null,
  contact text,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lc_site_messages_status_created
  on public.lc_site_messages(status, created_at desc);

create index if not exists idx_lc_site_messages_sender_created
  on public.lc_site_messages(sender_id, created_at desc);

alter table public.lc_site_messages enable row level security;

grant select, insert, update on table public.lc_site_messages to service_role;
