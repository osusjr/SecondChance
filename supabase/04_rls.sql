-- ============================================================================
-- SecondChance Collective — Row Level Security
-- Default posture: deny everything, then grant the narrowest useful access.
--
-- This file is safe to run more than once. It clears any policies it created
-- previously before writing them again, so a failed run can simply be re-run.
-- ============================================================================

-- Older builds of 01_schema_core.sql created `colors` without is_active.
-- Add it if it is missing, so the taxonomy policy loop below works either way.
alter table colors add column if not exists is_active boolean not null default true;

-- Clear existing policies on our tables so this script can be re-run cleanly.
do $$
declare r record;
begin
  for r in
    select p.polname, c.relname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.polname, r.relname);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'platform_settings','profiles','seller_applications','admin_roles','admin_users',
    'admin_activity_log','login_history','otp_codes','categories','brands','conditions',
    'sizes','colors','listings','listing_images','listing_moderation','listing_info_requests',
    'authentication_checks','favorites','listing_views','orders','order_events',
    'order_cancellations','returns','disputes','dispute_messages','transactions','payouts',
    'payout_items','reports','campaigns','discount_codes','discount_redemptions','banners',
    'featured_collections','featured_collection_items','featured_sellers','content_pages',
    'content_blocks','faqs','blog_posts','notification_campaigns','notifications',
    'conversations','messages']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Safe public projection of member data (no phone, address, DOB)
create or replace view public_profiles as
  select id, username, full_name, avatar_url, bio, city, area,
         is_seller, seller_status, identity_verified, created_at
  from profiles
  where account_status = 'active';

-- ---------------------------------------------------------------------------
-- SETTINGS / TAXONOMY — world-readable, admin-writable
-- ---------------------------------------------------------------------------
create policy "settings readable"  on platform_settings for select using (true);
create policy "settings admin"     on platform_settings for update using (has_perm('settings.manage'));

do $$
declare t text;
begin
  foreach t in array array['categories','brands','conditions','sizes','colors'] loop
    execute format('create policy "%1$s public read" on %1$I for select using (is_active or is_admin())', t);
    execute format('create policy "%1$s admin write" on %1$I for all
                    using (has_perm(''taxonomy.manage'')) with check (has_perm(''taxonomy.manage''))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create policy "profiles read own"    on profiles for select using (auth.uid() = id);
create policy "profiles read active" on profiles for select using (account_status = 'active');
create policy "profiles read admin"  on profiles for select using (has_perm('users.view'));
create policy "profiles update own"  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles admin write" on profiles for update using (has_perm('users.manage'));

create policy "seller apps own"   on seller_applications for select using (auth.uid() = user_id);
create policy "seller apps create" on seller_applications for insert with check (auth.uid() = user_id);
create policy "seller apps admin" on seller_applications for all
  using (has_perm('users.approve_sellers')) with check (has_perm('users.approve_sellers'));

-- ---------------------------------------------------------------------------
-- ADMIN TABLES — only admins, and role editing needs its own permission
-- ---------------------------------------------------------------------------
create policy "roles read"  on admin_roles for select using (is_admin());
create policy "roles write" on admin_roles for all
  using (has_perm('admin.manage_roles')) with check (has_perm('admin.manage_roles'));

create policy "admin users read"  on admin_users for select using (is_admin());
create policy "admin users write" on admin_users for all
  using (has_perm('admin.manage_admins')) with check (has_perm('admin.manage_admins'));

-- audit log is append-only and never editable, not even by a full admin
create policy "activity read"   on admin_activity_log for select using (has_perm('admin.view_audit'));
create policy "activity insert" on admin_activity_log for insert with check (true);

create policy "login hist own"   on login_history for select using (auth.uid() = user_id);
create policy "login hist admin" on login_history for select using (has_perm('admin.view_audit'));
create policy "login hist insert" on login_history for insert with check (true);

-- OTPs are never selectable from the client; only the RPCs (security definer) touch them
create policy "otp no direct read" on otp_codes for select using (false);

-- ---------------------------------------------------------------------------
-- LISTINGS
-- ---------------------------------------------------------------------------
create policy "listings public read" on listings for select
  using (status in ('active','reserved','sold'));
create policy "listings seller read" on listings for select using (auth.uid() = seller_id);
create policy "listings admin read"  on listings for select using (has_perm('listings.view'));

-- Any active member may create a listing, but only as a draft or a submission.
-- Nothing reaches the feed without an admin approving it, and seller approval
-- is tracked separately so you can still gate payouts on verified identity.
create policy "listings seller insert" on listings for insert
  with check (
    auth.uid() = seller_id
    and status in ('draft','pending_review')
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_status = 'active')
  );

-- a seller may edit their own listing only while it is not mid-transaction,
-- and may never self-approve it into 'active'
create policy "listings seller update" on listings for update
  using (auth.uid() = seller_id and status in ('draft','pending_review','rejected','active','reserved'))
  with check (auth.uid() = seller_id and status in ('draft','pending_review','removed','reserved'));

create policy "listings seller delete" on listings for delete
  using (auth.uid() = seller_id and status in ('draft','rejected'));

create policy "listings admin write" on listings for all
  using (has_perm('listings.moderate')) with check (has_perm('listings.moderate'));

create policy "images public read" on listing_images for select
  using (exists (select 1 from listings l where l.id = listing_id
                 and (l.status in ('active','reserved','sold') or l.seller_id = auth.uid() or is_admin())));
create policy "images seller write" on listing_images for all
  using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "images admin write" on listing_images for all
  using (has_perm('listings.moderate')) with check (has_perm('listings.moderate'));

create policy "moderation seller read" on listing_moderation for select
  using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "moderation admin" on listing_moderation for all
  using (has_perm('listings.moderate')) with check (has_perm('listings.moderate'));

create policy "info req seller" on listing_info_requests for select
  using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "info req seller respond" on listing_info_requests for update
  using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "info req admin" on listing_info_requests for all
  using (has_perm('listings.moderate')) with check (has_perm('listings.moderate'));

create policy "auth checks seller read" on authentication_checks for select
  using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "auth checks public read" on authentication_checks for select
  using (status = 'passed' and exists (select 1 from listings l where l.id = listing_id and l.status = 'active'));
create policy "auth checks admin" on authentication_checks for all
  using (has_perm('listings.authenticate')) with check (has_perm('listings.authenticate'));

create policy "favorites own" on favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "views insert" on listing_views for insert with check (true);
create policy "views admin"  on listing_views for select using (has_perm('analytics.view'));

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
create policy "orders buyer read"  on orders for select using (auth.uid() = buyer_id);
create policy "orders seller read" on orders for select using (auth.uid() = seller_id);
create policy "orders admin read"  on orders for select using (has_perm('orders.view'));

-- orders are only created through place_order(); direct inserts are blocked
create policy "orders no direct insert" on orders for insert with check (false);

-- buyer may only move an order forward in the ways that belong to them
create policy "orders buyer update" on orders for update
  using (auth.uid() = buyer_id and status in ('delivered','shipped'))
  with check (auth.uid() = buyer_id and status in ('accepted','delivered','shipped'));
create policy "orders seller update" on orders for update
  using (auth.uid() = seller_id and status in ('placed','confirmed'))
  with check (auth.uid() = seller_id and status in ('confirmed','collected'));
create policy "orders admin write" on orders for all
  using (has_perm('orders.manage')) with check (has_perm('orders.manage'));

create policy "order events read" on order_events for select
  using (exists (select 1 from orders o where o.id = order_id
                 and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())) or has_perm('orders.view'));
create policy "order events insert" on order_events for insert with check (true);

create policy "cancellations own" on order_cancellations for select
  using (exists (select 1 from orders o where o.id = order_id
                 and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "cancellations create" on order_cancellations for insert
  with check (exists (select 1 from orders o where o.id = order_id
                      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "cancellations admin" on order_cancellations for all
  using (has_perm('orders.manage')) with check (has_perm('orders.manage'));

create policy "returns own"    on returns for select using (auth.uid() = buyer_id);
create policy "returns seller" on returns for select
  using (exists (select 1 from orders o where o.id = order_id and o.seller_id = auth.uid()));
create policy "returns create" on returns for insert
  with check (auth.uid() = buyer_id
              and exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid()));
create policy "returns admin"  on returns for all
  using (has_perm('orders.returns')) with check (has_perm('orders.returns'));

create policy "disputes party" on disputes for select
  using (exists (select 1 from orders o where o.id = order_id
                 and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "disputes create" on disputes for insert
  with check (exists (select 1 from orders o where o.id = order_id
                      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "disputes admin" on disputes for all
  using (has_perm('orders.disputes')) with check (has_perm('orders.disputes'));

create policy "dispute msgs party" on dispute_messages for select
  using (not is_internal and exists (
    select 1 from disputes d join orders o on o.id = d.order_id
     where d.id = dispute_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "dispute msgs create" on dispute_messages for insert
  with check (auth.uid() = author_id);
create policy "dispute msgs admin" on dispute_messages for all
  using (has_perm('orders.disputes')) with check (has_perm('orders.disputes'));

-- ---------------------------------------------------------------------------
-- MONEY
-- ---------------------------------------------------------------------------
create policy "txn own"   on transactions for select using (auth.uid() = user_id);
create policy "txn admin" on transactions for all
  using (has_perm('payments.view')) with check (has_perm('payments.manage'));

create policy "payouts own"   on payouts for select using (auth.uid() = seller_id);
create policy "payouts admin" on payouts for all
  using (has_perm('payments.payouts')) with check (has_perm('payments.payouts'));

create policy "payout items own" on payout_items for select
  using (exists (select 1 from payouts p where p.id = payout_id and p.seller_id = auth.uid()));
create policy "payout items admin" on payout_items for all
  using (has_perm('payments.payouts')) with check (has_perm('payments.payouts'));

-- ---------------------------------------------------------------------------
-- REPORTS
-- ---------------------------------------------------------------------------
create policy "reports own read" on reports for select using (auth.uid() = reporter_id);
create policy "reports create"   on reports for insert with check (auth.uid() = reporter_id);
create policy "reports admin"    on reports for all
  using (has_perm('reports.manage')) with check (has_perm('reports.manage'));

-- ---------------------------------------------------------------------------
-- PROMOTIONS / CONTENT — public reads the live rows, admin edits
-- ---------------------------------------------------------------------------
create policy "campaigns read"  on campaigns for select using (is_active or is_admin());
create policy "campaigns admin" on campaigns for all
  using (has_perm('promotions.manage')) with check (has_perm('promotions.manage'));

-- codes are validated inside place_order(); clients cannot enumerate them
create policy "codes no browse" on discount_codes for select using (is_admin());
create policy "codes admin"     on discount_codes for all
  using (has_perm('promotions.manage')) with check (has_perm('promotions.manage'));

create policy "redemptions own"   on discount_redemptions for select using (auth.uid() = user_id);
create policy "redemptions admin" on discount_redemptions for select using (has_perm('promotions.manage'));

create policy "banners read"  on banners for select
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())) or is_admin());
create policy "banners admin" on banners for all
  using (has_perm('promotions.manage')) with check (has_perm('promotions.manage'));

create policy "collections read"  on featured_collections for select using (is_active or is_admin());
create policy "collections admin" on featured_collections for all
  using (has_perm('promotions.manage')) with check (has_perm('promotions.manage'));
create policy "collection items read"  on featured_collection_items for select using (true);
create policy "collection items admin" on featured_collection_items for all
  using (has_perm('promotions.manage')) with check (has_perm('promotions.manage'));

create policy "featured sellers read"  on featured_sellers for select using (is_active or is_admin());
create policy "featured sellers admin" on featured_sellers for all
  using (has_perm('promotions.manage')) with check (has_perm('promotions.manage'));

create policy "pages read"  on content_pages for select using (status = 'published' or is_admin());
create policy "pages admin" on content_pages for all
  using (has_perm('content.manage')) with check (has_perm('content.manage'));

create policy "blocks read"  on content_blocks for select using (true);
create policy "blocks admin" on content_blocks for all
  using (has_perm('content.manage')) with check (has_perm('content.manage'));

create policy "faqs read"  on faqs for select using (is_active or is_admin());
create policy "faqs admin" on faqs for all
  using (has_perm('content.manage')) with check (has_perm('content.manage'));

create policy "posts read"  on blog_posts for select using (status = 'published' or is_admin());
create policy "posts admin" on blog_posts for all
  using (has_perm('content.manage')) with check (has_perm('content.manage'));

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS & MESSAGES
-- ---------------------------------------------------------------------------
create policy "notif own read"   on notifications for select using (auth.uid() = user_id);
create policy "notif own update" on notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notif admin" on notifications for all
  using (has_perm('notifications.send')) with check (has_perm('notifications.send'));

create policy "notif campaigns admin" on notification_campaigns for all
  using (has_perm('notifications.send')) with check (has_perm('notifications.send'));

create policy "conversations party" on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id or has_perm('orders.view'));
create policy "conversations create" on conversations for insert
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "messages party" on messages for select
  using (exists (select 1 from conversations c where c.id = conversation_id
                 and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())) or has_perm('orders.view'));
create policy "messages send" on messages for insert
  with check (auth.uid() = sender_id and exists (
    select 1 from conversations c where c.id = conversation_id
     and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public_profiles to anon, authenticated;
grant execute on function is_admin, has_perm, admin_permissions, is_approved_seller to authenticated;
grant execute on function bump_listing_view to anon, authenticated;
grant execute on function place_order, my_seller_summary, verify_otp, issue_otp to authenticated;
grant execute on function admin_dashboard_stats, admin_recent_activity, admin_sales_by_month,
      admin_top_brands, admin_top_categories, admin_seller_summary,
      admin_moderate_listing, admin_review_seller, admin_set_user_status,
      admin_record_authentication, admin_send_notification, admin_process_payout to authenticated;
