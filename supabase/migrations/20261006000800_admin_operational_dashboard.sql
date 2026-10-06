begin;

create table public.site_page_views (
  id bigint generated always as identity primary key,
  path text not null check (
    length(path) between 1 and 200
    and left(path, 1) = '/'
    and left(path, 2) <> '//'
    and position('?' in path) = 0
    and position('#' in path) = 0
  ),
  viewed_at timestamptz not null default now()
);

create index site_page_views_viewed_at_idx on public.site_page_views (viewed_at desc);
alter table public.site_page_views enable row level security;

create or replace function public.record_site_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_service_role();
  if p_path is null or length(p_path) > 200 or left(p_path, 1) <> '/'
    or left(p_path, 2) = '//' or p_path ~ '[?#]' then
    raise exception 'invalid_page_path' using errcode = '22023';
  end if;
  if p_path = '/admin' or p_path like '/admin/%'
    or p_path = '/auth' or p_path like '/auth/%'
    or p_path like '/api/%' or p_path like '/_next/%' then
    raise exception 'excluded_page_path' using errcode = '22023';
  end if;
  insert into public.site_page_views (path) values (p_path);
end;
$$;

create or replace function public.get_admin_operational_metrics(p_actor_user_id uuid)
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

  return jsonb_build_object(
    'totalAiRequests', (
      select count(*) from public.ai_usage where status = 'succeeded'
    ),
    'totalRevenueVnd', (
      select coalesce(sum(amount_vnd), 0)::bigint from public.payment_orders where status = 'paid'
    ),
    'dailyTraffic', (
      with days as (
        select generate_series(
          (now() at time zone 'Asia/Ho_Chi_Minh')::date - 89,
          (now() at time zone 'Asia/Ho_Chi_Minh')::date,
          interval '1 day'
        )::date as day
      ), views as (
        select (viewed_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as page_views
        from public.site_page_views
        where viewed_at >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 89)::timestamp at time zone 'Asia/Ho_Chi_Minh'
          and viewed_at < ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'
        group by 1
      ), ai as (
        select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as requests
        from public.ai_usage
        where status = 'succeeded'
          and created_at >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 89)::timestamp at time zone 'Asia/Ho_Chi_Minh'
          and created_at < ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.day,
        'pageViews', coalesce(v.page_views, 0),
        'aiRequests', coalesce(a.requests, 0)
      ) order by d.day), '[]'::jsonb)
      from days d left join views v on v.day = d.day left join ai a on a.day = d.day
    )
  );
end;
$$;

revoke all on function public.record_site_page_view(text) from public, anon, authenticated;
revoke all on function public.get_admin_operational_metrics(uuid) from public, anon, authenticated;
grant execute on function public.record_site_page_view(text) to service_role;
grant execute on function public.get_admin_operational_metrics(uuid) to service_role;

commit;
