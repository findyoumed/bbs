'use strict';

const VALID_DRIVERS = new Set(['memory', 'supabase']);
const SUPABASE_HINT_KEYS = [
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_BOARDS_TABLE',
  'SUPABASE_POSTS_TABLE',
  'SUPABASE_MEMBERS_TABLE',
  'SUPABASE_MEMOS_TABLE',
  'SUPABASE_ATTACHMENTS_TABLE',
  'SUPABASE_CHAT_ROOMS_TABLE',
  'SUPABASE_CHAT_ROOM_MEMBERS_TABLE',
  'SUPABASE_RECOMMENDATIONS_TABLE'
];

function present(value) {
  return Boolean(String(value || '').trim());
}

function normalizedLower(value) {
  return String(value || '').trim().toLowerCase();
}

function requestedModeLabel(driver, hasSupabaseConfig) {
  if (driver === 'memory' || driver === 'supabase') {
    return driver;
  }
  return hasSupabaseConfig ? 'auto(supabase)' : 'auto(memory)';
}

function validateDriverValue(errors, key, value) {
  if (!value) {
    return;
  }
  if (!VALID_DRIVERS.has(value)) {
    errors.push(`${key} 값이 올바르지 않습니다: "${value}" (허용값: memory, supabase)`);
  }
}

function buildRepositoryEntry(key, envKey, driverValue, hasSupabaseConfig, label) {
  const explicitDriver = driverValue || '';
  return {
    key,
    label,
    envKey,
    requestedDriver: explicitDriver || 'auto',
    requestedMode: requestedModeLabel(explicitDriver, hasSupabaseConfig),
    predictedDriver: explicitDriver || (hasSupabaseConfig ? 'supabase' : 'memory'),
    effectiveDriver: ''
  };
}

function createRuntimeRepositoryDiagnostics(env = {}) {
  const boardDriverValue = normalizedLower(env.BOARD_REPOSITORY_DRIVER);
  const chatRoomDriverValue = normalizedLower(env.CHAT_ROOM_REPOSITORY_DRIVER || env.BOARD_REPOSITORY_DRIVER);
  const hasSupabaseUrl = present(env.SUPABASE_URL);
  const hasSupabaseServiceRoleKey = present(env.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabaseConfig = hasSupabaseUrl && hasSupabaseServiceRoleKey;
  const hasPartialSupabaseConfig = (hasSupabaseUrl || hasSupabaseServiceRoleKey) && !hasSupabaseConfig;
  const warnings = [];
  const errors = [];

  validateDriverValue(errors, 'BOARD_REPOSITORY_DRIVER', boardDriverValue);
  validateDriverValue(errors, 'CHAT_ROOM_REPOSITORY_DRIVER', normalizedLower(env.CHAT_ROOM_REPOSITORY_DRIVER));

  const repositories = {
    board: buildRepositoryEntry('board', 'BOARD_REPOSITORY_DRIVER', boardDriverValue, hasSupabaseConfig, '게시판'),
    member: buildRepositoryEntry('member', 'BOARD_REPOSITORY_DRIVER', boardDriverValue, hasSupabaseConfig, '회원'),
    memo: buildRepositoryEntry('memo', 'BOARD_REPOSITORY_DRIVER', boardDriverValue, hasSupabaseConfig, '메모'),
    attachment: buildRepositoryEntry('attachment', 'BOARD_REPOSITORY_DRIVER', boardDriverValue, hasSupabaseConfig, '첨부'),
    chatRooms: buildRepositoryEntry('chatRooms', 'CHAT_ROOM_REPOSITORY_DRIVER', chatRoomDriverValue, hasSupabaseConfig, '채팅방'),
    activity: buildRepositoryEntry('activity', 'ACTIVITY_REPOSITORY_DRIVER', normalizedLower(env.ACTIVITY_REPOSITORY_DRIVER), hasSupabaseConfig, '접속자')
  };

  for (const entry of Object.values(repositories)) {
    if (entry.requestedDriver === 'supabase' && !hasSupabaseConfig) {
      errors.push(`${entry.label} 저장소가 supabase로 명시됐지만 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 비어 있습니다.`);
    }
  }

  if (hasPartialSupabaseConfig) {
    const missingKeys = [];
    if (!hasSupabaseUrl) missingKeys.push('SUPABASE_URL');
    if (!hasSupabaseServiceRoleKey) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
    warnings.push(`Supabase core 설정이 부분만 채워져 있습니다. 누락 키: ${missingKeys.join(', ')}. auto supabase 선택은 비활성화되고 memory/local 경로가 사용됩니다.`);
  }

  const danglingSupabaseKeys = SUPABASE_HINT_KEYS.filter((key) => present(env[key]));
  if (danglingSupabaseKeys.length > 0 && !hasSupabaseConfig) {
    warnings.push(`Supabase 관련 보조 설정이 있지만 core 설정이 완전하지 않습니다: ${danglingSupabaseKeys.join(', ')}`);
  }

  return {
    modeLabel: requestedModeLabel(boardDriverValue, hasSupabaseConfig),
    hasSupabaseUrl,
    hasSupabaseServiceRoleKey,
    hasSupabaseConfig,
    hasPartialSupabaseConfig,
    repositories,
    warnings,
    errors
  };
}

function applyRuntimeRepositoryMeta(diagnostics, repositoryMap = {}) {
  const next = {
    ...diagnostics,
    repositories: Object.fromEntries(
      Object.entries(diagnostics.repositories || {}).map(([key, entry]) => {
        const meta = repositoryMap[key]?.getMeta?.() || {};
        const effectiveDriver = String(meta.driver || '').trim().toLowerCase();
        const ready = meta.ready !== false;
        const error = meta.error || '';
        return [key, { ...entry, effectiveDriver, ready, error }];
      })
    ),
    warnings: [...(diagnostics.warnings || [])],
    errors: [...(diagnostics.errors || [])]
  };

  for (const entry of Object.values(next.repositories)) {
    if (entry.effectiveDriver && entry.effectiveDriver !== entry.predictedDriver) {
      next.warnings.push(`${entry.label} 저장소가 예상 드라이버(${entry.predictedDriver})와 다르게 ${entry.effectiveDriver}로 초기화되었습니다.`);
    }
    if (entry.effectiveDriver && !entry.ready) {
      next.errors.push(`${entry.label} 저장소(${entry.effectiveDriver})가 준비되지 않았습니다: ${entry.error || '알 수 없는 오류'}`);
    }
  }

  return next;
}

function assertRuntimeRepositoryDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics?.errors) || diagnostics.errors.length === 0) {
    return;
  }
  const error = new Error(`Repository configuration invalid:\n- ${diagnostics.errors.join('\n- ')}`);
  error.code = 'INVALID_REPOSITORY_CONFIG';
  error.details = diagnostics;
  throw error;
}

module.exports = {
  applyRuntimeRepositoryMeta,
  assertRuntimeRepositoryDiagnostics,
  createRuntimeRepositoryDiagnostics,
  requestedModeLabel
};
