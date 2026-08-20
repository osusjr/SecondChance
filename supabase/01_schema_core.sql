-- ============================================================================
-- SecondChance Collective — Core schema
-- Run order: 01_schema → 02_rls → 03_functions → 04_storage → 05_seed
-- Target: Supabase / PostgreSQL 15+
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type account_status   as enum ('active','suspended','blocked');
  create type seller_status    as enum ('none','pending','approved','rejected','suspended');
  create type listing_status   as enum ('draft','pending_review','active','reserved','sold','rejected','removed');
  create type auth_status      as enum ('not_required','pending','in_progress','passed','failed');
  create type order_status     as enum ('placed','confirmed','collected','authenticating','shipped','delivered','accepted','cancelled','returned','refunded');
  create type payment_status   as enum ('pending','authorized','paid','failed','refunded','partially_refunded');
  create type shipping_status  as enum ('not_ready','pickup_scheduled','picked_up','in_transit','out_for_delivery','delivered','failed');
  create type payment_method   as enum ('card','cliq','efawateercom','cod');
  create type txn_type         as enum ('payment','refund','commission','payout','adjustment');
  create type txn_status       as enum ('pending','completed','failed','reversed');
  create type payout_status    as enum ('pending','scheduled','processing','paid','failed','on_hold');
  create type report_target    as enum ('listing','user','order');
  create type report_category  as enum ('counterfeit','fraud','inappropriate','misleading','prohibited','harassment','other');
  create type report_status    as enum ('open','investigating','resolved','dismissed','escalated');
  create type dispute_status   as enum ('open','awaiting_buyer','awaiting_seller','resolved','escalated');
  create type otp_purpose      as enum ('signup','login','phone_verify','password_reset','payout_change','admin_login');
  create type notif_audience   as enum ('all','buyers','sellers','user','segment');
  create type content_status   as enum ('draft','published','archived');
  create type discount_type    as enum ('percent','fixed','free_shipping');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- PLATFORM SETTINGS  (single-row config, editable from admin)
-- ---------------------------------------------------------------------------
create table if not exists platform_settings (
  id                        boolean primary key default true check (id),
  commission_rate           numeric(5,4) not null default 0.1200,   -- 12%
  authentication_threshold  numeric(12,2) not null default 350.00,  -- JOD
  buyer_protection_rate     numeric(5,4) not null default 0.0500,
  buyer_protection_min      numeric(12,2) not null default 3.00,
  shipping_flat_fee         numeric(12,2) not null default 0.00,
  currency                  text not null default 'JOD',
  free_listings_per_seller  int  not null default 3,
  payout_hold_days          int  not null default 3,
  require_listing_approval  boolean not null default true,
  maintenance_mode          boolean not null default false,
  updated_at                timestamptz not null default now(),
  updated_by                uuid
);
insert into platform_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          citext unique,
  full_name         text,
  phone             text,
  avatar_url        text,
  bio               text,
  city              text,
  area              text,
  address_line      text,
  date_of_birth     date,
  is_seller         boolean not null default false,
  seller_status     seller_status  not null default 'none',
  account_status    account_status not null default 'active',
  email_verified    boolean not null default false,
  phone_verified    boolean not null default false,
  identity_verified boolean not null default false,
  suspended_reason  text,
  suspended_until   timestamptz,
  locale            text not null default 'en',
  marketing_opt_in  boolean not null default false,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_profiles_seller_status on profiles(seller_status);
create index if not exists idx_profiles_account_status on profiles(account_status);
create index if not exists idx_profiles_created on profiles(created_at desc);

-- Seller onboarding / KYC submissions
create table if not exists seller_applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  legal_name        text,
  national_id       text,
  id_document_path  text,
  selfie_path       text,
  iban              text,
  bank_name         text,
  cliq_alias        text,
  payout_method     text,
  pickup_address    text,
  status            seller_status not null default 'pending',
  reviewed_by       uuid references profiles(id),
  reviewed_at       timestamptz,
  rejection_reason  text,
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_seller_app_status on seller_applications(status, created_at desc);

-- ---------------------------------------------------------------------------
-- ADMIN ROLES & PERMISSIONS
-- ---------------------------------------------------------------------------
create table if not exists admin_roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  permissions text[] not null default '{}',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists admin_users (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references profiles(id) on delete cascade,
  role_id        uuid not null references admin_roles(id),
  is_active      boolean not null default true,
  totp_secret    text,
  totp_enabled   boolean not null default false,
  require_otp    boolean not null default true,
  last_login_at  timestamptz,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_admin_users_active on admin_users(is_active);

create table if not exists admin_activity_log (
  id          bigserial primary key,
  admin_id    uuid references profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  summary     text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_activity_admin on admin_activity_log(admin_id, created_at desc);
create index if not exists idx_activity_entity on admin_activity_log(entity_type, entity_id);
create index if not exists idx_activity_created on admin_activity_log(created_at desc);

create table if not exists login_history (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  email       text,
  success     boolean not null,
  failure_reason text,
  ip_address  inet,
  user_agent  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_login_hist_user on login_history(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- OTP CODES
-- ---------------------------------------------------------------------------
create table if not exists otp_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  destination text not null,            -- email or phone the code was sent to
  channel     text not null default 'email' check (channel in ('email','sms')),
  purpose     otp_purpose not null,
  code_hash   text not null,            -- sha256(code || id) — never store raw
  attempts    int not null default 0,
  max_attempts int not null default 5,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_otp_lookup on otp_codes(destination, purpose, consumed_at);
create index if not exists idx_otp_expiry on otp_codes(expires_at);

-- ---------------------------------------------------------------------------
-- TAXONOMY
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  name_ar     text,
  parent_id   uuid references categories(id) on delete set null,
  description text,
  icon        text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists brands (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  logo_url     text,
  description  text,
  tier         text check (tier in ('ultra','luxury','premium','contemporary')),
  requires_auth boolean not null default true,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists conditions (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  label       text not null,
  description text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table if not exists sizes (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  category_id uuid references categories(id) on delete cascade,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  unique (label, category_id)
);

create table if not exists colors (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  hex        text,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

-- ---------------------------------------------------------------------------
-- LISTINGS
-- ---------------------------------------------------------------------------
create table if not exists listings (
  id                uuid primary key default gen_random_uuid(),
  reference         text unique,                    -- human ref e.g. SC-000123
  seller_id         uuid not null references profiles(id) on delete cascade,
  title             text not null,
  description       text,
  brand_id          uuid references brands(id),
  category_id       uuid references categories(id),
  condition_code    text references conditions(code),
  size_label        text,
  color             text,
  price             numeric(12,2) not null check (price > 0),
  original_retail   numeric(12,2),
  currency          text not null default 'JOD',
  status            listing_status not null default 'draft',
  authentication_status auth_status not null default 'not_required',
  is_featured       boolean not null default false,
  featured_until    timestamptz,
  is_flagged        boolean not null default false,
  flag_reason       text,
  view_count        int not null default 0,
  favorite_count    int not null default 0,
  rejection_reason  text,
  rejected_by       uuid references profiles(id),
  approved_by       uuid references profiles(id),
  published_at      timestamptz,
  reserved_until    timestamptz,
  sold_at           timestamptz,
  search_vector     tsvector,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_listings_status  on listings(status, published_at desc);
create index if not exists idx_listings_seller  on listings(seller_id, created_at desc);
create index if not exists idx_listings_brand   on listings(brand_id) where status = 'active';
create index if not exists idx_listings_cat     on listings(category_id) where status = 'active';
create index if not exists idx_listings_price   on listings(price) where status = 'active';
create index if not exists idx_listings_featured on listings(is_featured) where status = 'active';
create index if not exists idx_listings_search  on listings using gin(search_vector);

create sequence if not exists listing_ref_seq start 1000;

create table if not exists listing_images (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  slot        text check (slot in ('front','back','detail','label','extra')),
  alt_text    text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_listing_images on listing_images(listing_id, sort_order);

-- Moderation decisions (approve / reject / edit) — full audit per listing
create table if not exists listing_moderation (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  admin_id    uuid references profiles(id) on delete set null,
  decision    text not null check (decision in ('approved','rejected','info_requested','edited','removed','flagged','unflagged')),
  reason_code text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_moderation_listing on listing_moderation(listing_id, created_at desc);

-- "Request more photos / info" thread between admin and seller
create table if not exists listing_info_requests (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id) on delete cascade,
  admin_id     uuid references profiles(id) on delete set null,
  message      text not null,
  requested_items text[],
  status       text not null default 'open' check (status in ('open','responded','closed')),
  seller_response text,
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Authentication / quality-control checks
create table if not exists authentication_checks (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references listings(id) on delete cascade,
  authenticator_id uuid references profiles(id) on delete set null,
  status         auth_status not null default 'pending',
  checklist      jsonb not null default '{}'::jsonb,  -- {stitching:true, serial:true, hardware:false...}
  condition_confirmed text,
  verdict        text check (verdict in ('authentic','counterfeit','inconclusive')),
  certificate_no text unique,
  notes          text,
  photos         text[],
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_authchecks_status on authentication_checks(status, created_at desc);

create table if not exists favorites (
  user_id    uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists listing_views (
  id         bigserial primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_listing_views on listing_views(listing_id, created_at desc);
