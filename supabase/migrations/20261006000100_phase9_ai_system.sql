begin;

-- Phase 9 updates the existing credit system; no parallel quota store is introduced.
update public.plans
set daily_ai_limit = 40,
    description = '40 AI requests per Vietnam calendar day',
    updated_at = now()
where slug = 'pro_max';

alter table public.ai_usage
  drop constraint if exists ai_usage_request_type_check;
alter table public.ai_usage
  add constraint ai_usage_request_type_check
  check (request_type in ('chat', 'solve_text', 'solve_image', 'practice', 'recommend', 'similar_problem'));

alter table public.credit_reservations
  add column if not exists reserved_for_date date,
  add column if not exists unlimited boolean not null default false;

-- Private server-side answer store for AI-generated practice. No browser role can read it.
create table public.ai_practice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  guest_session_hash text,
  statement text not null,
  question_type text not null check (question_type in ('multiple_choice', 'short_answer')),
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  correct_answer text not null,
  explanation text not null,
  topic text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  source_context text not null,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check ((user_id is null) <> (guest_session_hash is null))
);
alter table public.ai_practice_items enable row level security;
revoke all on public.ai_practice_items from public, anon, authenticated;
grant select, insert, delete on public.ai_practice_items to service_role;

create or replace function private.release_expired_ai_reservations(p_account_id uuid, p_reset_day date)
returns void language plpgsql security definer set search_path = '' as $$
declare expired public.credit_reservations%rowtype;
begin
  perform private.assert_service_role();
  for expired in
    select * from public.credit_reservations
    where credit_account_id = p_account_id and status = 'reserved' and expires_at <= now()
    for update
  loop
    update public.credit_reservations set status = 'released', completed_at = now() where id = expired.id;
    if not expired.unlimited and expired.reserved_for_date = p_reset_day then
      if expired.bucket = 'guest_free' then
        update public.credit_accounts set guest_total_used = greatest(0, guest_total_used - 1), updated_at = now() where id = p_account_id;
      elsif expired.bucket = 'plan_daily' then
        update public.credit_accounts set plan_daily_used = greatest(0, plan_daily_used - 1), updated_at = now() where id = p_account_id;
      elsif expired.bucket = 'account_free' then
        update public.credit_accounts set account_daily_used = greatest(0, account_daily_used - 1), updated_at = now() where id = p_account_id;
      end if;
    end if;
    insert into public.credit_ledger (credit_account_id, kind, bucket, amount, request_id, reservation_id, reason)
      values (p_account_id, 'release', expired.bucket, 1, expired.request_id, expired.id, 'phase9_expired_reservation')
      on conflict (request_id, kind) where request_id is not null do nothing;
    update public.ai_usage set status = 'released', completed_at = now()
      where request_id = expired.request_id and status = 'reserved';
  end loop;
end;
$$;
revoke all on function private.release_expired_ai_reservations(uuid,date) from public, anon, authenticated, service_role;

create or replace function public.reserve_ai_request(
  p_user_id uuid,
  p_guest_session_hash text,
  p_request_id text,
  p_request_type text,
  p_input_type text,
  p_provider text,
  p_model text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  account public.credit_accounts%rowtype;
  profile_role public.app_role;
  vip_start timestamptz;
  vip_expiry timestamptz;
  plan_limit integer;
  effective_plan text;
  reset_day date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  reset_at timestamptz;
  chosen_bucket public.credit_bucket;
  reservation_id uuid;
  usage_id uuid;
  is_unlimited boolean := false;
  remaining_count integer;
  max_count integer;
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null)
     or p_request_id is null or length(p_request_id) > 80
     or p_request_type not in ('chat', 'solve_text', 'solve_image', 'practice', 'recommend')
     or p_input_type not in ('text', 'image', 'mixed') then
    raise exception 'invalid_ai_reservation' using errcode = '22023';
  end if;
  if p_guest_session_hash is not null and p_guest_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_guest_session' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mathpath-ai:' || coalesce(p_user_id::text, p_guest_session_hash), 0));

  if p_user_id is not null then
    select role, vip_started_at, vip_expires_at into profile_role, vip_start, vip_expiry
    from public.profiles where id = p_user_id;
    if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
    is_unlimited := profile_role = 'admin';
    insert into public.credit_accounts (user_id) values (p_user_id)
    on conflict (user_id) where user_id is not null do nothing;
  else
    insert into public.credit_accounts (guest_session_hash) values (p_guest_session_hash)
    on conflict (guest_session_hash) where guest_session_hash is not null do nothing;
  end if;

  select * into account from public.credit_accounts
  where (p_user_id is not null and user_id = p_user_id)
     or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash)
  for update;
  if not found then raise exception 'credit_account_unavailable' using errcode = 'P0001'; end if;
  perform private.release_expired_ai_reservations(account.id, reset_day);
  select * into account from public.credit_accounts where id = account.id for update;

  if account.daily_reset_date is distinct from reset_day then
    update public.credit_accounts set account_daily_used = 0, plan_daily_used = 0,
      daily_reset_date = reset_day, updated_at = now()
    where id = account.id returning * into account;
  end if;

  effective_plan := null;
  if p_user_id is not null and vip_start is not null and vip_start <= now()
     and (vip_expiry is null or vip_expiry > now()) then
    effective_plan := account.paid_plan_slug;
    if effective_plan is not null then
      select daily_ai_limit into plan_limit from public.plans where slug = effective_plan;
      if plan_limit is null or plan_limit <= 0 then effective_plan := null; end if;
    end if;
  end if;

  if p_guest_session_hash is not null then
    chosen_bucket := 'guest_free';
    max_count := account.guest_total_limit;
    if not is_unlimited and account.guest_total_used >= account.guest_total_limit then
      raise exception 'ai_quota_exhausted' using errcode = 'P0001';
    end if;
    update public.credit_accounts set guest_total_used = guest_total_used + 1, updated_at = now()
      where id = account.id returning * into account;
  elsif is_unlimited then
    chosen_bucket := 'account_free';
    max_count := null;
  elsif effective_plan is not null then
    chosen_bucket := 'plan_daily';
    max_count := plan_limit;
    if account.plan_daily_used >= plan_limit then raise exception 'ai_quota_exhausted' using errcode = 'P0001'; end if;
    update public.credit_accounts set plan_daily_used = plan_daily_used + 1, updated_at = now()
      where id = account.id returning * into account;
  else
    chosen_bucket := 'account_free';
    max_count := account.account_daily_limit;
    if account.account_daily_used >= account.account_daily_limit then
      raise exception 'ai_quota_exhausted' using errcode = 'P0001';
    end if;
    update public.credit_accounts set account_daily_used = account_daily_used + 1, updated_at = now()
      where id = account.id returning * into account;
  end if;

  insert into public.credit_reservations (credit_account_id, request_id, bucket, expires_at, reserved_for_date, unlimited)
  values (account.id, p_request_id, chosen_bucket, now() + interval '5 minutes', reset_day, is_unlimited)
  returning id into reservation_id;
  insert into public.credit_ledger (credit_account_id, kind, bucket, amount, request_id, reservation_id, reason)
  values (account.id, 'reservation', chosen_bucket, 1, p_request_id, reservation_id, 'phase9_ai_request');
  insert into public.ai_usage (user_id, guest_session_hash, request_id, request_type, input_type, provider, model, status)
  values (p_user_id, p_guest_session_hash, p_request_id, p_request_type, p_input_type, p_provider, p_model, 'reserved')
  returning id into usage_id;

  if p_guest_session_hash is not null then
    remaining_count := greatest(0, account.guest_total_limit - account.guest_total_used);
    reset_at := null;
  elsif is_unlimited then
    remaining_count := null;
    reset_at := null;
  elsif effective_plan is not null then
    remaining_count := greatest(0, plan_limit - account.plan_daily_used);
    reset_at := ((reset_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  else
    remaining_count := greatest(0, account.account_daily_limit - account.account_daily_used);
    reset_at := ((reset_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  end if;
  return jsonb_build_object('kind', case when p_guest_session_hash is not null then 'guest' when is_unlimited then 'admin' else 'account' end,
    'reservationId', reservation_id, 'usageId', usage_id, 'requestId', p_request_id,
    'bucket', chosen_bucket, 'plan', coalesce(effective_plan, 'free'), 'unlimited', is_unlimited,
    'remaining', remaining_count, 'limit', max_count, 'resetAt', reset_at);
end;
$$;

create or replace function public.get_ai_quota(p_user_id uuid, p_guest_session_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account public.credit_accounts%rowtype;
  profile_role public.app_role;
  vip_start timestamptz;
  vip_expiry timestamptz;
  plan_limit integer;
  plan_slug text;
  reset_day date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  reset_at timestamptz;
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null) then raise exception 'invalid_ai_owner' using errcode = '22023'; end if;
  if p_guest_session_hash is not null and p_guest_session_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_guest_session' using errcode = '22023'; end if;
  if p_user_id is not null then
    select role, vip_started_at, vip_expires_at into profile_role, vip_start, vip_expiry from public.profiles where id = p_user_id;
    if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
    insert into public.credit_accounts (user_id) values (p_user_id) on conflict (user_id) where user_id is not null do nothing;
  else
    insert into public.credit_accounts (guest_session_hash) values (p_guest_session_hash) on conflict (guest_session_hash) where guest_session_hash is not null do nothing;
  end if;
  select * into account from public.credit_accounts
  where (p_user_id is not null and user_id = p_user_id) or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash);
  perform private.release_expired_ai_reservations(account.id, reset_day);
  select * into account from public.credit_accounts where id = account.id for update;
  if account.daily_reset_date is distinct from reset_day then
    update public.credit_accounts set account_daily_used = 0, plan_daily_used = 0,
      daily_reset_date = reset_day, updated_at = now() where id = account.id returning * into account;
  end if;
  if p_guest_session_hash is not null then
    return jsonb_build_object('kind','guest','plan','guest','unlimited',false,'remaining',greatest(0,account.guest_total_limit-account.guest_total_used),'limit',account.guest_total_limit,'resetAt',null);
  end if;
  if profile_role = 'admin' then
    return jsonb_build_object('kind','admin','plan','admin','unlimited',true,'remaining',null,'limit',null,'resetAt',null);
  end if;
  if vip_start is not null and vip_start <= now() and (vip_expiry is null or vip_expiry > now()) then
    plan_slug := account.paid_plan_slug;
    if plan_slug is not null then select daily_ai_limit into plan_limit from public.plans where slug = plan_slug; end if;
    if plan_limit is not null and plan_limit > 0 then
      reset_at := ((reset_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
      return jsonb_build_object('kind','account','plan',plan_slug,'unlimited',false,'remaining',greatest(0,plan_limit-account.plan_daily_used),'limit',plan_limit,'resetAt',reset_at);
    end if;
  end if;
  reset_at := ((reset_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  return jsonb_build_object('kind','account','plan','free','unlimited',false,'remaining',greatest(0,account.account_daily_limit-account.account_daily_used),'limit',account.account_daily_limit,'resetAt',reset_at);
end;
$$;

create or replace function public.finish_ai_request(
  p_reservation_id uuid,
  p_usage_id uuid,
  p_succeeded boolean,
  p_duration_ms integer,
  p_input_tokens integer default null,
  p_output_tokens integer default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  reservation public.credit_reservations%rowtype;
  reset_day date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform private.assert_service_role();
  select * into reservation from public.credit_reservations where id = p_reservation_id for update;
  if not found then raise exception 'ai_reservation_not_found' using errcode = 'P0002'; end if;
  if reservation.status <> 'reserved' then return false; end if;
  if p_succeeded then
    update public.credit_reservations set status = 'committed', completed_at = now() where id = reservation.id;
    insert into public.credit_ledger (credit_account_id, kind, bucket, amount, request_id, reservation_id, reason)
      values (reservation.credit_account_id, 'commit', reservation.bucket, 1, reservation.request_id, reservation.id, 'phase9_ai_success');
    update public.ai_usage set status = 'succeeded', duration_ms = greatest(0, p_duration_ms),
      input_tokens = p_input_tokens, output_tokens = p_output_tokens, completed_at = now() where id = p_usage_id and request_id = reservation.request_id;
  else
    update public.credit_reservations set status = 'released', completed_at = now() where id = reservation.id;
    if not reservation.unlimited and reservation.reserved_for_date = reset_day then
      if reservation.bucket = 'guest_free' then
        update public.credit_accounts set guest_total_used = greatest(0, guest_total_used - 1), updated_at = now() where id = reservation.credit_account_id;
      elsif reservation.bucket = 'plan_daily' then
        update public.credit_accounts set plan_daily_used = greatest(0, plan_daily_used - 1), updated_at = now() where id = reservation.credit_account_id;
      elsif reservation.bucket = 'account_free' then
        update public.credit_accounts set account_daily_used = greatest(0, account_daily_used - 1), updated_at = now() where id = reservation.credit_account_id;
      end if;
    end if;
    insert into public.credit_ledger (credit_account_id, kind, bucket, amount, request_id, reservation_id, reason)
      values (reservation.credit_account_id, 'release', reservation.bucket, 1, reservation.request_id, reservation.id, 'phase9_provider_failure');
    update public.ai_usage set status = 'failed', duration_ms = greatest(0, p_duration_ms), completed_at = now()
      where id = p_usage_id and request_id = reservation.request_id;
  end if;
  return true;
end;
$$;

revoke all on function public.reserve_ai_request(uuid,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.get_ai_quota(uuid,text) from public, anon, authenticated;
revoke all on function public.finish_ai_request(uuid,uuid,boolean,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.get_ai_quota(uuid,text) to service_role;
grant execute on function public.finish_ai_request(uuid,uuid,boolean,integer,integer,integer) to service_role;

commit;
