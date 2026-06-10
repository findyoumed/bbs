'use strict';

const path = require('path');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

// Load environment variables
loadEnvFile(path.join(__dirname, '../.env'), process.env);

async function run() {
  const store = createRssCacheStoreFromEnv(process.env);
  if (!store) {
    console.error('Could not create cache store from environment!');
    return;
  }

  console.log('Connecting to cache store...');
  // Let's retrieve all cache keys in the table or search for keys containing 'news'
  const { data, error } = await store.client
    .from(store.table)
    .select('cache_key, expires_at, updated_at');

  if (error) {
    console.error('Failed to list cache keys:', error);
    return;
  }

  console.log(`Found ${data.length} cache entries in db table "${store.table}":`);
  data.forEach((row) => {
    console.log(`Key: "${row.cache_key}", Expires At: ${row.expires_at}, Updated At: ${row.updated_at}`);
  });

  // Let's delete ALL cache entries so that we get a fresh start!
  console.log('Deleting all cache entries...');
  for (const row of data) {
    const success = await store.delete(row.cache_key);
    console.log(`Delete "${row.cache_key}":`, success ? 'SUCCESS' : 'FAILED');
  }

  console.log('Cache cleared successfully!');
}

run().catch(console.error);
