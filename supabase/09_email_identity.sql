-- ============================================================================
-- SecondChance Collective — 09: email as the identity
--
-- Accounts are created by verifying an email address with a six-digit code,
-- not by SMS. The mobile number is still collected at sign-up — buyers use it
-- to reach the seller — but it is a contact field, not the identity.
--
-- This reverses the direction of 08. Safe to run more than once.
-- Run it after 01-08.
-- ============================================================================

begin;

-- --- email must be present for new accounts; the unique index from 08
--     (nulls allowed to repeat) already covers uniqueness ------------------
--     Existing phone-only rows keep their null email, so no NOT NULL here.

-- --- rebuild the new-user trigger for email signups ----------------------
-- The phone now arrives in raw_user_meta_data (the sign-up form sends it),
-- not on auth.users.phone.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text;
  v_phone text;
begin
  v_username := nullif(trim(meta ->> 'username'), '');
  v_phone := coalesce(new.phone, nullif(trim(meta ->> 'phone'), ''));

  -- If the chosen username is gone, fall back to the email's local part so
  -- the insert cannot fail and strand a verified account with no profile.
  if v_username is not null
     and exists (select 1 from profiles where username = v_username) then
    v_username := null;
  end if;

  if v_username is null and new.email is not null then
    v_username := regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'gi');
    if length(v_username) < 3 then
      v_username := 'm' || substr(md5(new.id::text), 1, 6);
    end if;
    if exists (select 1 from profiles where username = v_username) then
      v_username := v_username || substr(md5(new.id::text), 1, 4);
    end if;
  end if;

  insert into profiles (
    id, username, full_name, phone, email, city,
    phone_verified, phone_verified_at, email_verified, account_status
  ) values (
    new.id,
    v_username,
    nullif(trim(meta ->> 'full_name'), ''),
    v_phone,
    new.email,
    nullif(trim(meta ->> 'city'), ''),
    new.phone_confirmed_at is not null,
    new.phone_confirmed_at,
    new.email_confirmed_at is not null,
    'active'
  )
  on conflict (id) do update set
    email          = excluded.email,
    email_verified = excluded.email_verified;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- The 08 sync trigger already keeps email_verified in step with
-- email_confirmed_at (and phone likewise), so it stays as it is.

-- --- a verified email is the gate for acting on the marketplace ----------
-- Members who verified by SMS under the old flow stay verified.
create or replace function is_verified_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (email_verified or phone_verified)
      and account_status = 'active'
  );
$$;

grant execute on function is_verified_member() to authenticated;

commit;

-- ============================================================================
-- Check it worked:
--
--   select username, email, email_verified, phone, phone_verified
--   from profiles order by created_at;
-- ============================================================================
