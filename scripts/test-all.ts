/**
 * Comprehensive Vitro health check:
 * 1. Redis connectivity
 * 2. All 11 streaming servers present
 * 3. Sandbox config validation
 * 4. Supabase buckets
 */
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const redisUrl = process.env.REDIS_URL || '';
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';

let passed = 0;
let failed = 0;
const warnings: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function warn(msg: string) {
  console.warn(`  ⚠️  ${msg}`);
  warnings.push(msg);
}

// ─── Test 1: Redis ──────────────────────────────────────────
async function testRedis() {
  console.log('\n🧪 Test: Redis connectivity');

  if (upstashUrl) {
    console.log(`   Using Upstash REST: ${upstashUrl.substring(0, 40)}...`);
    const redis = new Redis({ url: upstashUrl, token: upstashToken });
    try {
      await redis.set('vitro_test', 'hello', { ex: 60 });
      const val = await redis.get('vitro_test');
      assert(val === 'hello', 'Upstash set/get works');
      await redis.del('vitro_test');
      assert(true, 'Upstash del works');
    } catch (err) {
      assert(false, `Upstash connection failed: ${err}`);
    }
  } else if (redisUrl.startsWith('https://')) {
    console.log(`   Using Upstash REST via REDIS_URL`);
    const redis = new Redis({ url: redisUrl, token: redisUrl });
    try {
      await redis.set('vitro_test', 'hello', { ex: 60 });
      const val = await redis.get('vitro_test');
      assert(val === 'hello', 'Redis REST set/get works');
      await redis.del('vitro_test');
    } catch (err) {
      assert(false, `Redis REST failed: ${err}`);
    }
  } else if (redisUrl.startsWith('redis://')) {
    warn(`REDIS_URL is TCP (${redisUrl.substring(0, 50)}...) — @upstash/redis needs HTTPS REST URL`);
    warn('On Vercel serverless, this falls back to in-memory (data lost on cold start)');
    warn('FIX: Create a free Upstash Redis at https://upstash.com and set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN');
    assert(false, 'Redis is NOT persistent — using in-memory fallback');
  } else {
    assert(false, 'No Redis URL configured');
  }
}

// ─── Test 2: Streaming servers ──────────────────────────────
async function testServers() {
  console.log('\n🧪 Test: Streaming servers');

  // Dynamically import the types file
  const fs = await import('fs');
  const typesContent = fs.readFileSync('/home/trapgod/vitro-vercel/src/types/index.ts', 'utf-8');

  const expectedServers = [
    'vidsrc-cc', 'embed-su', 'multiembed', 'vidsrc-icu', 'autoembed',
    'vidsrc-xyz', 'vidsrc-dev', '2embed', 'nontongo', 'moviesapi', 'vidlink'
  ];

  for (const id of expectedServers) {
    assert(typesContent.includes(`id: '${id}'`), `Server "${id}" present in types`);
  }

  assert(expectedServers.length === 11, `Total servers: ${expectedServers.length}`);
}

// ─── Test 3: Sandbox config ─────────────────────────────────
async function testSandbox() {
  console.log('\n🧪 Test: Iframe sandbox config');

  const fs = await import('fs');
  const playerContent = fs.readFileSync('/home/trapgod/vitro-vercel/src/pages/Player.tsx', 'utf-8');
  const mobileContent = fs.readFileSync('/home/trapgod/vitro-vercel/src/components/MobilePlayer.tsx', 'utf-8');

  // Should have allow-popups
  assert(playerContent.includes('allow-popups'), 'Player.tsx: allow-popups present (video servers need it)');
  assert(mobileContent.includes('allow-popups'), 'MobilePlayer.tsx: allow-popups present');

  // Should NOT have allow-popups-to-escape-sandbox
  assert(!playerContent.includes('allow-popups-to-escape-sandbox'), 'Player.tsx: allow-popups-to-escape-sandbox REMOVED (blocks ad popups)');
  assert(!mobileContent.includes('allow-popups-to-escape-sandbox'), 'MobilePlayer.tsx: allow-popups-to-escape-sandbox REMOVED');

  // Should have allow-scripts (players need JS)
  assert(playerContent.includes('allow-scripts'), 'Player.tsx: allow-scripts present');
  assert(mobileContent.includes('allow-scripts'), 'MobilePlayer.tsx: allow-scripts present');

  // Should have allow-same-origin (players need cookies/storage)
  assert(playerContent.includes('allow-same-origin'), 'Player.tsx: allow-same-origin present');
  assert(mobileContent.includes('allow-same-origin'), 'MobilePlayer.tsx: allow-same-origin present');

  // Should have allow-presentation (for casting)
  assert(playerContent.includes('allow-presentation'), 'Player.tsx: allow-presentation present (casting)');

  // Should have autoplay and fullscreen
  assert(playerContent.includes('allow="autoplay'), 'Player.tsx: autoplay allowed');
  assert(playerContent.includes('fullscreen'), 'Player.tsx: fullscreen allowed');
}

// ─── Test 4: Ad blocker ─────────────────────────────────────
async function testAdBlocker() {
  console.log('\n🧪 Test: Ad blocker integration');

  const fs = await import('fs');
  const mainContent = fs.readFileSync('/home/trapgod/vitro-vercel/src/main.tsx', 'utf-8');
  const adBlockerExists = fs.existsSync('/home/trapgod/vitro-vercel/src/lib/adBlocker.ts');

  assert(adBlockerExists, 'adBlocker.ts exists');
  assert(mainContent.includes('initAdBlocker'), 'Ad blocker initialized in main.tsx');

  if (adBlockerExists) {
    const adContent = fs.readFileSync('/home/trapgod/vitro-vercel/src/lib/adBlocker.ts', 'utf-8');
    assert(adContent.includes('window.open'), 'Popup blocker present');
    assert(adContent.includes('MutationObserver'), 'DOM injection blocker present');
    assert(adContent.includes('AD_DOMAINS'), 'Ad domain list present');
  }
}

// ─── Test 5: Supabase buckets ───────────────────────────────
async function testSupabase() {
  console.log('\n🧪 Test: Supabase storage');

  if (!supabaseUrl || !supabaseKey) {
    assert(false, 'Supabase credentials missing');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.storage.listBuckets();

  assert(!error, 'listBuckets succeeds');
  const names = (data || []).map(b => b.name);
  assert(names.includes('downloads'), 'downloads bucket exists');
  assert(names.includes('videos'), 'videos bucket exists');
  assert(names.includes('thumbnails'), 'thumbnails bucket exists');
}

// ─── Test 6: Vercel headers ─────────────────────────────────
async function testVercelConfig() {
  console.log('\n🧪 Test: Vercel security headers');

  const fs = await import('fs');
  const config = fs.readFileSync('/home/trapgod/vitro-vercel/vercel.json', 'utf-8');

  assert(config.includes('Permissions-Policy'), 'Permissions-Policy header configured');
  assert(config.includes('X-Frame-Options'), 'X-Frame-Options header configured');
  assert(config.includes('Referrer-Policy'), 'Referrer-Policy header configured');
}

// ─── Run all ────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Vitro Comprehensive Health Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await testRedis();
  await testServers();
  await testSandbox();
  await testAdBlocker();
  await testSupabase();
  await testVercelConfig();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${warnings.length} warnings`);
  if (warnings.length > 0) {
    console.log('\n  ⚠️  Warnings:');
    for (const w of warnings) console.log(`     → ${w}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
