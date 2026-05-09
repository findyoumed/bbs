'use strict';

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./lib/scriptUtils');
const { normalizeAuthEmail } = require('../src/server/AuthBridgeUtils');
const { normalizeRequestUserId } = require('../src/server/RequestIdentityHelpers');

function printHelp() {
  console.log([
    'Usage: node scripts/diagnose-member-email-conflicts.js [--json] [--email user@example.com]',
    '',
    'Checks the Supabase members table and Supabase Auth users for:',
    '- duplicate member emails (normalized lowercase)',
    '- duplicate auth emails',
    '- member/auth email conflicts where the same email maps to different user IDs',
    '',
    'Options:',
    '  --json              Print machine-readable JSON',
    '  --email <address>   Limit output to one normalized email'
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    json: false,
    email: ''
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
    registrationDateTime: String(row?.registration_datetime || '').trim(),
    updatedAt: String(row?.updated_at || '').trim()
  };
}

function normalizeAuthUser(user) {
  return {
    id: String(user?.id || '').trim(),
    email: normalizeAuthEmail(user?.email || ''),
    metadataUserId: resolveAuthMetadataUserId(user),
    createdAt: String(user?.created_at || '').trim(),
    lastSignInAt: String(user?.last_sign_in_at || '').trim()
  };
}

async function listAllAuthUsers(client) {
  const users = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch.map(normalizeAuthUser));

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

async function listAllMembers(client, table) {
  const rows = [];
  const pageSize = 1000;

  for (let page = 0; page < 100; page += 1) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error } = await client
      .from(table)
      .select('id,user_id,nick_name,email,auth_user_id,registration_datetime,updated_at')
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

function groupByEmail(items) {
  const map = new Map();

  items.forEach((item) => {
    const email = normalizeAuthEmail(item?.email || '');
    if (!email) {
      return;
    }
    if (!map.has(email)) {
      map.set(email, []);
    }
    map.get(email).push(item);
  });

  return map;
}

function sortEmailGroups(groups) {
  return groups.sort((left, right) => String(left.email || '').localeCompare(String(right.email || '')));
}

function buildDuplicateGroups(groupedItems) {
  const duplicates = [];

  groupedItems.forEach((items, email) => {
    if (items.length > 1) {
      duplicates.push({ email, items });
    }
  });

  return sortEmailGroups(duplicates);
}

function buildMemberAuthConflicts(memberGroups, authGroups) {
  const conflicts = [];

  memberGroups.forEach((memberItems, email) => {
    const authItems = authGroups.get(email) || [];
    if (!memberItems.length || !authItems.length) {
      return;
    }

    if (memberItems.length > 1 || authItems.length > 1) {
      conflicts.push({
        email,
        memberItems,
        authItems,
        action: memberItems.length > 1
          ? 'manual-review-multiple-member-rows'
          : 'manual-review-multiple-auth-users'
      });
      return;
    }

    const member = memberItems[0];
    const authUser = authItems[0];
    const userIdMismatch = authUser.metadataUserId && authUser.metadataUserId !== member.userId;
    const missingMetadataUserId = !authUser.metadataUserId;
    const authUserIdMismatch = member.authUserId && member.authUserId !== authUser.id;

    if (userIdMismatch || missingMetadataUserId || authUserIdMismatch) {
      conflicts.push({
        email,
        memberItems,
        authItems,
        action: 'update-auth-metadata-to-member-userid'
      });
    }
  });

  return sortEmailGroups(conflicts);
}

function buildSummary({ membersTable, memberRows, authUsers, duplicateMemberEmails, duplicateAuthEmails, memberAuthConflicts }) {
  return {
    checkedAt: new Date().toISOString(),
    membersTable,
    memberRowCount: memberRows.length,
    memberEmailCount: memberRows.filter((row) => row.email).length,
    authUserCount: authUsers.length,
    authEmailCount: authUsers.filter((row) => row.email).length,
    duplicateMemberEmailCount: duplicateMemberEmails.length,
    duplicateAuthEmailCount: duplicateAuthEmails.length,
    memberAuthConflictCount: memberAuthConflicts.length
  };
}

function printHumanReport(report) {
  const { summary, duplicateMemberEmails, duplicateAuthEmails, memberAuthConflicts } = report;

  console.log('[summary]');
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });

  console.log('\n[cleanup-criteria]');
  console.log('- single member row + single auth user conflict: keep `members.user_id` as canonical, update Auth `user_metadata.userId` to match it');
  console.log('- multiple auth users on one email: resolve Auth side first, then sync one surviving auth user to the member row');
  console.log('- multiple member rows on one normalized email: merge content ownership references before deleting or renaming any member row');

  console.log('\n[duplicate-member-emails]');
  if (!duplicateMemberEmails.length) {
    console.log('- none');
  } else {
    duplicateMemberEmails.forEach((group) => {
      console.log(`- ${group.email}`);
      group.items.forEach((item) => {
        console.log(`  member.user_id=${item.userId} nick=${item.nickName || '-'} auth_user_id=${item.authUserId || '-'} registered=${item.registrationDateTime || '-'}`);
      });
    });
  }

  console.log('\n[duplicate-auth-emails]');
  if (!duplicateAuthEmails.length) {
    console.log('- none');
  } else {
    duplicateAuthEmails.forEach((group) => {
      console.log(`- ${group.email}`);
      group.items.forEach((item) => {
        console.log(`  auth.id=${item.id} metadata.userId=${item.metadataUserId || '-'} created=${item.createdAt || '-'} lastSignIn=${item.lastSignInAt || '-'}`);
      });
    });
  }

  console.log('\n[member-auth-email-conflicts]');
  if (!memberAuthConflicts.length) {
    console.log('- none');
    return;
  }

  memberAuthConflicts.forEach((group) => {
    console.log(`- ${group.email} action=${group.action}`);
    group.memberItems.forEach((item) => {
      console.log(`  member.user_id=${item.userId} nick=${item.nickName || '-'} auth_user_id=${item.authUserId || '-'} registered=${item.registrationDateTime || '-'}`);
    });
    group.authItems.forEach((item) => {
      console.log(`  auth.id=${item.id} metadata.userId=${item.metadataUserId || '-'} created=${item.createdAt || '-'} lastSignIn=${item.lastSignInAt || '-'}`);
    });
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
  const supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const membersTable = String(process.env.SUPABASE_MEMBERS_TABLE || 'members').trim() || 'members';
  const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });

  const [memberRows, authUsers] = await Promise.all([
    listAllMembers(client, membersTable),
    listAllAuthUsers(client)
  ]);

  const filteredMemberRows = options.email
    ? memberRows.filter((item) => item.email === options.email)
    : memberRows;
  const filteredAuthUsers = options.email
    ? authUsers.filter((item) => item.email === options.email)
    : authUsers;

  const memberGroups = groupByEmail(filteredMemberRows);
  const authGroups = groupByEmail(filteredAuthUsers);
  const duplicateMemberEmails = buildDuplicateGroups(memberGroups);
  const duplicateAuthEmails = buildDuplicateGroups(authGroups);
  const memberAuthConflicts = buildMemberAuthConflicts(memberGroups, authGroups);
  const report = {
    summary: buildSummary({
      membersTable,
      memberRows: filteredMemberRows,
      authUsers: filteredAuthUsers,
      duplicateMemberEmails,
      duplicateAuthEmails,
      memberAuthConflicts
    }),
    duplicateMemberEmails,
    duplicateAuthEmails,
    memberAuthConflicts
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printHumanReport(report);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
