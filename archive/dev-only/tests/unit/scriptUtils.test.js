'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { assert, loadEnv, resolvePublishableKey } = require('../../../../scripts/lib/scriptUtils');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bbs-script-utils-'));

try {
  const envPath = path.join(tmpRoot, '.env.test');
  fs.writeFileSync(envPath, '# comment\nFIRST_KEY=alpha\nSECOND_KEY = beta value\n', 'utf8');

  delete process.env.FIRST_KEY;
  process.env.SECOND_KEY = 'existing';
  loadEnv(envPath);

  assert(process.env.FIRST_KEY === 'alpha', 'loadEnv should read new keys from dotenv-style files');
  assert(process.env.SECOND_KEY === 'existing', 'loadEnv should not overwrite existing environment variables');

  let threw = false;
  try {
    assert(false, 'expected failure');
  } catch (error) {
    threw = error.message === 'expected failure';
  }
  assert(threw, 'assert helper should throw with the provided message');

  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  fs.writeFileSync(path.join(tmpRoot, 'supabase mcp.txt'), 'key: sb_publishable_test_12345', 'utf8');
  assert(
    resolvePublishableKey(tmpRoot) === 'sb_publishable_test_12345',
    'resolvePublishableKey should read publishable keys from the project note file'
  );

  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_env_override';
  assert(
    resolvePublishableKey(tmpRoot) === 'sb_publishable_env_override',
    'resolvePublishableKey should prefer explicit environment variables'
  );
} finally {
  delete process.env.FIRST_KEY;
  delete process.env.SECOND_KEY;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
