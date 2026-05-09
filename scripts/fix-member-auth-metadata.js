'use strict';

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./lib/scriptUtils');
const { normalizeAuthEmail } = require('../src/server/AuthBridgeUtils');
const { normalizeRequestUserId } = require('../src/server/RequestIdentityHelpers');

function printHelp() {
  console.log([
    'Usage: node scripts/fix-member-auth-metadata.js [--email user@example.com] [--apply] [--json]',
    '',
    'Finds safe 1:1 member/auth email conflicts and aligns Supabase Auth user_metadata.userId',
    'to the canonical members.user_id. Dry-run by default; use --apply to update Auth.',
    '',
    'Options:',
    '  --email <address>   Limit to one normalized email',
    '  --apply             Perform the Auth metadata update',
    '  --json              Print machine-readable JSON'
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    apply: false,
    email: '',
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--email') {
      options.email = normalizeAuthEmail(argv[index + 1] || '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveAuthMetadataUserId(user) {
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata
    : {};
  return normalizeRequestUserId(metadata.userId || metadata.username || '', '');
}

function normalizeMemberRow(row) {
  return {
    id: row?.id ?? null,
    userId: String(row?.user_id || '').trim(),
    nickName: String(row?.nick_name || '').trim(),
    email: normalizeAuthEmail(row?.email || ''),
    authUserId: String(row?.auth_user_id || '').trim(),
    registrationDateTime: String(row?.registration_datetime || '').trim()
  };
}

function normalizeAuthUser(user) {
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata
    : {};

  return {
    id: String(user?.id || '').trim(),
    email: normalizeAuthEmail(user?.email || ''),
    metadataUserId: resolveAuthMetadataUserId(user),
    metadataNickName: String(metadata.nickname || metadata.nick_name || '').trim(),
    userMetadata: metadata
  };
}

async function listAllMembers(client, table) {
  const rows = [];
  const pageSize = 1000;

  for (let page = 0; page < 100; page += 1) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error } = await client
      .from(table)
      .select('id,user_id,nick_name,email,auth_user_id,registration_datetime')
      .order('user_id', { ascending: true })
      .range(start, end);

    if (error) {
      throw error;
    }

    const batch = Array.isArray(data) ? data.map(normalizeMemberRow) : [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function listAllAuthUsers(client) {
  const users = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = Array.isArray(data?.users) ? data.users.map(normalizeAuthUser) : [];
    users.push(...batch);

    if (!batch.length) {
      break;
    }
    if (Number.isFinite(data?.lastPage) && data.lastPage > 0 && page >= data.lastPage) {
      break;
    }
    if (batch.length < perPage) {
      break;
    }
  }

  return users;
}

function groupByEmail(items) {
  const groups = new Map();

  items.forEach((item) => {
    const email = normalizeAuthEmail(item?.email || '');
    if (!email) {
      return;
    }
    if (!groups.has(email)) {
      groups.set(email, []);
    }
    groups.get(email).push(item);
  });

  return groups;
}

function buildSafeConflictPlans(memberGroups, authGroups, filterEmail = '') {
  const plans = [];

  memberGroups.forEach((memberItems, email) => {
    if (filterEmail && email !== filterEmail) {
      return;
    }
    const authItems = authGroups.get(email) || [];
    if (memberItems.length !== 1 || authItems.length !== 1) {
      return;
    }

    const member = memberItems[0];
    const authUser = authItems[0];
    const nextUserId = member.userId;
    const currentUserId = authUser.metadataUserId;
    const currentNickName = authUser.metadataNickName;
    const nextNickName = member.nickName || currentNickName || '';

    const needsUserIdUpdate = currentUserId !== nextUserId;
    const needsNickNameUpdate = nextNickName && currentNickName !== nextNickName;
    const authUserIdMismatch = member.authUserId && member.authUserId !== authUser.id;

    if (!needsUserIdUpdate && !needsNickNameUpdate && !authUserIdMismatch) {
      return;
    }

    plans.push({
      email,
      action: 'update-auth-user-metadata',
      reason: [
        needsUserIdUpdate ? 'metadata.userId mismatch' : '',
        needsNickNameUpdate ? 'nickname mismatch' : '',
        authUserIdMismatch ? 'members.auth_user_id mismatch' : ''
      ].filter(Boolean),
      member,
      authUser,
      nextMetadata: buildNextMetadata(member, authUser),
      needsUserIdUpdate,
      needsNickNameUpdate,
      authUserIdMismatch
    });
  });

  return plans.sort((left, right) => left.email.localeCompare(right.email));
}

function buildNextMetadata(member, authUser) {
  const currentMetadata = authUser?.userMetadata && typeof authUser.userMetadata === 'object'
    ? authUser.userMetadata
    : {};
  const nextMetadata = {
    ...currentMetadata,
    userId: member.userId
  };
  const nextNickName = String(member?.nickName || '').trim();
  if (nextNickName) {
    nextMetadata.nickname = nextNickName;
    nextMetadata.nick_name = nextNickName;
    if (!String(nextMetadata.name || '').trim()) {
      nextMetadata.name = nextNickName;
    }
  }
  return nextMetadata;
}

async function applyPlan(client, plan) {
  const { data, error } = await client.auth.admin.updateUserById(plan.authUser.id, {
    user_metadata: plan.nextMetadata
  });

  if (error) {
    throw error;
  }

  return {
    email: plan.email,
    authUserId: plan.authUser.id,
    memberUserId: plan.member.userId,
    updatedMetadataUserId: normalizeRequestUserId(data?.user?.user_metadata?.userId || '', ''),
    updatedNickName: String(data?.user?.user_metadata?.nickname || data?.user?.user_metadata?.nick_name || '').trim()
  };
}

function printHumanReport({ apply, plans, results }) {
  console.log('[summary]');
  console.log(`- mode: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`- eligibleUpdates: ${plans.length}`);
  console.log(`- updated: ${results.filter((item) => item.status === 'updated').length}`);
  console.log(`- failed: ${results.filter((item) => item.status === 'failed').length}`);

  console.log('\n[pending-updates]');
  if (!plans.length) {
    console.log('- none');
    return;
  }

  plans.forEach((plan) => {
    const result = results.find((item) => item.email === plan.email) || null;
    const prefix = result?.status === 'updated'
      ? 'updated'
      : result?.status === 'failed'
        ? 'failed'
        : 'pending';
    console.log(`- ${plan.email} status=${prefix} reason=${plan.reason.join(', ')}`);
    console.log(`  member.user_id=${plan.member.userId} member.nick=${plan.member.nickName || '-'} auth.id=${plan.authUser.id}`);
    console.log(`  auth.metadata.userId: ${plan.authUser.metadataUserId || '-'} -> ${plan.member.userId}`);
    if (plan.needsNickNameUpdate) {
      console.log(`  auth.metadata.nickname: ${plan.authUser.metadataNickName || '-'} -> ${plan.member.nickName || '-'}`);
    }
    if (plan.authUserIdMismatch) {
      console.log(`  member.auth_user_id=${plan.member.authUserId || '-'} (not changed by this script)`);
    }
    if (result?.status === 'failed') {
      console.log(`  error=${result.error}`);
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadEnv(path.join(path.resolve(__dirname, '..'), '.env'));

  const supabaseUrl = getRequiredEnv('SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const membersTable = String(process.env.SUPABASE_MEMBERS_TABLE || 'members').trim() || 'members';
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const [members, authUsers] = await Promise.all([
    listAllMembers(client, membersTable),
    listAllAuthUsers(client)
  ]);

  const plans = buildSafeConflictPlans(groupByEmail(members), groupByEmail(authUsers), options.email);
  const results = [];

  if (options.apply) {
    for (const plan of plans) {
      try {
        const updated = await applyPlan(client, plan);
        results.push({ status: 'updated', ...updated });
      } catch (error) {
        results.push({
          status: 'failed',
          email: plan.email,
          authUserId: plan.authUser.id,
          memberUserId: plan.member.userId,
          error: error.message || String(error)
        });
      }
    }
  } else {
    plans.forEach((plan) => {
      results.push({
        status: 'pending',
        email: plan.email,
        authUserId: plan.authUser.id,
        memberUserId: plan.member.userId
      });
    });
  }

  const report = {
    summary: {
      checkedAt: new Date().toISOString(),
      mode: options.apply ? 'apply' : 'dry-run',
      membersTable,
      eligibleUpdates: plans.length,
      updated: results.filter((item) => item.status === 'updated').length,
      failed: results.filter((item) => item.status === 'failed').length
    },
    plans: plans.map((plan) => ({
      email: plan.email,
      reason: plan.reason,
      member: plan.member,
      authUser: {
        id: plan.authUser.id,
        metadataUserId: plan.authUser.metadataUserId,
        metadataNickName: plan.authUser.metadataNickName
      },
      nextMetadata: plan.nextMetadata,
      authUserIdMismatch: plan.authUserIdMismatch
    })),
    results
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printHumanReport({
    apply: options.apply,
    plans,
    results
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
