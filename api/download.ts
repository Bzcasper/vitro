import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/supabase';

const BUCKET = 'downloads';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function ensureBucket(name: string) {
  const { data } = await supabase.storage.getBucket(name);
  if (data) return;

  await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ['video/*', 'audio/*', 'application/octet-stream'],
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'POST') {
      const { url, filename, bucket } = req.body as {
        url?: string;
        filename?: string;
        bucket?: string;
      };

      if (!url || !filename) {
        return res.status(400).json({ error: 'Body must include "url" and "filename"' });
      }

      const storageBucket = bucket || BUCKET;
      await ensureBucket(storageBucket);

      // Download the file from the remote URL
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(502).json({ error: `Failed to fetch source URL: ${response.status}` });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'video/mp4';

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(filename, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({ error: 'Upload failed', details: uploadError.message });
      }

      const { data: publicUrlData } = supabase.storage
        .from(storageBucket)
        .getPublicUrl(filename);

      return res.status(200).json({
        ok: true,
        filename,
        bucket: storageBucket,
        url: publicUrlData.publicUrl,
      });
    }

    if (req.method === 'GET') {
      const filename = req.query.filename as string | undefined;
      const bucket = (req.query.bucket as string) || BUCKET;

      if (!filename) {
        // List files in bucket
        const { data, error } = await supabase.storage.from(bucket).list('', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

        if (error) return res.status(500).json({ error: error.message });

        const files = (data || []).map((f) => ({
          name: f.name,
          size: f.metadata?.size,
          type: f.metadata?.mimetype,
          created: f.created_at,
          url: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
        }));

        return res.status(200).json({ bucket, files });
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filename);

      return res.status(200).json({
        filename,
        bucket,
        url: publicUrlData.publicUrl,
      });
    }

    if (req.method === 'DELETE') {
      const filename = req.query.filename as string | undefined;
      const bucket = (req.query.bucket as string) || BUCKET;

      if (!filename) {
        return res.status(400).json({ error: 'Missing "filename" query parameter' });
      }

      const { error } = await supabase.storage.from(bucket).remove([filename]);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ ok: true, deleted: filename });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[download]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
