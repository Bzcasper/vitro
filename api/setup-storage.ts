import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/supabase';

const BUCKETS = [
  {
    name: 'videos',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024 * 1024, // 5GB
    allowedMimeTypes: ['video/*', 'application/octet-stream'],
  },
  {
    name: 'thumbnails',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/*'],
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: check bucket status
  if (req.method === 'GET') {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      buckets: data.map((b) => ({ id: b.id, name: b.name, public: b.public })),
    });
  }

  // POST: create/update buckets
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const results: Record<string, { status: string; error?: string }> = {};

  for (const bucket of BUCKETS) {
    // Try to create
    const { error: createError } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (createError) {
      if (createError.message.includes('already exists')) {
        // Update existing bucket settings
        const { error: updateError } = await supabase.storage.updateBucket(bucket.name, {
          public: bucket.public,
          fileSizeLimit: bucket.fileSizeLimit,
          allowedMimeTypes: bucket.allowedMimeTypes,
        });

        results[bucket.name] = updateError
          ? { status: 'update_failed', error: updateError.message }
          : { status: 'updated' };
      } else {
        results[bucket.name] = { status: 'create_failed', error: createError.message };
      }
    } else {
      results[bucket.name] = { status: 'created' };
    }
  }

  // Set CORS on Supabase storage via management API
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];

  let corsStatus = 'skipped';
  if (projectRef) {
    try {
      // Update storage CORS via Supabase Management API isn't available via REST
      // CORS for storage is configured at the project level in Supabase dashboard
      // But public buckets serve files via CDN which allows all origins by default
      corsStatus = 'public_buckets_serve_via_cdn_cors_not_needed';
    } catch {
      corsStatus = 'cors_config_skipped';
    }
  }

  return res.status(200).json({
    ok: true,
    buckets: results,
    cors: corsStatus,
    note: 'Public buckets serve files via Supabase CDN with permissive CORS. For RLS policies, run the SQL migration in supabase/migrations/storage-policies.sql via Supabase Dashboard > SQL Editor.',
  });
}
