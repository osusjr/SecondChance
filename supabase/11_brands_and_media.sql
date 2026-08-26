-- ============================================================================
-- SecondChance Collective — 11: typed brands, ten photos and a video
--
-- What this adds:
--   1. listings.custom_brand — sellers can type a brand that is not in the
--      dropdown; it is stored as text until an admin promotes it to a real
--      brand row in the taxonomy.
--   2. The full brand list for the dropdown — high street to couture,
--      streetwear, modest fashion and kids (175 more rows).
--   3. listing_images accepts a 'video' slot, and the listing-photos bucket
--      accepts video files up to 50 MB (photos stay capped by the client).
--   4. Typed brands and known brand names become text-searchable.
--
-- Safe to run more than once. Run it after 01-10.
-- ============================================================================

begin;

-- --- 1. the typed-brand column --------------------------------------------
alter table listings add column if not exists custom_brand text
  check (custom_brand is null or char_length(custom_brand) <= 80);

-- --- 2. the full brand list for the dropdown -------------------------------
insert into brands (slug, name, tier, requires_auth, sort_order) values
('louis-vuitton','Louis Vuitton','ultra',true,17),
('goyard','Goyard','ultra',true,18),
('moynat','Moynat','ultra',true,19),
('patek-philippe','Patek Philippe','ultra',true,20),
('audemars-piguet','Audemars Piguet','ultra',true,21),
('van-cleef-arpels','Van Cleef & Arpels','ultra',true,22),
('dior','Dior','luxury',true,23),
('gucci','Gucci','luxury',true,24),
('fendi','Fendi','luxury',true,25),
('balenciaga','Balenciaga','luxury',true,26),
('valentino','Valentino','luxury',true,27),
('givenchy','Givenchy','luxury',true,28),
('burberry','Burberry','luxury',true,29),
('versace','Versace','luxury',true,30),
('dolce-gabbana','Dolce & Gabbana','luxury',true,31),
('balmain','Balmain','luxury',true,32),
('alexander-mcqueen','Alexander McQueen','luxury',true,33),
('bulgari','Bulgari','luxury',true,34),
('tiffany-co','Tiffany & Co.','luxury',true,35),
('omega','Omega','luxury',true,36),
('chloe','Chloé','luxury',true,37),
('brunello-cucinelli','Brunello Cucinelli','luxury',true,38),
('zegna','Zegna','luxury',true,39),
('tom-ford','Tom Ford','luxury',true,40),
('moncler','Moncler','luxury',true,41),
('stella-mccartney','Stella McCartney','luxury',true,42),
('elie-saab','Elie Saab','luxury',true,43),
('zuhair-murad','Zuhair Murad','luxury',true,44),
('rami-kadi','Rami Kadi','luxury',true,45),
('azzi-osta','Azzi & Osta','luxury',true,46),
('alaia','Alaïa','luxury',true,47),
('comme-des-garcons','Comme des Garçons','luxury',true,48),
('jean-paul-gaultier','Jean Paul Gaultier','luxury',true,49),
('mugler','Mugler','luxury',true,50),
('courreges','Courrèges','luxury',true,51),
('marine-serre','Marine Serre','luxury',true,52),
('coperni','Coperni','luxury',true,53),
('the-attico','The Attico','luxury',true,54),
('zimmermann','Zimmermann','luxury',true,55),
('christopher-esber','Christopher Esber','luxury',true,56),
('david-koma','David Koma','luxury',true,57),
('mulberry','Mulberry','premium',false,58),
('max-mara','Max Mara','premium',false,59),
('ferragamo','Ferragamo','premium',false,60),
('christian-louboutin','Christian Louboutin','premium',false,61),
('jimmy-choo','Jimmy Choo','premium',false,62),
('manolo-blahnik','Manolo Blahnik','premium',false,63),
('gianvito-rossi','Gianvito Rossi','premium',false,64),
('roger-vivier','Roger Vivier','premium',false,65),
('tag-heuer','TAG Heuer','premium',false,66),
('sandro','Sandro','premium',false,67),
('maje','Maje','premium',false,68),
('claudie-pierlot','Claudie Pierlot','premium',false,69),
('sezane','Sézane','premium',false,70),
('reiss','Reiss','premium',false,71),
('allsaints','AllSaints','premium',false,72),
('ted-baker','Ted Baker','premium',false,73),
('zadig-voltaire','Zadig & Voltaire','premium',false,74),
('ba-sh','ba&sh','premium',false,75),
('ralph-lauren','Ralph Lauren','premium',false,76),
('marc-jacobs','Marc Jacobs','premium',false,77),
('kate-spade','Kate Spade','premium',false,78),
('coach','Coach','premium',false,79),
('furla','Furla','premium',false,80),
('tory-burch','Tory Burch','premium',false,81),
('michael-kors','Michael Kors','premium',false,82),
('kurt-geiger','Kurt Geiger','premium',false,83),
('by-far','By Far','premium',false,84),
('demellier','DeMellier','premium',false,85),
('strathberry','Strathberry','premium',false,86),
('golden-goose','Golden Goose','premium',false,87),
('axel-arigato','Axel Arigato','premium',false,88),
('fear-of-god','Fear of God','premium',false,89),
('palm-angels','Palm Angels','premium',false,90),
('stone-island','Stone Island','premium',false,91),
('supreme','Supreme','premium',false,92),
('kith','Kith','premium',false,93),
('self-portrait','Self-Portrait','premium',false,94),
('aje','Aje','premium',false,95),
('nadine-merabi','Nadine Merabi','premium',false,96),
('solace-london','Solace London','premium',false,97),
('retrofete','Retrofête','premium',false,98),
('hugo-boss','HUGO BOSS','premium',false,99),
('dkny','DKNY','premium',false,100),
('longchamp','Longchamp','premium',false,101),
('cult-gaia','Cult Gaia','premium',false,102),
('isabel-marant','Isabel Marant','contemporary',false,103),
('acne-studios','Acne Studios','contemporary',false,104),
('ganni','Ganni','contemporary',false,105),
('staud','Staud','contemporary',false,106),
('mansur-gavriel','Mansur Gavriel','contemporary',false,107),
('polene','Polène','contemporary',false,108),
('aquazzura','Aquazzura','contemporary',false,109),
('amina-muaddi','Amina Muaddi','contemporary',false,110),
('off-white','Off-White','contemporary',false,111),
('arket','Arket','contemporary',false,112),
('reformation','Reformation','contemporary',false,113),
('free-people','Free People','contemporary',false,114),
('anthropologie','Anthropologie','contemporary',false,115),
('lululemon','Lululemon','contemporary',false,116),
('alo-yoga','Alo Yoga','contemporary',false,117),
('nike','Nike','contemporary',false,118),
('adidas','Adidas','contemporary',false,119),
('new-balance','New Balance','contemporary',false,120),
('veja','Veja','contemporary',false,121),
('jordan','Jordan','contemporary',false,122),
('converse','Converse','contemporary',false,123),
('vans','Vans','contemporary',false,124),
('on','On','contemporary',false,125),
('salomon','Salomon','contemporary',false,126),
('asics','ASICS','contemporary',false,127),
('puma','Puma','contemporary',false,128),
('reebok','Reebok','contemporary',false,129),
('yeezy','Yeezy','contemporary',false,130),
('essentials','Essentials','contemporary',false,131),
('stussy','Stüssy','contemporary',false,132),
('french-connection','French Connection','contemporary',false,133),
('lacoste','Lacoste','contemporary',false,134),
('calvin-klein','Calvin Klein','contemporary',false,135),
('tommy-hilfiger','Tommy Hilfiger','contemporary',false,136),
('rat-boa','Rat & Boa','contemporary',false,137),
('house-of-cb','House of CB','contemporary',false,138),
('meshki','Meshki','contemporary',false,139),
('oh-polly','Oh Polly','contemporary',false,140),
('bec-bridge','Bec + Bridge','contemporary',false,141),
('faithfull-the-brand','Faithfull the Brand','contemporary',false,142),
('charles-keith','Charles & Keith','contemporary',false,143),
('pedro','Pedro','contemporary',false,144),
('jw-pei','JW PEI','contemporary',false,145),
('baggu','Baggu','contemporary',false,146),
('aldo','ALDO','contemporary',false,147),
('leem','Leem','contemporary',false,148),
('shukr','SHUKR','contemporary',false,149),
('aab','Aab','contemporary',false,150),
('inayah','Inayah','contemporary',false,151),
('haute-hijab','Haute Hijab','contemporary',false,152),
('aritzia','Aritzia','contemporary',false,153),
('guess','Guess','contemporary',false,154),
('superdry','Superdry','contemporary',false,155),
('levi-s','Levi''s','contemporary',false,156),
('tommy-jeans','Tommy Jeans','contemporary',false,157),
('gap','GAP','contemporary',false,158),
('zara','Zara','contemporary',false,159),
('bershka','Bershka','contemporary',false,160),
('pull-bear','Pull&Bear','contemporary',false,161),
('stradivarius','Stradivarius','contemporary',false,162),
('massimo-dutti','Massimo Dutti','contemporary',false,163),
('oysho','Oysho','contemporary',false,164),
('mango','Mango','contemporary',false,165),
('h-m','H&M','contemporary',false,166),
('cos','COS','contemporary',false,167),
('uniqlo','Uniqlo','contemporary',false,168),
('reserved','Reserved','contemporary',false,169),
('river-island','River Island','contemporary',false,170),
('new-look','New Look','contemporary',false,171),
('topshop','Topshop','contemporary',false,172),
('urban-outfitters','Urban Outfitters','contemporary',false,173),
('american-eagle','American Eagle','contemporary',false,174),
('abercrombie-fitch','Abercrombie & Fitch','contemporary',false,175),
('hollister','Hollister','contemporary',false,176),
('forever-21','Forever 21','contemporary',false,177),
('asos','ASOS','contemporary',false,178),
('prettylittlething','PrettyLittleThing','contemporary',false,179),
('zara-kids','Zara Kids','contemporary',false,180),
('h-m-kids','H&M Kids','contemporary',false,181),
('mango-kids','Mango Kids','contemporary',false,182),
('ralph-lauren-kids','Ralph Lauren Kids','contemporary',false,183),
('tommy-hilfiger-kids','Tommy Hilfiger Kids','contemporary',false,184),
('jacadi','Jacadi','contemporary',false,185),
('petit-bateau','Petit Bateau','contemporary',false,186),
('bonpoint','Bonpoint','contemporary',false,187),
('baby-dior','Baby Dior','contemporary',false,188),
('burberry-kids','Burberry Kids','contemporary',false,189),
('gucci-kids','Gucci Kids','contemporary',false,190),
('moncler-kids','Moncler Kids','contemporary',false,191)
on conflict (slug) do nothing;

-- --- 3. a video slot on listing media --------------------------------------
alter table listing_images drop constraint if exists listing_images_slot_check;
alter table listing_images add constraint listing_images_slot_check
  check (slot in ('front','back','detail','label','extra','video'));

-- One video per listing, enforced by the schema (the client sends one).
create unique index if not exists uq_listing_video
  on listing_images (listing_id) where slot = 'video';

-- The bucket was created by the dashboard / 05_storage.sql with image mime
-- types and a 10 MB cap; this widens it for one short video per listing.
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/avif',
         'video/mp4','video/quicktime','video/webm'],
       file_size_limit = 52428800   -- 50 MB
 where id = 'listing-photos';

-- --- 4. typed and known brands join the search vector ----------------------
create or replace function listing_before_save() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare threshold numeric;
begin
  new.search_vector :=
      setweight(to_tsvector('simple', coalesce(new.title,'')), 'A')
   || setweight(to_tsvector('simple',
        coalesce(new.custom_brand,'') || ' ' ||
        coalesce((select b.name from brands b where b.id = new.brand_id), '')), 'B')
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

-- Rebuild the search vector on existing listings so brand names are
-- searchable there too (the no-op update fires the trigger above).
update listings set id = id;

commit;

-- ============================================================================
-- Check it worked:
--
--   select count(*) from brands;                          -- should be 191
--   select conname from pg_constraint
--    where conname = 'listing_images_slot_check';         -- exists
--   select allowed_mime_types, file_size_limit
--     from storage.buckets where id = 'listing-photos';   -- includes video/mp4
-- ============================================================================
