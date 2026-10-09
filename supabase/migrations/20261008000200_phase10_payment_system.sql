-- Reuse the existing plans/payment_orders tables as the sole plan and order sources.
-- Keep the legacy payment_events table for audit/history compatibility.

begin;

alter table public.plans
  add column if not exists currency text not null default 'VND' check (currency = 'VND'),
  add column if not exists duration_days integer check (duration_days is null or duration_days > 0);

update public.plans
set daily_ai_limit = case slug when 'plus' then 15 when 'pro' then 25 when 'pro_max' then 40 else daily_ai_limit end,
    amount_vnd = case slug when 'plus' then 70000 when 'pro' then 100000 when 'pro_max' then 125000 else amount_vnd end,
    duration_days = case when slug in ('plus', 'pro', 'pro_max') then 30 else duration_days end,
    active = case when slug in ('plus', 'pro', 'pro_max') then true else active end,
    updated_at = now()
where slug in ('plus', 'pro', 'pro_max');

alter table public.payment_orders
  add column if not exists order_code text,
  add column if not exists plan_code text,
  add column if not exists plan_name_snapshot text,
  add column if not exists provider_reference text,
  add column if not exists updated_at timestamptz not null default now();

update public.payment_orders po
set order_code = coalesce(po.order_code, po.payment_code),
    plan_code = coalesce(po.plan_code, pl.slug),
    plan_name_snapshot = coalesce(po.plan_name_snapshot, pl.name),
    updated_at = coalesce(po.updated_at, po.created_at)
from public.plans pl
where po.plan_id = pl.id;

alter table public.payment_orders
  alter column order_code set not null,
  alter column plan_code set not null,
  alter column plan_name_snapshot set not null;
create unique index if not exists payment_orders_order_code_unique on public.payment_orders (order_code);
create index if not exists payment_orders_status_created_idx on public.payment_orders (status, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null references public.plans (slug) on update cascade on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  source_order_id uuid references public.payment_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);
create unique index subscriptions_one_active_per_user on public.subscriptions (user_id) where status = 'ACTIVE';
create index subscriptions_user_expiry_idx on public.subscriptions (user_id, expires_at desc);
create unique index subscriptions_source_order_unique on public.subscriptions (source_order_id) where source_order_id is not null;

-- Preserve existing live, manually assigned paid terms when introducing the subscription ledger.
insert into public.subscriptions (user_id, plan_code, status, started_at, expires_at)
select p.id, ca.paid_plan_slug, 'ACTIVE', p.vip_started_at, p.vip_expires_at
from public.profiles p
join public.credit_accounts ca on ca.user_id = p.id
join public.plans pl on pl.slug = ca.paid_plan_slug
where p.role <> 'admin' and p.vip_started_at <= now() and p.vip_expires_at > now()
on conflict do nothing;

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders (id) on delete restrict,
  provider text not null,
  provider_transaction_id text,
  provider_reference text,
  amount_vnd integer not null check (amount_vnd > 0),
  description text not null,
  status text not null check (status in ('PAID', 'REJECTED', 'REFUNDED')),
  raw_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index payment_transactions_provider_id_unique
  on public.payment_transactions (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create index payment_transactions_order_idx on public.payment_transactions (order_id, created_at desc);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  order_id uuid references public.payment_orders (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
create policy subscriptions_read_owner_or_admin on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy payment_transactions_read_owner_or_admin on public.payment_transactions for select to authenticated
  using ((select private.is_admin()) or exists (
    select 1 from public.payment_orders po where po.id = order_id and po.user_id = (select auth.uid())
  ));
create policy payment_webhook_events_admin_read on public.payment_webhook_events for select to authenticated
  using ((select private.is_admin()));
revoke all on public.subscriptions, public.payment_transactions, public.payment_webhook_events from public, anon, authenticated;
grant select on public.subscriptions, public.payment_webhook_events to authenticated;
grant select (id, order_id, provider, provider_transaction_id, provider_reference,
  amount_vnd, description, status, paid_at, created_at) on public.payment_transactions to authenticated;
revoke insert, update, delete on public.subscriptions, public.payment_transactions, public.payment_webhook_events from anon, authenticated;
grant all on public.subscriptions, public.payment_transactions, public.payment_webhook_events to service_role;

-- Compatibility views use the existing canonical plan and order records.
create or replace view public.subscription_plans with (security_invoker = true) as
select id, slug as code, name, amount_vnd as price_vnd,
       currency, duration_days, daily_ai_limit as ai_daily_limit,
       active as is_active, created_at, updated_at
from public.plans;
grant select on public.subscription_plans to anon, authenticated;

create or replace view public.orders with (security_invoker = true) as
select id, user_id, plan_code, plan_name_snapshot, amount_vnd, currency,
       upper(status::text) as status, order_code, expires_at, paid_at, created_at, updated_at
from public.payment_orders;
grant select on public.orders to authenticated;

create or replace function public.create_payment_order(p_user_id uuid, p_plan_code text, p_provider text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  selected_plan public.plans%rowtype;
  new_order public.payment_orders%rowtype;
  existing_order public.payment_orders%rowtype;
  next_code text;
begin
  perform private.assert_service_role();
  if p_user_id is null or p_plan_code not in ('plus', 'pro', 'pro_max') then
    raise exception 'invalid_payment_order_request' using errcode = '22023';
  end if;
  select * into selected_plan from public.plans
    where slug = p_plan_code and active and amount_vnd > 0 and daily_ai_limit > 0 for share;
  if not found then raise exception 'payment_plan_unavailable' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended('mathpath-payment-order:' || p_user_id::text || ':' || p_plan_code, 0));
  update public.payment_orders set status = 'expired', updated_at = now()
    where user_id = p_user_id and plan_id = selected_plan.id and status = 'pending' and expires_at <= now();
  select * into existing_order from public.payment_orders
    where user_id = p_user_id and plan_id = selected_plan.id and status = 'pending' and expires_at > now()
    order by created_at desc limit 1 for update;
  if found then
    return jsonb_build_object('id', existing_order.id, 'orderCode', existing_order.order_code,
      'planCode', existing_order.plan_code, 'planName', existing_order.plan_name_snapshot,
      'amountVnd', existing_order.amount_vnd, 'currency', existing_order.currency,
      'expiresAt', existing_order.expires_at);
  end if;

  -- pgcrypto lives in the `extensions` schema on production; this SECURITY DEFINER
  -- function has an empty search_path, so the function must be schema-qualified.
  next_code := 'MP' || upper(encode(extensions.gen_random_bytes(5), 'hex'));
  insert into public.payment_orders (user_id, plan_id, amount_vnd, currency, payment_code,
    order_code, plan_code, plan_name_snapshot, status, provider, expires_at)
  values (p_user_id, selected_plan.id, selected_plan.amount_vnd, selected_plan.currency,
    next_code, next_code, selected_plan.slug, selected_plan.name, 'pending',
    coalesce(nullif(p_provider, ''), 'unconfigured'), now() + interval '30 minutes')
  returning * into new_order;
  return jsonb_build_object('id', new_order.id, 'orderCode', new_order.order_code,
    'planCode', new_order.plan_code, 'planName', new_order.plan_name_snapshot,
    'amountVnd', new_order.amount_vnd, 'currency', new_order.currency,
    'expiresAt', new_order.expires_at);
end;
$$;

create or replace function public.process_payment_webhook(
  p_provider text, p_event_id text, p_order_code text, p_transaction_id text,
  p_provider_reference text, p_amount_vnd integer, p_description text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  payment_order public.payment_orders%rowtype;
  active_subscription public.subscriptions%rowtype;
  event_row_id uuid;
  start_time timestamptz;
  end_time timestamptz;
  plan_length integer;
begin
  perform private.assert_service_role();
  if p_provider is null or p_event_id is null or length(p_event_id) > 160
     or p_order_code is null or p_amount_vnd is null or p_amount_vnd <= 0 then
    raise exception 'invalid_payment_event' using errcode = '22023';
  end if;
  insert into public.payment_webhook_events (provider, event_id, payload)
    values (p_provider, p_event_id, coalesce(p_payload, '{}'::jsonb))
    on conflict (provider, event_id) do nothing returning id into event_row_id;
  if event_row_id is null then
    return jsonb_build_object('result', 'duplicate');
  end if;

  select * into payment_order from public.payment_orders
    where order_code = p_order_code for update;
  if not found then
    update public.payment_webhook_events set processed = true, processed_at = now() where id = event_row_id;
    return jsonb_build_object('result', 'order_not_found');
  end if;
  update public.payment_webhook_events set order_id = payment_order.id where id = event_row_id;
  if payment_order.amount_vnd <> p_amount_vnd then
    update public.payment_webhook_events set processed = true, processed_at = now() where id = event_row_id;
    return jsonb_build_object('result', 'amount_mismatch');
  end if;
  if payment_order.status = 'paid' then
    update public.payment_webhook_events set processed = true, processed_at = now() where id = event_row_id;
    return jsonb_build_object('result', 'already_paid');
  end if;
  if payment_order.status <> 'pending' or payment_order.expires_at <= now() then
    update public.payment_orders set status = 'expired', updated_at = now()
      where id = payment_order.id and status = 'pending';
    update public.payment_webhook_events set processed = true, processed_at = now() where id = event_row_id;
    return jsonb_build_object('result', 'order_expired');
  end if;
  if p_transaction_id is not null and exists (
    select 1 from public.payment_transactions where provider = p_provider and provider_transaction_id = p_transaction_id
  ) then
    update public.payment_webhook_events set processed = true, processed_at = now() where id = event_row_id;
    return jsonb_build_object('result', 'duplicate_transaction');
  end if;

  insert into public.payment_transactions (order_id, provider, provider_transaction_id,
    provider_reference, amount_vnd, description, status, raw_payload, paid_at)
  values (payment_order.id, p_provider, p_transaction_id, p_provider_reference,
    p_amount_vnd, coalesce(p_description, ''), 'PAID', coalesce(p_payload, '{}'::jsonb), now());
  update public.payment_orders set status = 'paid', provider = p_provider,
    provider_transaction_id = p_transaction_id, provider_reference = p_provider_reference,
    paid_at = now(), updated_at = now() where id = payment_order.id;

  select duration_days into plan_length from public.plans where slug = payment_order.plan_code;
  if plan_length is null then raise exception 'payment_plan_duration_missing'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mathpath-subscription:' || payment_order.user_id::text, 0));
  select * into active_subscription from public.subscriptions
    where user_id = payment_order.user_id and status = 'ACTIVE' for update;
  if found and active_subscription.expires_at > now() then
    start_time := active_subscription.started_at;
    end_time := active_subscription.expires_at + make_interval(days => plan_length);
    update public.subscriptions set plan_code = payment_order.plan_code, expires_at = end_time,
      source_order_id = payment_order.id, updated_at = now()
      where id = active_subscription.id;
  else
    if found then
      update public.subscriptions
      set status = case when active_subscription.expires_at > now() then 'CANCELLED' else 'EXPIRED' end,
          updated_at = now()
      where id = active_subscription.id;
    end if;
    start_time := now();
    end_time := start_time + make_interval(days => plan_length);
    insert into public.subscriptions (user_id, plan_code, status, started_at, expires_at, source_order_id)
      values (payment_order.user_id, payment_order.plan_code, 'ACTIVE', start_time, end_time, payment_order.id);
  end if;

  -- Compatibility projection used by current profile and AI quota readers.
  insert into public.credit_accounts (user_id, paid_plan_slug) values (payment_order.user_id, payment_order.plan_code)
    on conflict (user_id) where user_id is not null do update set paid_plan_slug = excluded.paid_plan_slug, updated_at = now();
  update public.profiles set vip_started_at = start_time, vip_expires_at = end_time, updated_at = now()
    where id = payment_order.user_id;
  update public.payment_webhook_events set processed = true, processed_at = now() where id = event_row_id;
  return jsonb_build_object('result', 'paid', 'orderId', payment_order.id,
    'userId', payment_order.user_id, 'planCode', payment_order.plan_code,
    'startedAt', start_time, 'expiresAt', end_time);
end;
$$;

revoke all on function public.create_payment_order(uuid, text, text) from public, anon, authenticated;
revoke all on function public.process_payment_webhook(text, text, text, text, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_payment_order(uuid, text, text) to service_role;
grant execute on function public.process_payment_webhook(text, text, text, text, text, integer, text, jsonb) to service_role;

commit;
