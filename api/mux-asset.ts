import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mux } from './lib/mux';
import { redis } from './lib/redis';

interface MuxAssetInfo {
  assetId: string;
  playbackId: string | null;
  status: string;
  title?: string;
  mediaId: string;
  mediaType: string;
  createdAt: string;
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'POST') {
      const { url, title, mediaId, mediaType } = req.body as {
        url?: string;
        title?: string;
        mediaId?: string;
        mediaType?: string;
      };

      if (!url || !mediaId || !mediaType) {
        return res.status(400).json({ error: 'Body must include "url", "mediaId", and "mediaType"' });
      }

      const asset = await mux.video.assets.create({
        inputs: [{ url }],
        playback_policies: ['public'],
      });

      const playbackId = asset.playback_ids?.[0]?.id ?? null;

      const info: MuxAssetInfo = {
        assetId: asset.id,
        playbackId,
        status: asset.status,
        title,
        mediaId,
        mediaType,
        createdAt: new Date().toISOString(),
      };

      const redisKey = `mux:${mediaType}:${mediaId}`;
      await redis.set(redisKey, JSON.stringify(info));

      return res.status(200).json(info);
    }

    if (req.method === 'GET') {
      const mediaId = req.query.mediaId as string | undefined;
      const mediaType = req.query.mediaType as string | undefined;

      if (!mediaId || !mediaType) {
        return res.status(400).json({ error: 'Missing "mediaId" and "mediaType" query parameters' });
      }

      const redisKey = `mux:${mediaType}:${mediaId}`;
      const cached = await redis.get<string>(redisKey);

      if (!cached) {
        return res.status(404).json({ error: 'No Mux asset found', mediaId, mediaType });
      }

      const info: MuxAssetInfo = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.status(200).json(info);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[mux-asset]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
