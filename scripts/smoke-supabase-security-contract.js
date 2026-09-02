'use strict';

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0030_security_rpc_and_fk_indexes.sql');
const functions = [
  'calculate_user_rank',
  'set_post_local_id',
  'touch_chat_room_activity'
];
const indexes = [
  'idx_chat_messages_user_id',
  'idx_memos_reply_to_id',
  'idx_polls_post_id',
  'idx_poll_options_poll_id',
  'idx_poll_votes_option_id',
  'idx_poll_votes_user_id',
  'idx_game_scores_user_id',
  'idx_chat_rooms_creator_id',
  'idx_comments_author_id',
  'idx_comments_post_id',
  'idx_scraps_post_id',
  'idx_post_recommends_user_id',
  'idx_post_reports_reporter_id',
  'idx_post_reports_reviewed_by',
  'idx_chat_room_members_user_id'
];

function main() {
  let sql;
  try {
    sql = fs.readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: `Cannot read security migration: ${error.message}` }));
    process.exitCode = 1;
    return;
  }

  const missingFunctionRevokes = functions.filter((name) => !new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\(\\)`, 'i').test(sql));
  const missingSearchPathHardening = functions.filter((name) => !new RegExp(`ALTER\\s+FUNCTION\\s+public\\.${name}\\(\\)\\s+SET\\s+search_path\\s*=`, 'i').test(sql));
  const missingIndexes = indexes.filter((name) => !new RegExp(`CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${name}\\s+ON`, 'i').test(sql));
  const result = {
    ok: missingFunctionRevokes.length === 0 && missingSearchPathHardening.length === 0 && missingIndexes.length === 0,
    migration: path.relative(path.join(__dirname, '..'), migrationPath).replaceAll(path.sep, '/'),
    functionRevokeCount: functions.length - missingFunctionRevokes.length,
    searchPathHardeningCount: functions.length - missingSearchPathHardening.length,
    indexCount: indexes.length - missingIndexes.length,
    missingFunctionRevokes,
    missingSearchPathHardening,
    missingIndexes
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main();
