-- ============================================================================
-- SecondChance Collective — 07: remove delivery
--
-- The marketplace no longer arranges shipping. Buyer and seller handle the
-- handover between themselves, so every column, status and fee that existed to
-- track a courier comes out.
--
-- Safe to run more than once. Run it after 01-06.
-- ============================================================================

begin;

-- --- orders ---------------------------------------------------------------
alter table orders drop column if exists shipping_status    cascade;
alter table orders drop column if exists shipping_fee       cascade;
alter table orders drop column if exists shipping_name      cascade;
alter table orders drop column if exists shipping_phone     cascade;
alter table orders drop column if exists shipping_address   cascade;
alter table orders drop column if exists shipping_city      cascade;
alter table orders drop column if exists shipping_area      cascade;
alter table orders drop column if exists carrier            cascade;
alter table orders drop column if exists tracking_number    cascade;
alter table orders drop column if exists shipped_at         cascade;
alter table orders drop column if exists delivered_at       cascade;
alter table orders drop column if exists pickup_scheduled_at cascade;

-- Contact details still matter — the two parties need to reach each other.
alter table orders add column if not exists contact_name  text;
alter table orders add column if not exists contact_phone text;
alter table orders add column if not exists contact_note  text;

-- --- seller applications --------------------------------------------------
alter table seller_applications drop column if exists pickup_address cascade;

-- --- settings -------------------------------------------------------------
alter table platform_settings drop column if exists shipping_flat_fee cascade;
alter table platform_settings drop column if exists free_shipping_threshold cascade;

-- --- discount codes: free_shipping is no longer a meaningful type ---------
update discount_codes set type = 'percent', value = 0
where type::text = 'free_shipping';

-- --- the order lifecycle loses its courier stages -------------------------
-- placed -> confirmed -> authenticating -> ready -> completed
do $$
begin
  if exists (select 1 from pg_type where typname = 'shipping_status') then
    drop type if exists shipping_status cascade;
  end if;
end $$;

-- Re-point any orders sitting in a stage that no longer exists.
update orders set status = 'confirmed'
where status::text in ('collected', 'shipped');

update orders set status = 'accepted'
where status::text = 'delivered';

-- --- rebuild the order trigger without shipping ---------------------------
create or replace function order_before_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  rate numeric;
begin
  select * into s from platform_settings where id = true;
  rate := coalesce(s.commission_rate, 0.12);

  -- The client never gets to say what anything costs.
  if tg_op = 'INSERT' then
    new.commission_rate  := rate;
    new.buyer_protection_fee := greatest(
      round(new.item_price * coalesce(s.buyer_protection_rate, 0.05), 2),
      coalesce(s.buyer_protection_min, 3));
    new.total := new.item_price
               + new.buyer_protection_fee
               - coalesce(new.discount_amount, 0);
  end if;

  new.commission_amount := round(new.item_price * new.commission_rate, 2);
  new.seller_amount     := new.item_price - new.commission_amount;
  new.updated_at        := now();
  return new;
end $$;

commit;

-- ============================================================================
-- place_order, rebuilt without delivery.
--
-- The old signature is dropped explicitly: Postgres would otherwise keep it as
-- a separate overload, and the front end's four-argument call would be
-- ambiguous rather than simply resolving to the new one.
-- ============================================================================

drop function if exists place_order(uuid, text, text, text, text, text, text, text, text);
drop function if exists place_order(uuid, text, text, text, text, text, text, text);

create or replace function place_order(
  p_listing       uuid,
  p_method        text,
  p_name          text,
  p_phone         text,
  p_city          text default null,
  p_notes         text default null,
  p_discount_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing  record;
  v_order    uuid;
  v_discount numeric := 0;
  v_code     record;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to buy.';
  end if;

  select * into v_listing from listings where id = p_listing for update;

  if not found or v_listing.status <> 'active' then
    raise exception 'That piece is no longer available.';
  end if;

  if v_listing.seller_id = auth.uid() then
    raise exception 'You cannot buy your own listing.';
  end if;

  -- Discount codes are validated here, never trusted from the browser.
  if p_discount_code is not null and length(trim(p_discount_code)) > 0 then
    select * into v_code from discount_codes
    where upper(code) = upper(trim(p_discount_code))
      and is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now())
      and (max_uses  is null or used_count < max_uses)
      and (min_order is null or min_order <= v_listing.price);

    if found then
      v_discount := case
        when v_code.type::text = 'percent' then round(v_listing.price * v_code.value / 100, 2)
        else least(v_code.value, v_listing.price)
      end;
      update discount_codes set used_count = used_count + 1 where id = v_code.id;
    end if;
  end if;

  insert into orders (
    buyer_id, seller_id, listing_id, payment_method,
    contact_name, contact_phone, contact_note,
    item_price, discount_amount,
    buyer_protection_fee, total, commission_rate, commission_amount, seller_amount
  ) values (
    auth.uid(), v_listing.seller_id, p_listing, p_method::payment_method,
    p_name, p_phone, p_notes,
    v_listing.price, v_discount,
    0, 0, 0, 0, 0        -- the before-save trigger computes every figure
  )
  returning id into v_order;

  if v_code.id is not null then
    insert into discount_redemptions (code_id, order_id, user_id, amount)
    values (v_code.id, v_order, auth.uid(), v_discount);
  end if;

  update listings set status = 'reserved' where id = p_listing;

  insert into order_events (order_id, status, note)
  values (v_order, 'placed', 'Order placed. Buyer and seller arrange the handover.');

  return v_order;
end $$;

grant execute on function place_order(uuid, text, text, text, text, text, text) to authenticated;

-- ============================================================================
-- Check it worked:
--
--   select column_name from information_schema.columns
--   where table_name = 'orders' and column_name like '%ship%';
--
-- Should return no rows.
-- ============================================================================
