-- PREPARATION ONLY. Main fills the one observed invited Auth UUID from Dashboard.
-- Never bind an assumed UUID or dashboard identity. Inbox additionally requires
-- confirmed email and a live Auth session after the owner follows the email link.
-- Run in a transaction on edfrlptpeuhjsgxdfwke only, after manual substitution.
begin;
do $$
declare approved_id uuid := '00000000-0000-0000-0000-000000000000';
  approved_email text := ''; -- Fill privately from the authorized owner record.
begin
  if not exists (select 1 from auth.users where id=approved_id
    and lower(email)=approved_email
    and not coalesce(is_anonymous,false)) then
    raise exception 'Observed confirmed owner UUID required';
  end if;
  insert into website_contact_private.operator(singleton,user_id,email)
    values(true,approved_id,approved_email);
end $$;
commit;
-- No ON CONFLICT replacement: changing the pinned owner is a separate decision.
