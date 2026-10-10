begin;

-- Admin reporting counts each non-admin account that ever received a paid plan,
-- including expired plans. This is distinct from currently active entitlement.
create or replace function public.get_admin_historical_subscription_metrics(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_service_role();
  if p_actor_user_id is null or not exists (
    select 1 from public.profiles p where p.id = p_actor_user_id and p.role = 'admin'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return (
    with historical_vip as (
      select p.id, lower(coalesce(ca.paid_plan_slug, latest_paid.plan_code, '')) as plan_slug
      from public.profiles p
      left join public.credit_accounts ca on ca.user_id = p.id
      left join lateral (
        select po.plan_code
        from public.payment_orders po
        where po.user_id = p.id and po.status = 'paid'
        order by po.paid_at desc nulls last, po.created_at desc
        limit 1
      ) latest_paid on true
      where p.role <> 'admin'
        and (ca.paid_plan_slug is not null or latest_paid.plan_code is not null or p.vip_started_at is not null)
    )
    select jsonb_build_object(
      'totalVip', count(*),
      'subscriptions', jsonb_build_object(
        'free', greatest((select count(*) from auth.users) - count(*), 0),
        'plus', count(*) filter (where plan_slug like '%plus%'),
        'pro', count(*) filter (where plan_slug like '%pro%' and plan_slug not like '%max%'),
        'proMax', count(*) filter (where plan_slug like '%max%'),
        'otherVip', count(*) filter (where plan_slug not like '%plus%' and plan_slug not like '%pro%')
      )
    )
    from historical_vip
  );
end;
$$;

revoke all on function public.get_admin_historical_subscription_metrics(uuid) from public, anon, authenticated;
grant execute on function public.get_admin_historical_subscription_metrics(uuid) to service_role;

commit;
