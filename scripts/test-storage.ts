import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function testBucketsExist() {
  console.log('\n🧪 Test: Buckets exist');
  const { data, error } = await supabase.storage.listBuckets();
  assert(!error, 'listBuckets succeeds');
  const names = (data || []).map((b) => b.name);
  assert(names.includes('downloads'), 'downloads bucket exists');
  assert(names.includes('videos'), 'videos bucket exists');
  assert(names.includes('thumbnails'), 'thumbnails bucket exists');
}

async function testBucketConfig() {
  console.log('\n🧪 Test: Bucket config');
  for (const name of ['downloads', 'videos', 'thumbnails']) {
    const { data, error } = await supabase.storage.getBucket(name);
    assert(!error, `getBucket(${name}) succeeds`);
    assert(data?.public === true, `${name} is public`);
  }
}

async function testUploadDownloadDelete() {
  console.log('\n🧪 Test: Upload → Download → Delete (downloads bucket)');
  const bucket = 'downloads';
  const filename = `_test_${Date.now()}.txt`;
  const content = 'hello vitro test';

  // Upload (bucket allows video/*, audio/*, application/octet-stream)
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(filename, Buffer.from(content), {
      contentType: 'application/octet-stream',
      upsert: true,
    });
  assert(!uploadErr, `upload ${filename}`);

  // Get public URL
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
  assert(!!urlData?.publicUrl, 'publicUrl returned');

  // Download via public URL
  const res = await fetch(urlData.publicUrl);
  assert(res.ok, `fetch public URL (${res.status})`);
  const body = await res.text();
  assert(body === content, 'downloaded content matches');

  // List and find file
  const { data: listData } = await supabase.storage.from(bucket).list('', { limit: 100 });
  const found = (listData || []).some((f) => f.name === filename);
  assert(found, 'file appears in list');

  // Delete
  const { error: delErr } = await supabase.storage.from(bucket).remove([filename]);
  assert(!delErr, `delete ${filename}`);

  // Verify deleted
  const { data: afterDel } = await supabase.storage.from(bucket).list('', { limit: 100 });
  const stillThere = (afterDel || []).some((f) => f.name === filename);
  assert(!stillThere, 'file removed from list');
}

async function testVideosBucket() {
  console.log('\n🧪 Test: Upload → Delete (videos bucket)');
  const bucket = 'videos';
  const filename = `_test_${Date.now()}.mp4`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(filename, Buffer.from('fake-video-data'), {
      contentType: 'video/mp4',
      upsert: true,
    });
  assert(!upErr, `upload to videos`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
  assert(urlData?.publicUrl?.includes(filename), 'videos publicUrl correct');

  const { error: delErr } = await supabase.storage.from(bucket).remove([filename]);
  assert(!delErr, 'cleanup videos test file');
}

async function testThumbnailsBucket() {
  console.log('\n🧪 Test: Upload → Delete (thumbnails bucket)');
  const bucket = 'thumbnails';
  const filename = `_test_${Date.now()}.png`;

  // 1x1 transparent PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(filename, png, { contentType: 'image/png', upsert: true });
  assert(!upErr, 'upload to thumbnails');

  const { error: delErr } = await supabase.storage.from(bucket).remove([filename]);
  assert(!delErr, 'cleanup thumbnails test file');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Vitro Supabase Storage Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await testBucketsExist();
  await testBucketConfig();
  await testUploadDownloadDelete();
  await testVideosBucket();
  await testThumbnailsBucket();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
