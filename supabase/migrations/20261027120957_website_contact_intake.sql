-- NEW website intake only. Apply this migration alone to edfrlptpeuhjsgxdfwke;
-- never replay restaurant migrations or target the protected app project.
begin;
create schema website_contact_private;
revoke all on schema website_contact_private from public, anon, authenticated, service_role;
grant usage on schema website_contact_private to service_role;

create table website_contact_private.operator (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) between 3 and 254)
);
-- Empty by design: the approved, confirmed owner is provisioned separately.
create table website_contact_private.inquiries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  email text not null check (length(email) <= 254),
  message text not null check (length(message) between 10 and 3000),
  locale text not null check (locale in ('ko','en','ja','zh-Hans','zh-Hant','es','pt','fr','de','id','th','vi','hi')),
  consent_version text not null check (consent_version = 'website-contact-2026-10-27'),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index website_contact_created_idx on website_contact_private.inquiries(created_at desc,id desc);
create index website_contact_email_idx on website_contact_private.inquiries(email,created_at);
alter table website_contact_private.operator enable row level security;
alter table website_contact_private.inquiries enable row level security;
alter table website_contact_private.operator force row level security;
alter table website_contact_private.inquiries force row level security;
revoke all on all tables in schema website_contact_private from public, anon, authenticated, service_role;
alter default privileges in schema website_contact_private revoke execute on functions from public;
alter default privileges in schema website_contact_private revoke all on tables from anon, authenticated, service_role;

create function website_contact_private.purge() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from website_contact_private.inquiries where expires_at <= now();
end $$;

create function website_contact_private.intake(p_request uuid,p_email text,p_message text,p_locale text,p_honeypot text,p_consent text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing website_contact_private.inquiries; receipt uuid;
begin
  if p_request is null or p_email is null or length(p_email) > 254 or p_email <> lower(trim(p_email))
    or p_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
    or p_message is null or length(trim(p_message)) not between 10 and 3000
    or p_locale is null or p_locale not in ('ko','en','ja','zh-Hans','zh-Hant','es','pt','fr','de','id','th','vi','hi')
    or p_honeypot is distinct from '' or p_consent is distinct from 'website-contact-2026-10-27'
    then raise exception using errcode='22023',message='invalid'; end if;
  -- Serializes quota checks + writes across concurrent Edge instances.
  perform pg_catalog.pg_advisory_xact_lock(2710271209);
  perform website_contact_private.purge();
  select * into existing from website_contact_private.inquiries where request_id = p_request;
  if found then
    if existing.email <> p_email or existing.message <> trim(p_message) or existing.locale <> p_locale then
      raise exception using errcode='P0409',message='conflict'; end if;
    return jsonb_build_object('status','received','receipt',existing.id);
  end if;
  if (select count(*) from website_contact_private.inquiries) >= 1000
    or (select count(*) from website_contact_private.inquiries where created_at > now()-interval '24 hours') >= 100
    or (select count(*) from website_contact_private.inquiries where email=p_email and created_at > now()-interval '24 hours') >= 3
    then raise exception using errcode='P0429',message='rate_limited'; end if;
  insert into website_contact_private.inquiries(request_id,email,message,locale,consent_version)
    values(p_request,p_email,trim(p_message),p_locale,p_consent) returning id into receipt;
  return jsonb_build_object('status','received','receipt',receipt);
end $$;

create function website_contact_private.inbox(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare action text := p_command->>'action'; row_id uuid; new_status text; result jsonb; item website_contact_private.inquiries;
begin
  if not exists (
    select 1 from website_contact_private.operator o
    join auth.users u on u.id=o.user_id and lower(u.email)=o.email
    join auth.sessions s on s.user_id=u.id and s.id=p_session
    where o.user_id=p_actor and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (s.not_after is null or s.not_after > now())
  ) then raise exception using errcode='42501',message='forbidden'; end if;
  perform website_contact_private.purge();
  if action = 'list' then
    if p_command->>'status' is not null and p_command->>'status' not in ('new','in_progress','resolved') then
      raise exception using errcode='22023',message='invalid'; end if;
    select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb) into result from (
      select id,email,message,locale,status,created_at,resolved_at,expires_at from website_contact_private.inquiries
      where (p_command->>'status' is null or status=p_command->>'status')
        and (p_command->'before' is null or (created_at,id) < ((p_command->'before'->>'created_at')::timestamptz,(p_command->'before'->>'id')::uuid))
      order by created_at desc,id desc limit 21
    ) page;
    return jsonb_build_object('items',result);
  elsif action in ('status','delete') then
    row_id := (p_command->>'id')::uuid;
    if action='delete' then
      delete from website_contact_private.inquiries where id=row_id returning * into item;
    else
      new_status := p_command->>'status';
      if new_status is null or new_status not in ('new','in_progress','resolved') then raise exception using errcode='22023',message='invalid'; end if;
      update website_contact_private.inquiries set status=new_status,
        resolved_at=case when new_status='resolved' then coalesce(resolved_at,now()) else null end,
        -- Resolving/reopening cannot extend the original retention deadline.
        expires_at=case when new_status='resolved' then least(expires_at,now()+interval '30 days') else expires_at end
        where id=row_id returning * into item;
    end if;
    if not found then raise exception using errcode='22023',message='not_found'; end if;
    return jsonb_build_object('ok',true);
  end if;
  raise exception using errcode='22023',message='invalid';
end $$;

-- Exposed-schema wrappers are invokers, service-only. The privileged bodies
-- stay in a non-exposed schema. No browser role gets even EXECUTE permission.
create function public.website_contact_intake(p_request uuid,p_email text,p_message text,p_locale text,p_honeypot text,p_consent text) returns jsonb
language sql security invoker set search_path = '' as $$
  select website_contact_private.intake(p_request,p_email,p_message,p_locale,p_honeypot,p_consent);
$$;
create function public.website_contact_inbox(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select website_contact_private.inbox(p_actor,p_session,p_command); $$;
revoke all on all functions in schema website_contact_private from public,anon,authenticated,service_role;
grant execute on function website_contact_private.intake(uuid,text,text,text,text,text) to service_role;
grant execute on function website_contact_private.inbox(uuid,uuid,jsonb) to service_role;
revoke all on function public.website_contact_intake(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.website_contact_inbox(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.website_contact_intake(uuid,text,text,text,text,text) to service_role;
grant execute on function public.website_contact_inbox(uuid,uuid,jsonb) to service_role;
commit;
