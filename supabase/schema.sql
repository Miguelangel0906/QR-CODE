-- Ejecuta este archivo completo en Supabase > SQL Editor.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique not null,
    role text check (role in ('admin', 'ayudante')),
    station text,
    created_at timestamptz not null default now(),
    constraint helper_requires_station check (role <> 'ayudante' or station is not null)
);

create table if not exists public.vouchers (
    id text primary key,
    station text not null,
    validity date not null,
    redeemed boolean not null default false,
    created_at timestamptz not null default now(),
    redeemed_at timestamptz
);

-- Crea automáticamente un perfil pendiente cuando se registra un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

-- Agrega perfiles para usuarios que ya existían antes de instalar este esquema.
insert into public.profiles (id, email)
select id, email from auth.users where email is not null
on conflict (id) do update set email = excluded.email;

alter table public.profiles enable row level security;
alter table public.vouchers enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.vouchers from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select, insert on table public.vouchers to authenticated;

drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "anon_select_vouchers" on public.vouchers;
drop policy if exists "anon_insert_vouchers" on public.vouchers;
drop policy if exists "admins_read_vouchers" on public.vouchers;
drop policy if exists "helpers_read_station_vouchers" on public.vouchers;
drop policy if exists "admins_insert_vouchers" on public.vouchers;

create policy "admins_read_vouchers"
on public.vouchers for select to authenticated
using (exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
));

create policy "helpers_read_station_vouchers"
on public.vouchers for select to authenticated
using (station = (
    select profiles.station from public.profiles
    where id = (select auth.uid()) and role = 'ayudante'
));

create policy "admins_insert_vouchers"
on public.vouchers for insert to authenticated
with check (
    redeemed = false
    and redeemed_at is null
    and exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and role = 'admin'
    )
);

-- Valida y canjea con bloqueo de fila para impedir dobles canjes.
create or replace function public.redeem_voucher(
    voucher_id text,
    scanner_station text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    voucher public.vouchers%rowtype;
    user_role text;
    user_station text;
begin
    select role, station into user_role, user_station
    from public.profiles
    where id = auth.uid();

    if user_role is null then
        return jsonb_build_object('success', false, 'status', 'unauthorized');
    end if;

    if user_role = 'ayudante' and user_station <> scanner_station then
        return jsonb_build_object('success', false, 'status', 'unauthorized_station');
    end if;

    select * into voucher
    from public.vouchers
    where id = voucher_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'status', 'not_found');
    end if;
    if voucher.redeemed then
        return jsonb_build_object('success', false, 'status', 'already_redeemed');
    end if;
    if voucher.validity < current_date then
        return jsonb_build_object('success', false, 'status', 'expired');
    end if;
    if voucher.station <> scanner_station then
        return jsonb_build_object('success', false, 'status', 'wrong_station');
    end if;

    update public.vouchers
    set redeemed = true, redeemed_at = now()
    where id = voucher_id;

    return jsonb_build_object('success', true, 'status', 'redeemed');
end;
$$;

revoke all on function public.redeem_voucher(text, text) from public, anon;
grant execute on function public.redeem_voucher(text, text) to authenticated;

-- ASIGNACIÓN DE ROLES (cambia los correos y ejecuta después de crear usuarios):
-- update public.profiles set role = 'admin', station = null
-- where email = 'administrador@empresa.com';
--
-- update public.profiles set role = 'ayudante', station = 'EL SOL'
-- where email = 'ayudante@empresa.com';
