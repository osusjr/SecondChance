-- ============================================================================
-- SecondChance Collective — 10: fix "Database error saving new user"
--
-- Why sign-up was failing:
--   The profiles table never had an `email` column. File 08 assumed it did —
--   its first statement (`alter column email drop not null`) errors on a
--   fresh database, which aborts 08's whole transaction, so nothing in 08
--   was ever applied (no phone_verified_at column, no sync trigger either).
--   File 09 then installed a sign-up trigger that inserts into
--   profiles.email and profiles.phone_verified_at — both missing — so every
--   sign-up died inside the trigger and Supabase reported
--   "Database error saving new user".
--
-- This file creates what was missing. Safe to run more than once.
-- Run it after 01-09 (09's trigger stays; it works once these columns exist).
-- ============================================================================

begin;

-- --- the columns 08 and 09 assumed ----------------------------------------
alter table profiles add column if not exists email citext;
alter table profiles add column if not exists phone_verified_at timestamptz;

-- Unique when present; nulls may repeat.
create unique index if not exists profiles_email_unique
  on profiles (email) where email is not null;

-- Phone stays a contact field with no unique index — two members may share
-- a family number, and a duplicate must never break sign-up.

-- --- keep the verified flags in step with Supabase auth --------------------
-- This was 08's sync trigger; it never got installed because 08 aborted.
-- Without it, verifying the emailed code would never mark the profile
-- verified, and the member gate would stay shut.
create or replace function sync_verified_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update profiles
       set email_verified = new.email_confirmed_at is not null,
           email          = coalesce(profiles.email, new.email::citext)
     where id = new.id;
  end if;

  if new.phone_confirmed_at is distinct from old.phone_confirmed_at then
    update profiles
       set phone             = coalesce(new.phone, profiles.phone),
           phone_verified    = new.phone_confirmed_at is not null,
           phone_verified_at = new.phone_confirmed_at
     where id = new.id;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function sync_verified_flags();

-- --- backfill accounts created before this fix ----------------------------
-- Copy emails onto profiles that exist but have none.
update profiles p
   set email          = u.email::citext,
       email_verified = u.email_confirmed_at is not null
  from auth.users u
 where u.id = p.id
   and p.email is null
   and u.email is not null;

-- Create profiles for any auth users that never got one.
insert into profiles (id, username, full_name, phone, email, email_verified, account_status)
select
  u.id,
  'm' || substr(md5(u.id::text), 1, 6),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           split_part(u.email, '@', 1)),
  nullif(trim(u.raw_user_meta_data ->> 'phone'), ''),
  u.email::citext,
  u.email_confirmed_at is not null,
  'active'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

commit;

-- ============================================================================
-- Check it worked — sign up on the site, then:
--
--   select username, email, email_verified, phone from profiles
--   order by created_at desc limit 5;
--
-- The new account should appear with its email filled in, and
-- email_verified should flip to true after the code is entered.
-- ============================================================================
