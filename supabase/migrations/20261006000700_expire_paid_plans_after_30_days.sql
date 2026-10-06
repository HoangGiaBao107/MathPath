begin;

create or replace function private.start_paid_plan_term()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_changed boolean;
begin
  if new.user_id is null or new.paid_plan_slug is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    plan_changed := true;
  else
    plan_changed := old.paid_plan_slug is distinct from new.paid_plan_slug;
  end if;

  if plan_changed then
    update public.profiles
    set vip_started_at = now(),
        vip_expires_at = now() + interval '30 days',
        updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function private.start_paid_plan_term() from public, anon, authenticated;

drop trigger if exists credit_account_start_paid_plan_term on public.credit_accounts;
create trigger credit_account_start_paid_plan_term
  after insert or update of paid_plan_slug on public.credit_accounts
  for each row execute function private.start_paid_plan_term();

-- Existing paid assignments without an expiry get one 30-day term from now.
update public.profiles p
set vip_started_at = coalesce(p.vip_started_at, now()),
    vip_expires_at = coalesce(p.vip_expires_at, now() + interval '30 days'),
    updated_at = now()
where p.vip_expires_at is null
  and exists (
    select 1 from public.credit_accounts ca
    where ca.user_id = p.id and ca.paid_plan_slug is not null
  );

commit;
