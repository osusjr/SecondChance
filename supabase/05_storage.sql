-- ============================================================================
-- SecondChance Collective — Storage buckets & policies
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true,  10485760, array['image/jpeg','image/png','image/webp','image/avif']),
  ('avatars',        'avatars',        true,   2097152, array['image/jpeg','image/png','image/webp']),
  ('banners',        'banners',        true,   5242880, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('kyc-documents',  'kyc-documents',  false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('auth-evidence',  'auth-evidence',  false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('dispute-files',  'dispute-files',  false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- Path convention: listing-photos/{user_id}/{listing_id}/{slot}.jpg
-- The first folder segment is always the owner's uid, which is what these
-- policies check against.

create policy "listing photos public read" on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "listing photos owner write" on storage.objects for insert
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "listing photos owner update" on storage.objects for update
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "listing photos owner delete" on storage.objects for delete
  using (bucket_id = 'listing-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text or has_perm('listings.moderate')));

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "banners public read" on storage.objects for select using (bucket_id = 'banners');
create policy "banners admin write" on storage.objects for all
  using (bucket_id = 'banners' and has_perm('content.manage'))
  with check (bucket_id = 'banners' and has_perm('content.manage'));

-- KYC is private: the owner may upload, only verification staff may read
create policy "kyc owner upload" on storage.objects for insert
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kyc owner read" on storage.objects for select
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kyc admin read" on storage.objects for select
  using (bucket_id = 'kyc-documents' and has_perm('users.approve_sellers'));

create policy "auth evidence staff" on storage.objects for all
  using (bucket_id = 'auth-evidence' and has_perm('listings.authenticate'))
  with check (bucket_id = 'auth-evidence' and has_perm('listings.authenticate'));

create policy "dispute files party" on storage.objects for insert
  with check (bucket_id = 'dispute-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dispute files read" on storage.objects for select
  using (bucket_id = 'dispute-files'
         and ((storage.foldername(name))[1] = auth.uid()::text or has_perm('orders.disputes')));
