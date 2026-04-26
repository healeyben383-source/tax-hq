-- Tax HQ — private storage bucket for invoices / receipts / statements.
--
-- Layout: {owner_id}/{tax_year_start}/{provider_slug}/{yyyy-mm}_{document_id}.{ext}
--
-- The first path segment is always the owner's auth.uid(). The policies
-- below enforce that at the storage layer as defense-in-depth alongside
-- the documents.owner_id check at the DB layer.
--
-- TODO(signed-urls): files are never served via public URLs. A server
--   handler will mint short-lived signed URLs after verifying the caller
--   owns the backing documents row.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- storage.objects policies (RLS is already enabled by Supabase).
-- Match on bucket_id and require first path segment == auth.uid().
-- ---------------------------------------------------------------------------
create policy "documents owners can select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents owners can insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents owners can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents owners can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
