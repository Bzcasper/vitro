import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from './lib/redis';

const TTL_SECONDS = 24 * 60 * 60; // 24 hours

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
    if (req.method === 'GET') {
      const key = req.query.key as string | undefined;
      if (!key) {
        return res.status(400).json({ error: 'Missing "key" query parameter' });
      }

      const servers = await redis.hgetall(`stream:${key}`);
      if (!servers || Object.keys(servers).length === 0) {
        return res.status(404).json({ error: 'No cached streams found', key });
      }

      return res.status(200).json({ key, servers });
    }

    if (req.method === 'POST') {
      const { key, servers } = req.body as {
        key?: string;
        servers?: Record<string, string>;
      };

      if (!key || !servers || typeof servers !== 'object') {
        return res.status(400).json({ error: 'Body must include "key" and "servers" object' });
      }

      await redis.hset(`stream:${key}`, servers);
      await redis.expire(`stream:${key}`, TTL_SECONDS);

      return res.status(200).json({ ok: true, key, cached: Object.keys(servers).length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[stream-cache]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
