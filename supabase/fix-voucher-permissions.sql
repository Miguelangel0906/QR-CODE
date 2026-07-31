-- Reparación de guardado para instalaciones que ya tenían la tabla vouchers.
-- Ejecuta todo este archivo en Supabase > SQL Editor.

alter table public.vouchers add column if not exists redeemed boolean not null default false;
alter table public.vouchers add column if not exists created_at timestamptz not null default now();
alter table public.vouchers add column if not exists redeemed_at timestamptz;
alter table public.vouchers enable row level security;

grant usage on schema public to authenticated;
revoke all on table public.vouchers from anon, authenticated;
grant select, insert on table public.vouchers to authenticated;

drop policy if exists "anon_select_vouchers" on public.vouchers;
drop policy if exists "anon_insert_vouchers" on public.vouchers;
drop policy if exists "admins_read_vouchers" on public.vouchers;
drop policy if exists "helpers_read_station_vouchers" on public.vouchers;
drop policy if exists "admins_insert_vouchers" on public.vouchers;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admins_read_vouchers"
on public.vouchers for select to authenticated
using ((select public.is_admin()));

create policy "helpers_read_station_vouchers"
on public.vouchers for select to authenticated
using (station = (
    select profiles.station from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'ayudante'
));

create policy "admins_insert_vouchers"
on public.vouchers for insert to authenticated
with check (
    redeemed = false
    and redeemed_at is null
    and (select public.is_admin())
);

-- Resultado de diagnóstico: el correo administrador debe mostrar role = admin.
select email, role, station
from public.profiles
order by email;

-- Debe devolver can_select = true y can_insert = true.
select
    has_table_privilege('authenticated', 'public.vouchers', 'SELECT') as can_select,
    has_table_privilege('authenticated', 'public.vouchers', 'INSERT') as can_insert;
