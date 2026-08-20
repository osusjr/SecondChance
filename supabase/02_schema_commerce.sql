-- ============================================================================
-- SecondChance Collective — Commerce, moderation, marketing & content schema
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id                   uuid primary key default gen_random_uuid(),
  order_no             text unique,
  buyer_id             uuid not null references profiles(id) on delete restrict,
  seller_id            uuid not null references profiles(id) on delete restrict,
  listing_id           uuid not null references listings(id) on delete restrict,

  -- money (snapshot at purchase time — never recompute from live settings)
  item_price           numeric(12,2) not null,
  buyer_protection_fee numeric(12,2) not null default 0,
  shipping_fee         numeric(12,2) not null default 0,
  discount_amount      numeric(12,2) not null default 0,
  discount_code        text,
  total                numeric(12,2) not null,
  commission_rate      numeric(5,4)  not null,
  commission_amount    numeric(12,2) not null,
  seller_amount        numeric(12,2) not null,
  currency             text not null default 'JOD',

  status               order_status    not null default 'placed',
  payment_method       payment_method  not null,
  payment_status       payment_status  not null default 'pending',
  shipping_status      shipping_status not null default 'not_ready',

  -- fulfilment
  shipping_name        text,
  shipping_phone       text,
  shipping_city        text,
  shipping_area        text,
  shipping_address     text,
  shipping_notes       text,
  tracking_number      text,
  carrier              text default 'Aramex',
  pickup_scheduled_at  timestamptz,
  delivered_at         timestamptz,
  accepted_at          timestamptz,

  cancelled_at         timestamptz,
  cancel_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_orders_buyer   on orders(buyer_id, created_at desc);
create index if not exists idx_orders_seller  on orders(seller_id, created_at desc);
create index if not exists idx_orders_status  on orders(status, created_at desc);
create index if not exists idx_orders_payment on orders(payment_status);
create index if not exists idx_orders_created on orders(created_at desc);

create sequence if not exists order_no_seq start 10000;

create table if not exists order_events (
  id         bigserial primary key,
  order_id   uuid not null references orders(id) on delete cascade,
  status     text not null,
  note       text,
  actor_id   uuid references profiles(id) on delete set null,
  actor_role text check (actor_role in ('buyer','seller','admin','system')),
  created_at timestamptz not null default now()
);
create index if not exists idx_order_events on order_events(order_id, created_at desc);

create table if not exists order_cancellations (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  requested_by  uuid references profiles(id) on delete set null,
  requester_role text check (requester_role in ('buyer','seller','admin')),
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  admin_notes   text,
  created_at    timestamptz not null default now()
);

create table if not exists returns (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  buyer_id       uuid not null references profiles(id) on delete cascade,
  reason         text not null,
  reason_code    text check (reason_code in ('not_as_described','counterfeit','damaged','wrong_item','changed_mind','other')),
  description    text,
  photos         text[],
  status         text not null default 'requested' check (status in ('requested','approved','rejected','in_transit','received','refunded','closed')),
  refund_amount  numeric(12,2),
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  admin_notes    text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_returns_status on returns(status, created_at desc);

create table if not exists disputes (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  opened_by    uuid references profiles(id) on delete set null,
  opener_role  text check (opener_role in ('buyer','seller')),
  subject      text not null,
  description  text,
  status       dispute_status not null default 'open',
  assigned_to  uuid references profiles(id),
  resolution   text,
  resolved_in_favour_of text check (resolved_in_favour_of in ('buyer','seller','split','none')),
  resolved_by  uuid references profiles(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_disputes_status on disputes(status, created_at desc);

create table if not exists dispute_messages (
  id         bigserial primary key,
  dispute_id uuid not null references disputes(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  author_role text check (author_role in ('buyer','seller','admin')),
  body       text not null,
  attachments text[],
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PAYMENTS, COMMISSION & PAYOUTS
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references orders(id) on delete set null,
  user_id        uuid references profiles(id) on delete set null,
  type           txn_type not null,
  status         txn_status not null default 'pending',
  amount         numeric(12,2) not null,
  currency       text not null default 'JOD',
  method         payment_method,
  provider       text,
  provider_ref   text,
  description    text,
  metadata       jsonb not null default '{}'::jsonb,
  processed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_txn_order on transactions(order_id);
create index if not exists idx_txn_user  on transactions(user_id, created_at desc);
create index if not exists idx_txn_type  on transactions(type, status, created_at desc);

create table if not exists payouts (
  id            uuid primary key default gen_random_uuid(),
  payout_no     text unique,
  seller_id     uuid not null references profiles(id) on delete restrict,
  amount        numeric(12,2) not null,
  currency      text not null default 'JOD',
  status        payout_status not null default 'pending',
  method        text check (method in ('bank_transfer','cliq','cash')),
  iban          text,
  cliq_alias    text,
  reference     text,
  scheduled_for date,
  processed_by  uuid references profiles(id),
  processed_at  timestamptz,
  failure_reason text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payouts_seller on payouts(seller_id, created_at desc);
create index if not exists idx_payouts_status on payouts(status, scheduled_for);

create sequence if not exists payout_no_seq start 500;

-- links individual orders into a payout batch
create table if not exists payout_items (
  payout_id uuid not null references payouts(id) on delete cascade,
  order_id  uuid not null references orders(id) on delete restrict,
  amount    numeric(12,2) not null,
  primary key (payout_id, order_id)
);

-- ---------------------------------------------------------------------------
-- REPORTS & COMPLAINTS
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references profiles(id) on delete set null,
  target_type    report_target not null,
  target_listing_id uuid references listings(id) on delete cascade,
  target_user_id    uuid references profiles(id) on delete cascade,
  target_order_id   uuid references orders(id) on delete cascade,
  category       report_category not null,
  description    text,
  evidence       text[],
  status         report_status not null default 'open',
  priority       text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to    uuid references profiles(id),
  resolution     text,
  action_taken   text,
  resolved_by    uuid references profiles(id),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_reports_status on reports(status, priority, created_at desc);
create index if not exists idx_reports_target on reports(target_type, target_listing_id, target_user_id);

-- ---------------------------------------------------------------------------
-- PROMOTIONS
-- ---------------------------------------------------------------------------
create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists discount_codes (
  id            uuid primary key default gen_random_uuid(),
  code          citext unique not null,
  campaign_id   uuid references campaigns(id) on delete set null,
  type          discount_type not null default 'percent',
  value         numeric(12,2) not null,
  min_order     numeric(12,2) default 0,
  max_discount  numeric(12,2),
  max_uses      int,
  max_uses_per_user int default 1,
  used_count    int not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

create table if not exists discount_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references discount_codes(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  amount      numeric(12,2) not null,
  created_at  timestamptz not null default now()
);

create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  image_url   text,
  link_url    text,
  placement   text not null default 'homepage_hero'
              check (placement in ('homepage_hero','homepage_strip','announcement_bar','category_top','sell_page')),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists featured_collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  description text,
  cover_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists featured_collection_items (
  collection_id uuid not null references featured_collections(id) on delete cascade,
  listing_id    uuid not null references listings(id) on delete cascade,
  sort_order    int not null default 0,
  primary key (collection_id, listing_id)
);

create table if not exists featured_sellers (
  seller_id   uuid primary key references profiles(id) on delete cascade,
  headline    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- CONTENT MANAGEMENT
-- ---------------------------------------------------------------------------
create table if not exists content_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,     -- about, terms, privacy, returns, seller-guidelines...
  title       text not null,
  body        text,
  meta_description text,
  status      content_status not null default 'draft',
  updated_by  uuid references profiles(id),
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists content_blocks (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,     -- homepage_hero_title, sell_cta, footer_note...
  label       text not null,
  value       text,
  block_type  text not null default 'text' check (block_type in ('text','html','image','json')),
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

create table if not exists faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  category    text default 'general',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  updated_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         text,
  cover_url    text,
  tags         text[],
  status       content_status not null default 'draft',
  author_id    uuid references profiles(id),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table if not exists notification_campaigns (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  audience     notif_audience not null default 'all',
  segment_filter jsonb,
  link_url     text,
  channels     text[] not null default '{in_app}',
  scheduled_for timestamptz,
  sent_at      timestamptz,
  recipient_count int default 0,
  status       text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references notification_campaigns(id) on delete set null,
  type        text not null default 'system',
  title       text not null,
  body        text,
  link_url    text,
  metadata    jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- MESSAGING (buyer ↔ seller, needed for order questions)
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid references listings(id) on delete set null,
  order_id    uuid references orders(id) on delete set null,
  buyer_id    uuid not null references profiles(id) on delete cascade,
  seller_id   uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz default now(),
  created_at  timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id)
);

create table if not exists messages (
  id              bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null,
  attachments     text[],
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_messages_conv on messages(conversation_id, created_at desc);
