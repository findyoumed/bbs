'use strict';

// One-time, idempotent operational migration. It preserves the existing
// sysop credential and changes only its storage representation from legacy
// plaintext to the application's built-in scrypt format. Never log the value.
const { createClient } = require('@supabase/supabase-js');
const { loadEnvFile } = require('../src/server/createAppServices');
const { hashPassword, isHashedPassword } = require('../src/server/PasswordHashing');

loadEnvFile('.env', process.env);

async function main() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const table = String(process.env.SUPABASE_MEMBERS_TABLE || 'members').trim();
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service-role configuration is required.');
  }

  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: member, error: lookupError } = await client
    .from(table)
    .select('user_id,password')
    .eq('user_id', 'sysop')
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!member) {
    console.log(JSON.stringify({ ok: true, found: false, changed: false }));
    return;
  }
  if (!member.password || isHashedPassword(member.password)) {
    console.log(JSON.stringify({ ok: true, found: true, changed: false, hashed: isHashedPassword(member.password) }));
    return;
  }

  const nextPassword = hashPassword(member.password);
  const { error: updateError } = await client
    .from(table)
    .update({ password: nextPassword })
    .eq('user_id', 'sysop');
  if (updateError) throw updateError;

  const { data: verified, error: verifyError } = await client
    .from(table)
    .select('password')
    .eq('user_id', 'sysop')
    .maybeSingle();
  if (verifyError) throw verifyError;
  if (!isHashedPassword(verified?.password)) {
    throw new Error('sysop password hash verification failed');
  }
  console.log(JSON.stringify({ ok: true, found: true, changed: true, hashed: true }));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
