-- ============================================================================
-- SecondChance Collective — Seed data
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ADMIN ROLES
-- Permission keys are checked by has_perm() in RLS and RPCs.
-- '*' = everything.
-- ---------------------------------------------------------------------------
insert into admin_roles (key, name, description, permissions, is_system) values
('super_admin', 'Super Admin',
 'Full access including admin management, roles and platform settings.',
 array['*'], true),

('operations', 'Operations Manager',
 'Day-to-day running: listings, orders, users, reports. No financial payouts, no role changes.',
 array['users.view','users.manage','users.suspend','users.approve_sellers',
       'listings.view','listings.moderate','listings.authenticate','taxonomy.manage',
       'orders.view','orders.manage','orders.returns','orders.disputes',
       'reports.manage','notifications.send','analytics.view'], true),

('moderator', 'Listing Moderator',
 'Reviews and approves listings and handles reported content. Read-only on orders.',
 array['listings.view','listings.moderate','reports.manage','users.view','orders.view'], true),

('authenticator', 'Authenticator',
 'Quality control and authentication of submitted items only.',
 array['listings.view','listings.authenticate','users.view'], true),

('finance', 'Finance',
 'Transactions, commission, payouts and financial reports.',
 array['payments.view','payments.manage','payments.payouts',
       'orders.view','analytics.view','users.view'], true),

('support', 'Customer Support',
 'Reads orders and users, handles returns and disputes. Cannot change money or listings.',
 array['users.view','orders.view','orders.returns','orders.disputes',
       'reports.manage','listings.view'], true),

('content_editor', 'Content Editor',
 'Homepage content, pages, FAQs, blog, banners and promotions.',
 array['content.manage','promotions.manage','analytics.view'], true)
on conflict (key) do update
  set permissions = excluded.permissions,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
insert into categories (slug, name, name_ar, sort_order) values
('bags','Bags','حقائب',1),
('womenswear','Womenswear','ملابس نسائية',2),
('menswear','Menswear','ملابس رجالية',3),
('shoes','Shoes','أحذية',4),
('watches','Watches','ساعات',5),
('jewellery','Jewellery','مجوهرات',6),
('accessories','Accessories','إكسسوارات',7),
('vintage','Vintage','قطع كلاسيكية',8)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- BRANDS
-- ---------------------------------------------------------------------------
insert into brands (slug, name, tier, requires_auth, sort_order) values
('hermes','Hermès','ultra',true,1),
('chanel','Chanel','ultra',true,2),
('rolex','Rolex','ultra',true,3),
('cartier','Cartier','ultra',true,4),
('bottega-veneta','Bottega Veneta','luxury',true,5),
('prada','Prada','luxury',true,6),
('celine','Celine','luxury',true,7),
('loewe','Loewe','luxury',true,8),
('loro-piana','Loro Piana','luxury',true,9),
('saint-laurent','Saint Laurent','luxury',true,10),
('miu-miu','Miu Miu','luxury',true,11),
('the-row','The Row','luxury',true,12),
('maison-margiela','Maison Margiela','premium',true,13),
('jacquemus','Jacquemus','contemporary',false,14),
('khaite','Khaite','contemporary',false,15),
('toteme','Totême','contemporary',false,16)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- CONDITIONS  (mirrors the wording already on the sell page)
-- ---------------------------------------------------------------------------
insert into conditions (code, label, description, sort_order) values
('new_with_tags','New with tags','Unworn, tags attached',1),
('new_without_tags','New without tags','Unworn, no tags',2),
('very_good','Very good','Light use, no visible flaws',3),
('good','Good','Some wear, nothing structural',4),
('fair','Fair','Visible wear, described in full',5)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- SIZES
-- ---------------------------------------------------------------------------
insert into sizes (label, category_id, sort_order)
select s.label, c.id, s.ord from categories c,
  (values ('XXS',1),('XS',2),('S',3),('M',4),('L',5),('XL',6),('XXL',7),('One size',8)) as s(label, ord)
where c.slug in ('womenswear','menswear')
on conflict do nothing;

insert into sizes (label, category_id, sort_order)
select s.label, c.id, s.ord from categories c,
  (values ('35',1),('36',2),('37',3),('38',4),('39',5),('40',6),('41',7),('42',8),('43',9),('44',10),('45',11))
   as s(label, ord)
where c.slug = 'shoes'
on conflict do nothing;

insert into sizes (label, category_id, sort_order)
select s.label, c.id, s.ord from categories c,
  (values ('Mini',1),('Small',2),('Medium',3),('Large',4),('Oversized',5)) as s(label, ord)
where c.slug = 'bags'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- COLOURS
-- ---------------------------------------------------------------------------
insert into colors (name, hex, sort_order) values
('Black','#101114',1),('White','#ffffff',2),('Cream','#f2ece1',3),('Beige','#d9cbb3',4),
('Tan','#b08150',5),('Brown','#5c4033',6),('Burgundy','#872222',7),('Red','#c0392b',8),
('Pink','#e8b4c0',9),('Orange','#e07b39',10),('Yellow','#e5c454',11),('Green','#4a6741',12),
('Blue','#3b5b7a',13),('Navy','#1f2a44',14),('Purple','#6b4a7a',15),('Grey','#8b8d94',16),
('Silver','#c0c0c8',17),('Gold','#c9a227',18),('Multicolour','#888888',19)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- CONTENT PAGES  (admin-editable; slugs match the existing static pages)
-- ---------------------------------------------------------------------------
insert into content_pages (slug, title, body, status, published_at) values
('about','About us','Replace this from Admin → Content.','published', now()),
('terms','Terms and conditions','Replace this from Admin → Content.','published', now()),
('privacy','Privacy policy','Replace this from Admin → Content.','published', now()),
('cookies','Cookie policy','Replace this from Admin → Content.','published', now()),
('returns','Returns and refunds','Replace this from Admin → Content.','published', now()),
('seller-guidelines','Seller guidelines','Replace this from Admin → Content.','published', now()),
('buyer-protection','Buyer Protection','Replace this from Admin → Content.','published', now()),
('shipping','Pickup and delivery','Replace this from Admin → Content.','published', now()),
('fees','Seller fees','Replace this from Admin → Content.','published', now()),
('authentication','Authentication','Replace this from Admin → Content.','published', now())
on conflict (slug) do nothing;

insert into content_blocks (key, label, value, block_type) values
('homepage_hero_title','Homepage hero title','Buy and sell authenticated pre-owned luxury in Jordan','text'),
('homepage_hero_subtitle','Homepage hero subtitle','Authenticated, protected, and priced by the people who own it.','text'),
('announcement_bar','Announcement bar','Every piece over JOD 350 is authenticated before it reaches you.','text'),
('sell_cta','Sell page call to action','Free to list, and no seller fees on your first three sales.','text'),
('footer_note','Footer note','Jordan''s marketplace for pre-owned luxury.','text')
on conflict (key) do nothing;

insert into faqs (question, answer, category, sort_order) values
('How does authentication work?','Anything priced over JOD 350 is collected and checked by our authenticators in Amman before it goes to the buyer.','authentication',1),
('What does it cost to sell?','Listing is free. We take a 12% commission when the buyer accepts the item.','fees',2),
('How do I get paid?','Once the buyer accepts, your payout is scheduled and sent by bank transfer or CliQ.','payouts',3),
('Can I return something?','Yes, if the item is not as described. Open a return from your order within 48 hours of delivery.','returns',4),
('Which payment methods work?','Visa, Mastercard, CliQ, eFAWATEERcom and cash on delivery.','payments',5)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- BOOTSTRAP YOUR FIRST ADMIN
-- Sign up through the site first, then run this with your own email.
-- ---------------------------------------------------------------------------
-- insert into admin_users (user_id, role_id)
-- select u.id, r.id
-- from auth.users u, admin_roles r
-- where u.email = 'you@yourdomain.com' and r.key = 'super_admin'
-- on conflict (user_id) do update set role_id = excluded.role_id, is_active = true;
