begin;

-- Current registered-account allowances: Starter 10/day; paid tiers 20/30/50 per day.
update public.plans
set daily_ai_limit = case slug
      when 'plus' then 20
      when 'pro' then 30
      when 'pro_max' then 50
      else daily_ai_limit
    end,
    description = case slug
      when 'plus' then '20 AI requests per Vietnam calendar day'
      when 'pro' then '30 AI requests per Vietnam calendar day'
      when 'pro_max' then '50 AI requests per Vietnam calendar day'
      else description
    end,
    updated_at = now()
where slug in ('plus', 'pro', 'pro_max');

-- Starter is the registered free-account allowance, independent of guest limits.
alter table public.credit_accounts
  alter column account_daily_limit set default 10;

update public.credit_accounts
set account_daily_limit = 10,
    updated_at = now()
where user_id is not null
  and paid_plan_slug is null
  and account_daily_limit <> 10;

commit;
