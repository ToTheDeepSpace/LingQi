alter table public.lc_commissions
  add column if not exists script_id uuid references public.scripts(id) on delete set null,
  add column if not exists script_name text;

create index if not exists idx_lc_commissions_script_id
  on public.lc_commissions(script_id);

create index if not exists idx_lc_commissions_script_name
  on public.lc_commissions(script_name);
