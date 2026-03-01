import { Redis } from '@upstash/redis';

function createRedisClient() {
  const url = process.env.REDIS_URL || '';
  const token = process.env.REDIS_TOKEN || '';

  // Upstash REST URL — use directly
  if (url.startsWith('https://')) {
    return new Redis({ url, token: token || url.split('@').pop()?.split('/')[0] || '' });
  }

  // If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set (Vercel integration)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
  }

  // Fallback: in-memory store for local dev
  console.warn('[redis] No Upstash REST URL detected — using in-memory fallback');
  const store = new Map<string, string>();

  return {
    async get<T = string>(key: string): Promise<T | null> {
      const v = store.get(key);
      if (v === undefined) return null;
      try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
    },
    async set(key: string, value: unknown, opts?: { ex?: number }) {
      void opts;
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      return 'OK';
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
    async hset(key: string, fields: Record<string, unknown>) {
      const existing = store.get(key);
      const hash: Record<string, string> = existing ? JSON.parse(existing) : {};
      for (const [f, v] of Object.entries(fields)) {
        hash[f] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      store.set(key, JSON.stringify(hash));
      return Object.keys(fields).length;
    },
    async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
      const v = store.get(key);
      if (!v) return null;
      return JSON.parse(v) as T;
    },
    async hdel(key: string, ...fields: string[]) {
      const v = store.get(key);
      if (!v) return 0;
      const hash: Record<string, string> = JSON.parse(v);
      let count = 0;
      for (const f of fields) {
        if (f in hash) { delete hash[f]; count++; }
      }
      store.set(key, JSON.stringify(hash));
      return count;
    },
    async expire(_key: string, _seconds: number) {
      return 1;
    },
  } as unknown as Redis;
}

export const redis = createRedisClient();
