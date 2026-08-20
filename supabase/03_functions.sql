-- ============================================================================
-- SecondChance Collective — Functions, triggers & RPCs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','listings','orders','content_pages','blog_posts']
  loop
    execute format('drop trigger if exists trg_%s_updated on %I', t, t);
    execute format('create trigger trg_%s_updated before update on %I
                    for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New auth user → profile row
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username, phone, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'username',''),
    new.raw_user_meta_data->>'phone',
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep email_verified in sync
create or replace function sync_email_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and (old.email_confirmed_at is null) then
    update public.profiles set email_verified = true where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function sync_email_verified();

-- ---------------------------------------------------------------------------
-- PERMISSION HELPERS  (used everywhere in RLS)
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users au
    join profiles p on p.id = au.user_id
    where au.user_id = auth.uid()
      and au.is_active
      and p.account_status = 'active'
  );
$$;

create or replace function admin_permissions() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(r.permissions, '{}')
  from admin_users au join admin_roles r on r.id = au.role_id
  where au.user_id = auth.uid() and au.is_active
  limit 1;
$$;

-- '*' in a role's permission array means full access
create or replace function has_perm(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users au join admin_roles r on r.id = au.role_id
    where au.user_id = auth.uid() and au.is_active
      and ('*' = any(r.permissions) or perm = any(r.permissions))
  );
$$;

create or replace function is_approved_seller() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and seller_status = 'approved' and account_status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference number generators
-- ---------------------------------------------------------------------------
create or replace function set_listing_reference() returns trigger
language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'SC-' || lpad(nextval('listing_ref_seq')::text, 6, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_listing_ref on listings;
create trigger trg_listing_ref before insert on listings
  for each row execute function set_listing_reference();

create or replace function set_order_no() returns trigger
language plpgsql as $$
begin
  if new.order_no is null then
    new.order_no := 'SC' || to_char(now(),'YY') || lpad(nextval('order_no_seq')::text, 6, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_order_no on orders;
create trigger trg_order_no before insert on orders
  for each row execute function set_order_no();

create or replace function set_payout_no() returns trigger
language plpgsql as $$
begin
  if new.payout_no is null then
    new.payout_no := 'PO-' || lpad(nextval('payout_no_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_payout_no on payouts;
create trigger trg_payout_no before insert on payouts
  for each row execute function set_payout_no();

-- ---------------------------------------------------------------------------
-- Listing search vector + authentication requirement
-- ---------------------------------------------------------------------------
create or replace function listing_before_save() returns trigger
language plpgsql as $$
declare threshold numeric;
begin
  new.search_vector :=
      setweight(to_tsvector('simple', coalesce(new.title,'')), 'A')
   || setweight(to_tsvector('simple', coalesce(new.color,'') || ' ' || coalesce(new.size_label,'')), 'B')
   || setweight(to_tsvector('simple', coalesce(new.description,'')), 'C');

  select authentication_threshold into threshold from platform_settings where id;
  if new.price >= coalesce(threshold, 350) then
    if new.authentication_status = 'not_required' then
      new.authentication_status := 'pending';
    end if;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'sold' and new.sold_at is null then
    new.sold_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_listing_save on listings;
create trigger trg_listing_save before insert or update on listings
  for each row execute function listing_before_save();

-- Favourite counter
create or replace function sync_favorite_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update listings set favorite_count = favorite_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update listings set favorite_count = greatest(favorite_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_fav_count on favorites;
create trigger trg_fav_count after insert or delete on favorites
  for each row execute function sync_favorite_count();

-- ---------------------------------------------------------------------------
-- ORDER MATHS — commission is computed server-side, never trusted from client
-- ---------------------------------------------------------------------------
create or replace function order_before_save() returns trigger
language plpgsql as $$
declare s record;
begin
  select * into s from platform_settings where id;

  if tg_op = 'INSERT' then
    new.commission_rate   := coalesce(new.commission_rate, s.commission_rate);
    new.buyer_protection_fee := coalesce(nullif(new.buyer_protection_fee,0),
                                greatest(round(new.item_price * s.buyer_protection_rate, 2), s.buyer_protection_min));
    new.shipping_fee      := coalesce(new.shipping_fee, s.shipping_flat_fee);
    new.total             := round(new.item_price + new.buyer_protection_fee + new.shipping_fee - coalesce(new.discount_amount,0), 2);
    new.commission_amount := round(new.item_price * new.commission_rate, 2);
    new.seller_amount     := round(new.item_price - new.commission_amount, 2);
  end if;

  if new.status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
  if new.status = 'accepted'  and new.accepted_at  is null then new.accepted_at  := now(); end if;
  if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_order_save on orders;
create trigger trg_order_save before insert or update on orders
  for each row execute function order_before_save();

-- Order side-effects: mark listing sold, write timeline, record commission txn
create or replace function order_after_save() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update listings set status = 'sold', sold_at = now() where id = new.listing_id;
    insert into order_events(order_id, status, note, actor_id, actor_role)
      values (new.id, new.status::text, 'Order placed', new.buyer_id, 'buyer');
    insert into transactions(order_id, user_id, type, status, amount, method, description)
      values (new.id, new.buyer_id, 'payment',
              case when new.payment_method = 'cod' then 'pending' else 'pending' end,
              new.total, new.payment_method, 'Order ' || new.order_no);

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into order_events(order_id, status, note, actor_role)
      values (new.id, new.status::text, 'Status changed from ' || old.status, 'system');

    -- commission is only booked once the buyer accepts
    if new.status = 'accepted' and old.status <> 'accepted' then
      insert into transactions(order_id, user_id, type, status, amount, description, processed_at)
        values (new.id, new.seller_id, 'commission', 'completed', new.commission_amount,
                'Commission on ' || new.order_no, now());
      insert into payouts(seller_id, amount, status, scheduled_for)
        values (new.seller_id, new.seller_amount, 'pending',
                (now() + (select payout_hold_days from platform_settings where id) * interval '1 day')::date);
    end if;

    -- returning the item puts it back on sale
    if new.status in ('cancelled','returned') and old.status not in ('cancelled','returned') then
      update listings set status = 'active', sold_at = null where id = new.listing_id;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_order_after on orders;
create trigger trg_order_after after insert or update on orders
  for each row execute function order_after_save();

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT TRAIL — automatic on sensitive tables
-- ---------------------------------------------------------------------------
create or replace function log_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return coalesce(new, old); end if;
  insert into admin_activity_log(admin_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['listings','orders','profiles','payouts','discount_codes',
                           'content_pages','banners','admin_users','platform_settings','reports']
  loop
    execute format('drop trigger if exists trg_audit_%s on %I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on %I
                    for each row execute function log_admin_change()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- OTP: issue & verify  (codes are hashed, never stored in plain text)
-- ---------------------------------------------------------------------------
create or replace function issue_otp(p_destination text, p_purpose otp_purpose, p_channel text default 'email')
returns table (otp_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid; recent int;
begin
  -- rate limit: max 3 codes per destination per 10 minutes
  select count(*) into recent from otp_codes
   where destination = p_destination and created_at > now() - interval '10 minutes';
  if recent >= 3 then
    raise exception 'Too many codes requested. Please wait a few minutes.' using errcode = 'P0001';
  end if;

  v_id   := gen_random_uuid();
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into otp_codes(id, user_id, destination, channel, purpose, code_hash, expires_at)
  values (v_id, auth.uid(), p_destination, p_channel, p_purpose,
          encode(digest(v_code || v_id::text, 'sha256'), 'hex'),
          now() + interval '10 minutes');

  return query select v_id, v_code;   -- caller (Edge Function) delivers the code
end $$;

create or replace function verify_otp(p_destination text, p_purpose otp_purpose, p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  select * into rec from otp_codes
   where destination = p_destination and purpose = p_purpose
     and consumed_at is null and expires_at > now()
   order by created_at desc limit 1;

  if rec is null then return false; end if;

  if rec.attempts >= rec.max_attempts then
    update otp_codes set consumed_at = now() where id = rec.id;
    return false;
  end if;

  if rec.code_hash = encode(digest(p_code || rec.id::text, 'sha256'), 'hex') then
    update otp_codes set consumed_at = now() where id = rec.id;
    if rec.purpose = 'phone_verify' and rec.user_id is not null then
      update profiles set phone_verified = true where id = rec.user_id;
    end if;
    return true;
  else
    update otp_codes set attempts = attempts + 1 where id = rec.id;
    return false;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ADMIN DASHBOARD — one round-trip for all headline numbers
-- ---------------------------------------------------------------------------
create or replace function admin_dashboard_stats(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb; since timestamptz;
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  since := now() - (p_days || ' days')::interval;

  select jsonb_build_object(
    'total_users',      (select count(*) from profiles),
    'new_users',        (select count(*) from profiles where created_at >= since),
    'total_sellers',    (select count(*) from profiles where seller_status = 'approved'),
    'active_sellers',   (select count(distinct seller_id) from listings where status = 'active'),
    'active_listings',  (select count(*) from listings where status = 'active'),
    'draft_listings',   (select count(*) from listings where status = 'draft'),
    'items_sold',       (select count(*) from orders where status not in ('cancelled','returned','refunded')),
    'items_sold_period',(select count(*) from orders where created_at >= since and status not in ('cancelled','returned')),
    'pending_listings', (select count(*) from listings where status = 'pending_review'),
    'pending_sellers',  (select count(*) from seller_applications where status = 'pending'),
    'pending_auth',     (select count(*) from authentication_checks where status in ('pending','in_progress')),
    'total_sales',      (select coalesce(sum(total),0) from orders where status not in ('cancelled','returned','refunded')),
    'sales_period',     (select coalesce(sum(total),0) from orders where created_at >= since and status not in ('cancelled','returned','refunded')),
    'commission_earned',(select coalesce(sum(commission_amount),0) from orders where status = 'accepted'),
    'pending_payouts',  (select coalesce(sum(amount),0) from payouts where status in ('pending','scheduled','processing')),
    'payout_count',     (select count(*) from payouts where status in ('pending','scheduled')),
    'open_reports',     (select count(*) from reports where status in ('open','investigating')),
    'open_disputes',    (select count(*) from disputes where status not in ('resolved')),
    'open_returns',     (select count(*) from returns where status in ('requested','approved','in_transit')),
    'avg_order_value',  (select coalesce(round(avg(total),2),0) from orders where status not in ('cancelled','returned')),
    'currency',         (select currency from platform_settings where id)
  ) into result;
  return result;
end $$;

create or replace function admin_recent_activity(p_limit int default 20)
returns table (kind text, title text, detail text, ref text, at timestamptz)
language sql security definer set search_path = public as $$
  select * from (
    select 'listing'::text, l.title, 'New listing from ' || coalesce(p.username, p.full_name, 'member'),
           l.id::text, l.created_at
      from listings l join profiles p on p.id = l.seller_id
    union all
    select 'order', 'Order ' || o.order_no, o.status::text || ' · ' || o.currency || ' ' || o.total,
           o.id::text, o.created_at from orders o
    union all
    select 'report', 'Report: ' || r.category::text, coalesce(r.description,''), r.id::text, r.created_at
      from reports r
    union all
    select 'user', coalesce(p.full_name, p.username, 'New member'), 'Joined', p.id::text, p.created_at
      from profiles p
  ) t(kind, title, detail, ref, at)
  where (select is_admin())
  order by at desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- ANALYTICS
-- ---------------------------------------------------------------------------
create or replace function admin_sales_by_month(p_months int default 12)
returns table (month date, orders bigint, revenue numeric, commission numeric)
language sql security definer set search_path = public as $$
  select date_trunc('month', created_at)::date,
         count(*),
         coalesce(sum(total),0),
         coalesce(sum(commission_amount),0)
  from orders
  where (select is_admin())
    and created_at >= date_trunc('month', now()) - ((p_months - 1) || ' months')::interval
    and status not in ('cancelled','returned','refunded')
  group by 1 order by 1;
$$;

create or replace function admin_top_brands(p_limit int default 10)
returns table (brand text, listings bigint, sold bigint, revenue numeric)
language sql security definer set search_path = public as $$
  select b.name,
         count(distinct l.id),
         count(distinct o.id),
         coalesce(sum(o.total),0)
  from brands b
  left join listings l on l.brand_id = b.id
  left join orders o on o.listing_id = l.id and o.status not in ('cancelled','returned')
  where (select is_admin())
  group by b.name order by 4 desc, 2 desc limit p_limit;
$$;

create or replace function admin_top_categories(p_limit int default 10)
returns table (category text, listings bigint, sold bigint, revenue numeric)
language sql security definer set search_path = public as $$
  select c.name,
         count(distinct l.id),
         count(distinct o.id),
         coalesce(sum(o.total),0)
  from categories c
  left join listings l on l.category_id = c.id
  left join orders o on o.listing_id = l.id and o.status not in ('cancelled','returned')
  where (select is_admin())
  group by c.name order by 4 desc limit p_limit;
$$;

create or replace function admin_seller_summary(p_seller uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  select jsonb_build_object(
    'listed_active', (select count(*) from listings where seller_id = p_seller and status = 'active'),
    'listed_total',  (select count(*) from listings where seller_id = p_seller),
    'sold',          (select count(*) from orders where seller_id = p_seller and status not in ('cancelled','returned')),
    'gross',         (select coalesce(sum(item_price),0) from orders where seller_id = p_seller and status not in ('cancelled','returned')),
    'earnings',      (select coalesce(sum(seller_amount),0) from orders where seller_id = p_seller and status = 'accepted'),
    'commission',    (select coalesce(sum(commission_amount),0) from orders where seller_id = p_seller and status = 'accepted'),
    'pending_payout',(select coalesce(sum(amount),0) from payouts where seller_id = p_seller and status in ('pending','scheduled','processing')),
    'paid_out',      (select coalesce(sum(amount),0) from payouts where seller_id = p_seller and status = 'paid'),
    'reports',       (select count(*) from reports where target_user_id = p_seller),
    'cancel_rate',   (select case when count(*) = 0 then 0
                       else round(100.0 * count(*) filter (where status = 'cancelled') / count(*), 1) end
                       from orders where seller_id = p_seller)
  ) into result;
  return result;
end $$;

-- Seller-facing version of the same numbers (own data only)
create or replace function my_seller_summary()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb; me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  select jsonb_build_object(
    'listed_active', (select count(*) from listings where seller_id = me and status = 'active'),
    'in_review',     (select count(*) from listings where seller_id = me and status = 'pending_review'),
    'drafts',        (select count(*) from listings where seller_id = me and status = 'draft'),
    'sold',          (select count(*) from orders where seller_id = me and status not in ('cancelled','returned')),
    'earnings',      (select coalesce(sum(seller_amount),0) from orders where seller_id = me and status = 'accepted'),
    'pending_payout',(select coalesce(sum(amount),0) from payouts where seller_id = me and status in ('pending','scheduled','processing')),
    'paid_out',      (select coalesce(sum(amount),0) from payouts where seller_id = me and status = 'paid'),
    'views',         (select coalesce(sum(view_count),0) from listings where seller_id = me)
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- ADMIN ACTIONS (RPC — permission-checked, audited)
-- ---------------------------------------------------------------------------
create or replace function admin_moderate_listing(
  p_listing uuid, p_decision text, p_reason text default null, p_notes text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('listings.moderate') then raise exception 'Not authorised'; end if;

  if p_decision = 'approved' then
    update listings set status = 'active', approved_by = auth.uid(),
           published_at = coalesce(published_at, now()), rejection_reason = null
     where id = p_listing;
  elsif p_decision = 'rejected' then
    update listings set status = 'rejected', rejected_by = auth.uid(), rejection_reason = p_reason
     where id = p_listing;
  elsif p_decision = 'removed' then
    update listings set status = 'removed', rejection_reason = p_reason where id = p_listing;
  elsif p_decision = 'flagged' then
    update listings set is_flagged = true, flag_reason = p_reason where id = p_listing;
  elsif p_decision = 'unflagged' then
    update listings set is_flagged = false, flag_reason = null where id = p_listing;
  end if;

  insert into listing_moderation(listing_id, admin_id, decision, reason_code, notes)
  values (p_listing, auth.uid(), p_decision, p_reason, p_notes);

  -- notify the seller
  insert into notifications(user_id, type, title, body, link_url)
  select seller_id, 'listing_' || p_decision,
         case p_decision when 'approved' then 'Your listing is live'
                         when 'rejected' then 'Listing needs changes'
                         else 'Listing updated' end,
         coalesce(p_reason, title), '/account.html?tab=listings'
  from listings where id = p_listing;
end $$;

create or replace function admin_review_seller(p_application uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not has_perm('users.approve_sellers') then raise exception 'Not authorised'; end if;
  select user_id into v_user from seller_applications where id = p_application;

  update seller_applications
     set status = case when p_approve then 'approved' else 'rejected' end::seller_status,
         reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
   where id = p_application;

  update profiles
     set seller_status = case when p_approve then 'approved' else 'rejected' end::seller_status,
         is_seller = p_approve
   where id = v_user;

  insert into notifications(user_id, type, title, body)
  values (v_user, 'seller_review',
          case when p_approve then 'You can start selling' else 'Seller application declined' end,
          coalesce(p_reason, case when p_approve then 'Your seller account is approved.' else '' end));
end $$;

create or replace function admin_set_user_status(p_user uuid, p_status account_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('users.suspend') then raise exception 'Not authorised'; end if;
  update profiles set account_status = p_status, suspended_reason = p_reason where id = p_user;
  if p_status <> 'active' then
    update listings set status = 'removed' where seller_id = p_user and status in ('active','pending_review');
  end if;
end $$;

create or replace function admin_record_authentication(
  p_listing uuid, p_verdict text, p_checklist jsonb default '{}', p_notes text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_status auth_status;
begin
  if not has_perm('listings.authenticate') then raise exception 'Not authorised'; end if;
  v_status := case when p_verdict = 'authentic' then 'passed' else 'failed' end::auth_status;

  insert into authentication_checks(listing_id, authenticator_id, status, checklist, verdict, notes,
                                    certificate_no, completed_at)
  values (p_listing, auth.uid(), v_status, p_checklist, p_verdict, p_notes,
          case when p_verdict = 'authentic'
               then 'AUTH-' || upper(substr(md5(p_listing::text || now()::text),1,8)) end,
          now());

  update listings set authentication_status = v_status,
         status = case when p_verdict = 'counterfeit' then 'removed'::listing_status else status end,
         is_flagged = (p_verdict = 'counterfeit')
   where id = p_listing;
end $$;

create or replace function admin_send_notification(
  p_title text, p_body text, p_audience notif_audience, p_link text default null, p_user uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare v_campaign uuid; v_count int;
begin
  if not has_perm('notifications.send') then raise exception 'Not authorised'; end if;

  insert into notification_campaigns(title, body, audience, link_url, status, sent_at, created_by)
  values (p_title, p_body, p_audience, p_link, 'sent', now(), auth.uid())
  returning id into v_campaign;

  with targets as (
    select id from profiles
     where account_status = 'active'
       and case p_audience
             when 'all'     then true
             when 'sellers' then seller_status = 'approved'
             when 'buyers'  then seller_status <> 'approved'
             when 'user'    then id = p_user
             else false end
  )
  insert into notifications(user_id, campaign_id, type, title, body, link_url)
  select id, v_campaign, 'broadcast', p_title, p_body, p_link from targets;

  get diagnostics v_count = row_count;
  update notification_campaigns set recipient_count = v_count where id = v_campaign;
  return v_count;
end $$;

create or replace function admin_process_payout(p_payout uuid, p_status payout_status, p_reference text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_amount numeric;
begin
  if not has_perm('payments.payouts') then raise exception 'Not authorised'; end if;

  update payouts set status = p_status, reference = coalesce(p_reference, reference),
         processed_by = auth.uid(), processed_at = case when p_status = 'paid' then now() end
   where id = p_payout
   returning seller_id, amount into v_seller, v_amount;

  if p_status = 'paid' then
    insert into transactions(user_id, type, status, amount, description, processed_at)
    values (v_seller, 'payout', 'completed', v_amount, 'Payout ' || coalesce(p_reference,''), now());
    insert into notifications(user_id, type, title, body)
    values (v_seller, 'payout', 'Payout sent',
            'We have sent ' || v_amount || ' JOD to your account.');
  end if;
end $$;

-- Increment a view without granting UPDATE on listings
create or replace function bump_listing_view(p_listing uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update listings set view_count = view_count + 1 where id = p_listing and status = 'active';
  insert into listing_views(listing_id, user_id) values (p_listing, auth.uid());
end $$;

-- Checkout: creates the order atomically and re-validates price server-side
create or replace function place_order(
  p_listing uuid, p_method payment_method,
  p_name text, p_phone text, p_city text, p_area text, p_address text,
  p_notes text default null, p_discount_code text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare l record; v_order uuid; v_discount numeric := 0; dc record;
begin
  if auth.uid() is null then raise exception 'Sign in to place an order'; end if;

  select * into l from listings where id = p_listing for update;
  if l is null or l.status <> 'active' then
    raise exception 'This piece is no longer available';
  end if;
  if l.seller_id = auth.uid() then raise exception 'You cannot buy your own listing'; end if;

  if p_discount_code is not null then
    select * into dc from discount_codes
     where code = p_discount_code and is_active
       and (starts_at is null or starts_at <= now())
       and (ends_at   is null or ends_at   >= now())
       and (max_uses  is null or used_count < max_uses);
    if dc is not null and l.price >= coalesce(dc.min_order,0) then
      v_discount := case dc.type
        when 'percent' then least(round(l.price * dc.value / 100, 2), coalesce(dc.max_discount, 1e9))
        when 'fixed'   then least(dc.value, l.price)
        else 0 end;
      update discount_codes set used_count = used_count + 1 where id = dc.id;
    end if;
  end if;

  insert into orders(buyer_id, seller_id, listing_id, item_price, discount_amount, discount_code,
                     payment_method, shipping_name, shipping_phone, shipping_city,
                     shipping_area, shipping_address, shipping_notes, total, commission_amount, seller_amount, commission_rate)
  values (auth.uid(), l.seller_id, l.id, l.price, v_discount, p_discount_code,
          p_method, p_name, p_phone, p_city, p_area, p_address, p_notes, 0, 0, 0, 0)
  returning id into v_order;

  return v_order;
end $$;
