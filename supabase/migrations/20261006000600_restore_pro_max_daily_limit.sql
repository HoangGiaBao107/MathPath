begin;

update public.plans
set daily_ai_limit = 50,
    description = '50 AI requests per Vietnam calendar day',
    updated_at = now()
where slug = 'pro_max';

commit;
