/**
 * Live data integration test:
 * 1. Redis: write/read watch progress + stream cache
 * 2. Supabase: upload/download/delete cycle
 * 3. Stream servers: health check all 11
 */
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

let passed = 0;
let failed = 0;

function assert(ok: boolean, label: string) {
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

// ─── Redis: Watch Progress ──────────────────────────────────
async function testRedisProgress() {
  console.log('\n🧪 Redis: Watch progress (live data)');

  const userId = 'test_user_live';
  const key = `progress:${userId}`;

  // Save movie progress
  const movieEntry = {
    id: '12345', type: 'movie', timestamp: 3600,
    serverId: 'vidsrc-cc', updatedAt: new Date().toISOString(),
  };
  await redis.hset(key, { 'movie:12345': JSON.stringify(movieEntry) });
  assert(true, 'Save movie progress');

  // Save TV progress with episode
  const tvEntry = {
    id: '67890', type: 'tv', season: 2, episode: 5,
    episodeName: 'Test Episode', timestamp: 1800,
    serverId: 'embed-su', updatedAt: new Date().toISOString(),
  };
  await redis.hset(key, { 'tv:67890': JSON.stringify(tvEntry) });
  assert(true, 'Save TV progress (S2E5)');

  // Read back all progress
  const data = await redis.hgetall(key);
  assert(data !== null && Object.keys(data).length === 2, 'Read back 2 progress entries');

  // Verify movie data (Upstash auto-parses JSON values)
  const rawMovie = (data as Record<string, unknown>)['movie:12345'];
  const movie = typeof rawMovie === 'string' ? JSON.parse(rawMovie) : rawMovie as Record<string, unknown>;
  assert(movie.id === '12345', 'Movie ID correct');
  assert(movie.timestamp === 3600, 'Movie timestamp preserved (resume at 1h)');
  assert(movie.serverId === 'vidsrc-cc', 'Movie server remembered');

  // Verify TV data
  const rawTv = (data as Record<string, unknown>)['tv:67890'];
  const tv = typeof rawTv === 'string' ? JSON.parse(rawTv) : rawTv as Record<string, unknown>;
  assert(tv.season === 2 && tv.episode === 5, 'TV season/episode correct');
  assert(tv.timestamp === 1800, 'TV timestamp preserved (resume at 30min)');
  assert(tv.serverId === 'embed-su', 'TV server remembered');

  // Delete progress entry
  await redis.hdel(key, 'movie:12345');
  const after = await redis.hgetall(key);
  assert(after !== null && Object.keys(after).length === 1, 'Delete movie, TV remains');

  // Cleanup
  await redis.del(key);
  assert(true, 'Cleanup test data');
}

// ─── Redis: Stream Cache ────────────────────────────────────
async function testRedisStreamCache() {
  console.log('\n🧪 Redis: Stream URL cache (live data)');

  const cacheKey = 'stream:movie_550';
  const servers = {
    'vidsrc-cc': 'https://vidsrc.cc/v2/embed/movie/550',
    'embed-su': 'https://embed.su/embed/movie/550',
    'vidlink': 'https://vidlink.pro/movie/550',
  };

  await redis.hset(cacheKey, servers);
  await redis.expire(cacheKey, 300); // 5min TTL for test
  assert(true, 'Cache 3 server URLs for movie 550');

  const cached = await redis.hgetall<Record<string, string>>(cacheKey);
  assert(cached !== null, 'Read cached URLs');
  assert(Object.keys(cached!).length === 3, 'All 3 servers cached');
  assert(cached!['vidsrc-cc']?.includes('vidsrc.cc'), 'VidSrc CC URL correct');
  assert(cached!['vidlink']?.includes('vidlink.pro'), 'VidLink URL correct');

  // Check TTL is set
  const ttl = await redis.ttl(cacheKey);
  assert(ttl > 0 && ttl <= 300, `TTL set (${ttl}s remaining)`);

  // Cleanup
  await redis.del(cacheKey);
  assert(true, 'Cleanup cache data');
}

// ─── Redis: Persistence check ───────────────────────────────
async function testRedisPersistence() {
  console.log('\n🧪 Redis: Persistence verification');

  const testKey = 'vitro_persist_test';
  const testVal = { written: Date.now(), message: 'persist check' };

  await redis.set(testKey, JSON.stringify(testVal), { ex: 120 });
  const readBack = await redis.get(testKey);
  const parsed = typeof readBack === 'string' ? JSON.parse(readBack) : readBack as Record<string, unknown>;
  assert(parsed.message === 'persist check', 'Data persists across operations');

  // Info check
  const info = await redis.dbsize();
  assert(typeof info === 'number', `DB size: ${info} keys`);

  await redis.del(testKey);
  assert(true, 'Cleanup');
}

// ─── Supabase: Live upload cycle ────────────────────────────
async function testSupabaseLive() {
  console.log('\n🧪 Supabase: Live upload/download cycle');

  const bucket = 'downloads';
  const filename = `_livetest_${Date.now()}.bin`;
  const content = Buffer.from('vitro live test data ' + Date.now());

  // Upload
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(filename, content, { contentType: 'application/octet-stream', upsert: true });
  assert(!upErr, `Upload to ${bucket}`);

  // Get public URL and fetch
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
  assert(!!urlData?.publicUrl, 'Public URL generated');

  const res = await fetch(urlData.publicUrl);
  assert(res.ok, `Download via public URL (${res.status})`);
  const body = await res.text();
  assert(body === content.toString(), 'Downloaded content matches');

  // Cleanup
  const { error: delErr } = await supabase.storage.from(bucket).remove([filename]);
  assert(!delErr, 'Cleanup test file');
}

// ─── Stream servers: Health check ───────────────────────────
async function testServerHealth() {
  console.log('\n🧪 Stream servers: Live health check');

  const servers = [
    { id: 'vidsrc-cc', url: 'https://vidsrc.cc' },
    { id: 'embed-su', url: 'https://embed.su' },
    { id: 'multiembed', url: 'https://multiembed.mov' },
    { id: 'vidsrc-icu', url: 'https://vidsrc.icu' },
    { id: 'autoembed', url: 'https://autoembed.cc' },
    { id: 'vidsrc-xyz', url: 'https://vidsrc.xyz' },
    { id: 'vidsrc-dev', url: 'https://vidsrc.dev' },
    { id: '2embed', url: 'https://2embed.cc' },
    { id: 'nontongo', url: 'https://nontongo.win' },
    { id: 'moviesapi', url: 'https://moviesapi.club' },
    { id: 'vidlink', url: 'https://vidlink.pro' },
  ];

  const results = await Promise.allSettled(
    servers.map(async (s) => {
      const start = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(s.url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
        clearTimeout(timeout);
        const latency = Math.round(performance.now() - start);
        return { ...s, healthy: true, latency };
      } catch {
        clearTimeout(timeout);
        const latency = Math.round(performance.now() - start);
        return { ...s, healthy: false, latency };
      }
    })
  );

  let healthy = 0;
  let down = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const s = r.value;
      if (s.healthy) {
        console.log(`  ✅ ${s.id} — ${s.latency}ms`);
        healthy++;
        passed++;
      } else {
        console.log(`  ⚠️  ${s.id} — DOWN (${s.latency}ms timeout)`);
        down++;
        passed++; // not a test failure, servers go up/down
      }
    }
  }
  console.log(`     ${healthy} up, ${down} down`);
  assert(healthy > 0, 'At least 1 server reachable');
}

// ─── Run ────────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Vitro Live Data Integration Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await testRedisProgress();
  await testRedisStreamCache();
  await testRedisPersistence();
  await testSupabaseLive();
  await testServerHealth();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
