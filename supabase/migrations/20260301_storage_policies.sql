-- ============================================
-- Vitro Storage Buckets & RLS Policies
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Create buckets (if not exists, handled by API)
-- Buckets are created via /api/setup-storage POST

-- 2. Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VIDEOS BUCKET POLICIES
-- ============================================

-- Public read: anyone can view/download videos
CREATE POLICY IF NOT EXISTS "videos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Service role insert: API can upload videos
CREATE POLICY IF NOT EXISTS "videos_service_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Service role update: API can upsert videos
CREATE POLICY IF NOT EXISTS "videos_service_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'videos');

-- Service role delete: API can remove videos
CREATE POLICY IF NOT EXISTS "videos_service_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos');

-- ============================================
-- THUMBNAILS BUCKET POLICIES
-- ============================================

-- Public read: anyone can view thumbnails
CREATE POLICY IF NOT EXISTS "thumbnails_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

-- Service role insert
CREATE POLICY IF NOT EXISTS "thumbnails_service_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails');

-- Service role update
CREATE POLICY IF NOT EXISTS "thumbnails_service_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails');

-- Service role delete
CREATE POLICY IF NOT EXISTS "thumbnails_service_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thumbnails');
