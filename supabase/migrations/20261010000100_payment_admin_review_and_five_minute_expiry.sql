begin;

alter table public.payment_orders
  add column if not exists customer_reported_paid_at timestamptz;

-- Bring existing unpaid orders under the five-minute deadline without deleting history.
update public.payment_orders
set status = 'expired', updated_at = now()
where status = 'pending' and created_at + interval '5 minutes' <= now();
update public.payment_orders
set expires_at = least(expires_at, created_at + interval '5 minutes'), updated_at = now()
where status = 'pending' and expires_at > created_at + interval '5 minutes';

create table if not exists public.payment_order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.payment_orders (id) on delete restrict,
  admin_user_id uuid not null references public.profiles (id) on delete restrict,
  source_provider text not null,
  action text not null check (action in ('approved', 'cancelled')),
  transaction_reference text,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (action <> 'approved' or nullif(btrim(transaction_reference), '') is not null)
);

alter table public.payment_order_reviews enable row level security;
drop policy if exists payment_order_reviews_admin_read on public.payment_order_reviews;
create policy payment_order_reviews_admin_read on public.payment_order_reviews
  for select to authenticated using ((select private.is_admin()));
revoke all on public.payment_order_reviews from public, anon;
grant select on public.payment_order_reviews to authenticated;
grant all on public.payment_order_reviews to service_role;

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

  next_code := 'MP' || upper(encode(gen_random_bytes(5), 'hex'));
  insert into public.payment_orders (user_id, plan_id, amount_vnd, currency, payment_code,
    order_code, plan_code, plan_name_snapshot, status, provider, expires_at)
  values (p_user_id, selected_plan.id, selected_plan.amount_vnd, selected_plan.currency,
    next_code, next_code, selected_plan.slug, selected_plan.name, 'pending',
    coalesce(nullif(p_provider, ''), 'unconfigured'), now() + interval '5 minutes')
  returning * into new_order;
  return jsonb_build_object('id', new_order.id, 'orderCode', new_order.order_code,
    'planCode', new_order.plan_code, 'planName', new_order.plan_name_snapshot,
    'amountVnd', new_order.amount_vnd, 'currency', new_order.currency,
    'expiresAt', new_order.expires_at);
end;
$$;

create or replace function public.admin_review_payment_order(
  p_admin_user_id uuid,
  p_order_id uuid,
  p_action text,
  p_transaction_reference text default null,
  p_note text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  payment_order public.payment_orders%rowtype;
  event_id text;
  tx_id text;
  result jsonb;
  transaction_ref text := nullif(btrim(p_transaction_reference), '');
  note_text text := left(coalesce(p_note, ''), 1000);
begin
  perform private.assert_service_role();
  if p_admin_user_id is null or not exists (
    select 1 from public.profiles where id = p_admin_user_id and role = 'admin'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('approve', 'cancel') then
    raise exception 'invalid_review_action' using errcode = '22023';
  end if;
  if p_action = 'approve' and (transaction_ref is null or length(transaction_ref) > 200) then
    raise exception 'transaction_reference_required' using errcode = '22023';
  end if;

  select * into payment_order from public.payment_orders where id = p_order_id for update;
  if not found then return jsonb_build_object('result', 'order_not_found'); end if;
  if payment_order.status not in ('pending', 'expired') then
    return jsonb_build_object('result', 'order_not_pending', 'status', payment_order.status::text);
  end if;
  if payment_order.status = 'expired' and p_action = 'cancel' then
    return jsonb_build_object('result', 'order_expired');
  end if;
  if payment_order.status = 'pending' and payment_order.expires_at <= now() then
    update public.payment_orders set status = 'expired', updated_at = now() where id = payment_order.id;
    if p_action = 'cancel' then return jsonb_build_object('result', 'order_expired'); end if;
  end if;
  if payment_order.status = 'expired' or payment_order.expires_at <= now() then
    -- Expiry blocks automatic webhook activation. An admin may reconcile a late
    -- bank transfer only after entering its provider reference and attesting it was verified.
    update public.payment_orders set status = 'pending', expires_at = now() + interval '5 minutes', updated_at = now()
      where id = payment_order.id and status = 'expired';
  end if;

  if p_action = 'cancel' then
    update public.payment_orders set status = 'cancelled', updated_at = now()
      where id = payment_order.id and status = 'pending';
    insert into public.payment_order_reviews
      (order_id, admin_user_id, source_provider, action, transaction_reference, note)
    values (payment_order.id, p_admin_user_id, payment_order.provider, 'cancelled', transaction_ref, note_text);
    return jsonb_build_object('result', 'cancelled', 'orderId', payment_order.id);
  end if;

  event_id := 'admin-review:' || gen_random_uuid()::text;
  tx_id := 'admin-review:' || gen_random_uuid()::text;
  result := public.process_payment_webhook(
    'manual_admin', event_id, payment_order.order_code, tx_id, transaction_ref,
    payment_order.amount_vnd, coalesce(nullif(note_text, ''), 'Admin verified payment in SePay'),
    jsonb_build_object('source', 'admin_verified_sepay', 'admin_user_id', p_admin_user_id,
      'source_provider', payment_order.provider, 'transaction_reference', transaction_ref, 'note', note_text)
  );
  if result ->> 'result' = 'paid' then
    update public.payment_orders set provider = payment_order.provider where id = payment_order.id;
    insert into public.payment_order_reviews
      (order_id, admin_user_id, source_provider, action, transaction_reference, note)
    values (payment_order.id, p_admin_user_id, payment_order.provider, 'approved', transaction_ref, note_text);
  end if;
  return result;
end;
$$;

revoke all on function public.admin_review_payment_order(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_payment_order(uuid, uuid, text, text, text) to service_role;

commit;
