-- ============================================================================
-- 14_reviews_notifications_free_protection.sql
--
--   · Buyer Protection becomes free for buyers (no fee added at checkout)
--   · seller reviews: buyers rate a seller once per accepted order,
--     ratings are public so listings can show them
--   · order notifications: the seller hears the moment something sells
--     (with the money breakdown), the buyer gets a confirmation, and on
--     acceptance the seller sees the payout moving and the buyer is asked
--     to leave a review
--   · newsletter signups from the homepage band
--
-- Safe to run more than once. Run it in the Supabase SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Buyer Protection is free — nothing is added on top of the item price
-- ---------------------------------------------------------------------------
update platform_settings
   set buyer_protection_rate = 0,
       buyer_protection_min  = 0
 where id;

-- ---------------------------------------------------------------------------
-- 2. Seller reviews
-- ---------------------------------------------------------------------------
create table if not exists seller_reviews (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references orders(id) on delete cascade,
  seller_id  uuid not null references profiles(id) on delete cascade,
  buyer_id   uuid not null references profiles(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reviews_seller on seller_reviews(seller_id, created_at desc);

alter table seller_reviews enable row level security;

drop policy if exists "reviews public read" on seller_reviews;
create policy "reviews public read" on seller_reviews
  for select using (true);

-- One review per order, only by the buyer of that order, only once accepted.
drop policy if exists "reviews buyer insert" on seller_reviews;
create policy "reviews buyer insert" on seller_reviews
  for insert with check (
    auth.uid() = buyer_id
    and exists (
      select 1 from orders o
       where o.id = seller_reviews.order_id
         and o.buyer_id = auth.uid()
         and o.seller_id = seller_reviews.seller_id
         and o.status = 'accepted'
    )
  );

drop policy if exists "reviews admin" on seller_reviews;
create policy "reviews admin" on seller_reviews
  for all using (has_perm('reports.manage')) with check (has_perm('reports.manage'));

-- ---------------------------------------------------------------------------
-- 3. Newsletter signups
-- ---------------------------------------------------------------------------
create table if not exists newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null unique,
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

drop policy if exists "newsletter signup" on newsletter_subscribers;
create policy "newsletter signup" on newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "newsletter admin read" on newsletter_subscribers;
create policy "newsletter admin read" on newsletter_subscribers
  for select using (has_perm('analytics.view'));

-- ---------------------------------------------------------------------------
-- 4. Order notifications — sold receipt, confirmation, payout, review prompt
--    (full replacement of order_after_save; the original logic is kept)
-- ---------------------------------------------------------------------------
create or replace function order_after_save() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_cur   text;
begin
  select coalesce(currency, 'JOD') into v_cur from platform_settings where id;

  if tg_op = 'INSERT' then
    update listings set status = 'sold', sold_at = now() where id = new.listing_id;
    insert into order_events(order_id, status, note, actor_id, actor_role)
      values (new.id, new.status::text, 'Order placed', new.buyer_id, 'buyer');
    insert into transactions(order_id, user_id, type, status, amount, method, description)
      values (new.id, new.buyer_id, 'payment',
              case when new.payment_method = 'cod' then 'pending' else 'pending' end,
              new.total, new.payment_method, 'Order ' || new.order_no);

    select title into v_title from listings where id = new.listing_id;

    -- the seller's receipt, with the exact breakdown
    insert into notifications(user_id, type, title, body, link_url)
    values (new.seller_id, 'item_sold', 'Your item sold 🎉',
            coalesce(v_title, 'Your piece') || ' — sale price ' || new.item_price || ' ' || v_cur
            || '. Platform fee −' || new.commission_amount || ' ' || v_cur
            || '. You earn ' || new.seller_amount || ' ' || v_cur
            || '. Next: arrange the handover with the buyer.',
            '/account.html?tab=sales');

    -- the buyer's confirmation
    insert into notifications(user_id, type, title, body, link_url)
    values (new.buyer_id, 'order_placed', 'Order ' || new.order_no || ' confirmed',
            coalesce(v_title, 'Your piece') || ' is yours pending the handover. '
            || 'Your payment is protected until you inspect it and accept.',
            '/account.html?tab=orders');

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

      -- seller: money is on the way
      insert into notifications(user_id, type, title, body, link_url)
      values (new.seller_id, 'payment_released', 'Payment released on ' || new.order_no,
              'The buyer accepted. Your payout of ' || new.seller_amount || ' ' || v_cur
              || ' is scheduled.',
              '/account.html?tab=payouts');

      -- buyer: how was it?
      insert into notifications(user_id, type, title, body, link_url)
      values (new.buyer_id, 'review_prompt', 'How was your purchase?',
              'Leave the seller a quick rating — it helps the next buyer trust them.',
              '/account.html?tab=orders');
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
