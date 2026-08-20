-- ============================================================================
-- SecondChance Collective — 08: phone as the identity
--
-- Accounts are created by verifying a mobile number, not an email address.
-- Email becomes an optional contact field that may be null for most members.
--
-- Safe to run more than once. Run it after 01-07.
-- ============================================================================

begin;

-- --- email is no longer guaranteed ---------------------------------------
alter table profiles alter column email drop not null;

-- A unique index still makes sense, but nulls must be allowed to repeat.
drop index if exists profiles_email_key;
create unique index if not exists profiles_email_unique
  on profiles (email) where email is not null;

-- Phone is now the thing that must be unique and present.
update profiles set phone = null where phone = '';
create unique index if not exists profiles_phone_unique
  on profiles (phone) where phone is not null;

-- --- verification flags now mean what they say ---------------------------
alter table profiles add column if not exists phone_verified_at timestamptz;

-- --- rebuild the new-user trigger for phone signups ----------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text;
begin
  v_username := nullif(trim(meta ->> 'username'), '');

  -- If the chosen username is gone, fall back to the number's last digits so
  -- the insert cannot fail and strand a verified account with no profile.
  if v_username is not null
     and exists (select 1 from profiles where username = v_username) then
    v_username := null;
  end if;

  if v_username is null and new.phone is not null then
    v_username := 'm' || right(new.phone, 6);
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
    new.phone,
    nullif(trim(meta ->> 'email'), ''),
    nullif(trim(meta ->> 'city'), ''),
    new.phone_confirmed_at is not null,
    new.phone_confirmed_at,
    new.email_confirmed_at is not null,
    'active'
  )
  on conflict (id) do update set
    phone             = excluded.phone,
    phone_verified    = excluded.phone_verified,
    phone_verified_at = excluded.phone_verified_at;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- --- keep the flag in step when a number is confirmed later --------------
create or replace function sync_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone_confirmed_at is distinct from old.phone_confirmed_at then
    update profiles
       set phone             = new.phone,
           phone_verified    = new.phone_confirmed_at is not null,
           phone_verified_at = new.phone_confirmed_at
     where id = new.id;
  end if;

  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update profiles
       set email_verified = new.email_confirmed_at is not null
     where id = new.id;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function sync_phone_verified();

-- --- a verified number is the gate for acting on the marketplace ---------
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
      and phone_verified
      and account_status = 'active'
  );
$$;

grant execute on function is_verified_member() to authenticated;

commit;

-- ============================================================================
-- Backfill, if you already made accounts under the email flow:
--
--   update profiles p set phone = u.phone,
--          phone_verified = u.phone_confirmed_at is not null
--   from auth.users u where u.id = p.id and u.phone is not null;
--
-- Check it worked:
--
--   select username, phone, phone_verified, email from profiles order by created_at;
-- ============================================================================
