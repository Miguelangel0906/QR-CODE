-- Ejecuta este archivo en Supabase > SQL Editor.
create table if not exists public.vouchers (
    id text primary key,
    station text not null,
    validity date not null,
    redeemed boolean not null default false,
    created_at timestamptz not null default now(),
    redeemed_at timestamptz
);

alter table public.vouchers enable row level security;

revoke all on table public.vouchers from anon, authenticated;
grant select, insert on table public.vouchers to anon;

drop policy if exists "anon_select_vouchers" on public.vouchers;
create policy "anon_select_vouchers"
on public.vouchers for select to anon
using (true);

drop policy if exists "anon_insert_vouchers" on public.vouchers;
create policy "anon_insert_vouchers"
on public.vouchers for insert to anon
with check (
    id <> ''
    and station <> ''
    and redeemed = false
    and redeemed_at is null
);

-- Bloquea la fila para impedir dos canjes simultáneos.
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
begin
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

revoke all on function public.redeem_voucher(text, text) from public;
grant execute on function public.redeem_voucher(text, text) to anon;

-- MVP sin inicio de sesión. Antes de producción, usa Supabase Auth y
-- limita SELECT/INSERT por rol y estación.
