import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from './lib/redis';

interface ProgressEntry {
  id: string;
  type: string;
  season?: number;
  episode?: number;
  episodeName?: string;
  timestamp?: number;
  updatedAt: string;
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const userId = (req.query.userId as string) || 'default';
      const data = await redis.hgetall<Record<string, string>>(`progress:${userId}`);

      if (!data || Object.keys(data).length === 0) {
        return res.status(200).json({ userId, progress: [] });
      }

      const progress = Object.values(data).map((v) => {
        try { return JSON.parse(v as string); } catch { return v; }
      });

      return res.status(200).json({ userId, progress });
    }

    if (req.method === 'POST') {
      const { userId = 'default', progress } = req.body as {
        userId?: string;
        progress?: ProgressEntry;
      };

      if (!progress || !progress.id || !progress.type) {
        return res.status(400).json({ error: 'Body must include "progress" with "id" and "type"' });
      }

      const field = `${progress.type}:${progress.id}`;
      const entry: ProgressEntry = { ...progress, updatedAt: new Date().toISOString() };

      await redis.hset(`progress:${userId}`, { [field]: JSON.stringify(entry) });

      return res.status(200).json({ ok: true, userId, field });
    }

    if (req.method === 'DELETE') {
      const userId = (req.query.userId as string) || 'default';
      const id = req.query.id as string | undefined;
      const type = req.query.type as string | undefined;

      if (!id || !type) {
        return res.status(400).json({ error: 'Missing "id" and "type" query parameters' });
      }

      const field = `${type}:${id}`;
      await redis.hdel(`progress:${userId}`, field);

      return res.status(200).json({ ok: true, userId, deleted: field });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[progress]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
