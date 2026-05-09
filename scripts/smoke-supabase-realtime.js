'use strict';

const path = require('path');
const { loadEnv, resolvePublishableKey } = require('./lib/scriptUtils');
const { runRealtimeProbe } = require('./lib/supabaseRealtime');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  loadEnv(path.join(rootDir, '.env'));

  const publishableKey = resolvePublishableKey(rootDir);
  if (!process.env.SUPABASE_URL || !publishableKey) {
    throw new Error('SUPABASE_URL or publishable key is missing');
  }

  const report = await runRealtimeProbe({
    url: process.env.SUPABASE_URL,
    key: publishableKey,
    channelPrefix: 'smoke-realtime'
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  if (error && error.realtime) {
    console.error(JSON.stringify({
      ok: false,
      message: error.message,
      realtime: error.realtime
    }, null, 2));
  } else {
  console.error(error);
  }
  process.exit(1);
});
