const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('rss_cache')
      .select('*')
      .eq('cache_key', 'rss:feed:news:topicfeed:v12:1');

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log("Found cached rows:", data.length);
    if (data.length > 0) {
      const parsed = data[0].value; // Value might be JSON string or object
      const val = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      console.log("Cached items count:", val?.items?.length);
      console.log("Cached freshUntil:", new Date(val?.freshUntil).toISOString());
      console.log("Now:", new Date().toISOString());
    } else {
      console.log("No cache found for key 'rss:feed:news:topicfeed:v12:1'");
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}
run();
