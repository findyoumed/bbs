'use strict';

const { normalizeRequestUserId } = require('./RequestIdentityHelpers');
const { maybeUuid } = require('./httpUtils');
const { createBridgeError, normalizeAuthEmail, withAuthAdminRetry } = require('./AuthBridgeUtils');

async function syncMemberAuthProfile(bridge, member, options = {}) {
  if (!bridge.client) {
    return { synced: false, reason: 'disabled', user: null };
  }

  const normalizedUserId = normalizeRequestUserId(member?.userId || '', '');
  const normalizedEmail = normalizeAuthEmail(member?.email);
  if (!normalizedUserId) {
    return { synced: false, reason: 'missing-user-id', user: null };
  }
  if (!normalizedEmail) {
    return { synced: false, reason: 'missing-email', user: null };
  }

  const authUser = await resolveAuthUser(bridge, {
    authUserId: options.authUserId,
    userId: normalizedUserId,
    lookupEmail: options.lookupEmail,
    allowTargetEmailLookup: options.allowTargetEmailLookup ? normalizedEmail : ''
  });

  if (!authUser) {
    if (options.allowMissingAuthUser) {
      return { synced: false, reason: 'not_found', user: null };
    }
    throw createBridgeError(404, 'Supabase Auth 계정을 찾을 수 없습니다.');
  }

  const currentMetadata = authUser?.user_metadata && typeof authUser.user_metadata === 'object'
    ? authUser.user_metadata
    : {};
  const nextMetadata = {
    ...currentMetadata,
    userId: normalizedUserId
  };
  const nextNickName = String(member?.nickName || '').trim();
  if (nextNickName) {
    nextMetadata.nickname = nextNickName;
    nextMetadata.nick_name = nextNickName;
    if (!String(nextMetadata.name || '').trim()) {
      nextMetadata.name = nextNickName;
    }
  }

  const currentEmail = normalizeAuthEmail(authUser?.email);
  const currentUserId = normalizeRequestUserId(currentMetadata.userId || currentMetadata.username || '', '');
  const currentNickName = String(currentMetadata.nickname || currentMetadata.nick_name || '').trim();
  const needsEmailUpdate = currentEmail !== normalizedEmail;
  const needsUserIdUpdate = currentUserId !== normalizedUserId;
  const needsNickNameUpdate = nextNickName ? currentNickName !== nextNickName : false;
  const forceValidateEmail = options.forceValidateEmail === true;

  if (!needsEmailUpdate && !needsUserIdUpdate && !needsNickNameUpdate && !forceValidateEmail) {
    return { synced: false, reason: 'noop', user: authUser };
  }

  const { data, error } = await withAuthAdminRetry(() => bridge.client.auth.admin.updateUserById(authUser.id, {
    email: normalizedEmail,
    user_metadata: nextMetadata
  }));
  if (error) {
    throwAdminError('인증 프로필 동기화', error);
  }

  return {
    synced: true,
    reason: needsEmailUpdate ? 'email-updated' : 'metadata-updated',
    user: data?.user || authUser
  };
}

async function resolveAuthUser(bridge, options = {}) {
  const authUserId = maybeUuid(options.authUserId);
  if (authUserId) {
    const { data, error } = await withAuthAdminRetry(() => bridge.client.auth.admin.getUserById(authUserId));
    if (error) {
      throwAdminError('Supabase Auth 사용자 조회', error);
    }
    if (data?.user) {
      return data.user;
    }
  }

  const normalizedUserId = normalizeRequestUserId(options.userId || '', '');
  if (normalizedUserId) {
    const byUserId = await findAuthUser(
      bridge,
      (user) => extractAuthMemberUserId(user) === normalizedUserId
    );
    if (byUserId) {
      return byUserId;
    }
  }

  const lookupEmail = normalizeAuthEmail(options.lookupEmail);
  if (lookupEmail) {
    const byLookupEmail = await findAuthUser(
      bridge,
      (user) => normalizeAuthEmail(user?.email) === lookupEmail
    );
    if (byLookupEmail) {
      return byLookupEmail;
    }
  }

  const targetEmail = normalizeAuthEmail(options.allowTargetEmailLookup);
  if (targetEmail) {
    return findAuthUser(bridge, (user) => normalizeAuthEmail(user?.email) === targetEmail);
  }

  return null;
}

async function findAuthUser(bridge, predicate) {
  if (typeof predicate !== 'function') {
    return null;
  }

  const perPage = 200;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await withAuthAdminRetry(() => bridge.client.auth.admin.listUsers({ page, perPage }));
    if (error) {
      throwAdminError('Supabase Auth 사용자 목록 조회', error);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((user) => {
      try {
        return predicate(user);
      } catch (predicateError) {
        return false;
      }
    });
    if (match) {
      return match;
    }
    if (!users.length) {
      return null;
    }
    if (Number.isFinite(data?.lastPage) && data.lastPage > 0 && page >= data.lastPage) {
      return null;
    }
    if (users.length < perPage) {
      return null;
    }
  }

  // [LOG: 20260620_0930] 페이지 한도(50 x 200 = 10000명) 소진. 더 많은 사용자가 존재할 수 있으나
  // 탐색을 중단하고 null을 반환하므로, 조용히 누락되지 않도록 경고를 남긴다. (스모크 회귀 방지)
  console.warn(`[AuthBridgeSync] findAuthUser: ${maxPages} 페이지(최대 ${maxPages * perPage}명) 한도 도달, 매칭 사용자를 찾지 못했습니다. 사용자 수가 한도를 초과했을 수 있습니다.`);
  return null;
}

function extractAuthMemberUserId(user) {
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata
    : {};
  return normalizeRequestUserId(metadata.userId || metadata.username || '', '');
}

function throwAdminError(action, error) {
  const message = String(error?.message || '').trim() || `${action} 실패`;
  const normalizedMessage = message.toLowerCase();
  const errorCode = String(error?.code || '').trim().toLowerCase();

  if (errorCode === 'email_address_invalid' || /email address .* is invalid/i.test(message)) {
    throw createBridgeError(400, '현재 저장된 이메일 주소는 사용할 수 없습니다. 메일을 받을 수 있는 정확한 이메일 주소로 변경해 주세요.');
  }
  if (
    errorCode === 'email_exists' ||
    errorCode === 'email_conflict_identity_not_deletable' ||
    normalizedMessage.includes('already been registered') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('email not available')
  ) {
    throw createBridgeError(409, '이미 다른 인증 계정에서 사용 중인 이메일 주소입니다.');
  }

  throw createBridgeError(502, `${action} 실패: ${message}`);
}

module.exports = {
  extractAuthMemberUserId,
  findAuthUser,
  resolveAuthUser,
  syncMemberAuthProfile,
  throwAdminError
};
