import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const BUCKETS = [
  {
    name: 'downloads',
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['video/*', 'audio/*', 'application/octet-stream'],
  },
  {
    name: 'videos',
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['video/*', 'application/octet-stream'],
  },
  {
    name: 'thumbnails',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/*'],
  },
];

async function main() {
  console.log(`🔗 Supabase: ${supabaseUrl}\n`);

  for (const bucket of BUCKETS) {
    const { error: createError } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (createError) {
      if (createError.message.includes('already exists')) {
        const { error: updateError } = await supabase.storage.updateBucket(bucket.name, {
          public: bucket.public,
          fileSizeLimit: bucket.fileSizeLimit,
          allowedMimeTypes: bucket.allowedMimeTypes,
        });
        if (updateError) {
          console.error(`❌ ${bucket.name}: update failed – ${updateError.message}`);
        } else {
          console.log(`✅ ${bucket.name}: already exists, settings updated`);
        }
      } else {
        console.error(`❌ ${bucket.name}: ${createError.message}`);
      }
    } else {
      console.log(`✅ ${bucket.name}: created`);
    }
  }

  // Verify
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('\n❌ Failed to list buckets:', error.message);
  } else {
    console.log('\n📦 All buckets:');
    for (const b of data) {
      console.log(`   • ${b.name} (public: ${b.public})`);
    }
  }
}

main().catch(console.error);
