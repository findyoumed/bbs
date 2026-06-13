const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual parsing of .env to avoid dependency on dotenv package
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const tableName = env.RSS_CACHE_TABLE || 'rss_cache';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase config not found in .env file!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function clearCache() {
  console.log(`Clearing ${tableName} table in Supabase...`);
  const { data, error } = await supabase
    .from(tableName)
    .delete()
    .neq('cache_key', ''); // clears all records
  
  if (error) {
    console.error("Error clearing RSS cache:", error);
  } else {
    console.log("Successfully cleared RSS cache table in Supabase!");
  }
}

clearCache();
