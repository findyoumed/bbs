'use strict';

const BaseRouter = require('./BaseRouter');
const { validateEmail } = require('../httpUtils');
const {
  getReservedNicknameMessage,
  validateReservedNickname
} = require('../ReservedNicknamePolicy');

/**
 * [LOG: 20260426_1910] Simplified MemberRouter by offloading Auth and Memo responsibilities (Evolution Mode: Structural Optimization)
 */
class MemberRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/members/absent', handler: 'getMyAbsent', needContext: true },
      { method: 'POST', pattern: '/api/members/absent', handler: 'setAbsent', needContext: true },
      { method: 'GET', pattern: '/api/members', handler: 'listMembers', middlewares: ['ensureAdmin'] },
      { method: 'GET', pattern: '/api/members/search', handler: 'search', needContext: true },
      // [LOG_ID: 20260716_2200] 하이텔 (1)-25 접속통계(account) 계열 — 내 이용 현황.
      // ':userId' 패턴보다 반드시 앞에 있어야 'stats'가 아이디로 잡히지 않는다.
      { method: 'GET', pattern: '/api/members/stats', handler: 'getMyStats', middlewares: ['ensureAuthenticated'], needContext: true },
      { 
        method: 'POST', 
        pattern: '/api/members/profile', 
        handler: 'updateProfile', 
        middlewares: ['ensureAuthenticated'],
        validate: {
          body: {
            nickName: { minLength: 2, maxLength: 20 },
            sex: { enum: ['M', 'F'] }
          }
        }
      },
      { method: 'GET', pattern: '/api/members/:userId', handler: 'getMember', needContext: true },
      { method: 'DELETE', pattern: '/api/members/:userId', handler: 'deleteMember', middlewares: ['ensureAuthenticated'] },
      {
        method: 'POST',
        pattern: '/api/members/:userId/password/verify',
        handler: 'verifyPassword',
        needBody: true,
        validate: {
          body: {
            password: { required: true }
          }
        }
      },
      {
        method: 'POST',
        pattern: '/api/members/:userId/email',
        handler: 'setEmail',
        needBody: true,
        validate: {
          body: {
            password: { required: true },
            email: { required: true }
          }
        }
      },
      { 
        method: 'POST', 
        pattern: '/api/members/:userId/password', 
        handler: 'setPassword', 
        middlewares: ['ensureAuthenticated'],
        needContext: true, 
        needBody: true,
        validate: {
          body: {
            password: { required: true, minLength: 6 }
          }
        }
      },
      { method: 'POST', pattern: '/api/members/:userId/level', handler: 'setLevel', middlewares: ['ensureAdmin'], needBody: true }
    ];
  }

  // --- Profile & Search ---

  async listMembers() {
    const { memberRepository } = this.deps;
    const options = this.getQueryOptions({ orderBy: 'user_id' });
    const search = this.requestUrl.searchParams.get('search') || '';
    const level = this.requestUrl.searchParams.get('level') || '';

    return this.send(200, await memberRepository.listMembers({ 
      ...options,
      search, 
      level 
    }));
  }

  async search() {
    const { memberRepository } = this.deps;
    const userId = this.requestUrl.searchParams.get('userId') || '';
    const nickName = this.requestUrl.searchParams.get('nickName') || '';
    const email = this.requestUrl.searchParams.get('email') || '';
    const allowMissing = this.requestUrl.searchParams.get('allowMissing') === '1';
    let member = null;

    if (userId) {
      member = await memberRepository.getMember(userId);
    } else if (nickName && typeof memberRepository.findByNickName === 'function') {
      member = await memberRepository.findByNickName(nickName);
    } else if (email && typeof memberRepository.findByEmail === 'function') {
      member = await memberRepository.findByEmail(email);
    } else {
      this.validationError('검색 조건이 필요합니다.');
    }

    if (!member) {
      if (allowMissing) return this.send(200, { found: false, member: null });
      this.notFound('회원 정보를 찾을 수 없습니다.');
    }

    if (allowMissing) return this.send(200, { found: true, member });
    return this.send(200, member);
  }

  // [LOG_ID: 20260716_2200] 하이텔 (1)-25 "접속통계(account)" 계열 화면용 집계.
  //
  // 주의: 원전의 접속통계는 접속 횟수·사용 시간·요금을 보여줬지만, 이 앱은 세션(접속 시간)을
  // 아예 기록하지 않으므로 그건 만들 수 없다. 대신 이미 가진 데이터(가입일·최근접속·등급·
  // 글/조회/추천·쪽지)로 "이용 현황"을 낸다 — 없는 수치를 지어내지 않는다.
  //
  // posts 테이블은 배포별로 컬럼명이 가변(user_id/author_id, hits/hit, recommend/likes,
  // is_deleted 유무)이라 rankingRoutes와 동일하게 select('*') 후 JS에서 처리한다.
  async getMyStats() {
    const { memberRepository, boardRepository, memoRepository } = this.deps;
    const context = await this.getContext();
    const userId = String(context?.userId || '').trim();

    if (!userId || userId === 'guest') {
      this.error(401, '로그인 후 이용할 수 있습니다.');
    }

    const member = await memberRepository.getMember(userId);
    if (!member) {
      this.notFound('회원 정보를 찾을 수 없습니다.');
    }

    let posts = [];
    if (memberRepository.getMeta().driver === 'supabase') {
      const postsTable = (boardRepository.tables && boardRepository.tables.posts) || 'posts';
      const { data, error } = await boardRepository.client.from(postsTable).select('*');
      if (error) {
        this.error(502, `이용 현황 집계 실패: ${error.message}`);
      }
      posts = data || [];
    } else {
      posts = boardRepository.posts || [];
    }

    const mine = posts.filter((post) => {
      if (post.is_deleted === true || post.isDeleted === true) return false;
      const author = post.user_id || post.userId || post.author_id || post.authorId || '';
      return String(author) === userId;
    });

    const postCount = mine.length;
    const hitsSum = mine.reduce((sum, post) => sum + Number(post.hits ?? post.hit ?? 0), 0);
    const recommendSum = mine.reduce((sum, post) => sum + Number(post.recommend ?? post.likes ?? 0), 0);

    // 쪽지 수는 레포지토리 API로만 센다(드라이버별 컬럼명 차이를 레포가 이미 흡수한다).
    const inbox = await memoRepository.listForUser({ ...context, box: 'inbox' });
    const sent = await memoRepository.listForUser({ ...context, box: 'sent' });
    const archive = await memoRepository.listForUser({ ...context, box: 'archive' });
    const unread = await memoRepository.countUnread(context);

    return this.send(200, {
      userId: member.userId,
      nickName: member.nickName,
      level: member.level,
      isAdmin: Boolean(member.isAdmin),
      registrationDateTime: member.registrationDateTime || '',
      lastLoginDateTime: member.lastLoginDateTime || '',
      postCount,
      hitsSum,
      recommendSum,
      memoInbox: inbox.length,
      memoSent: sent.length,
      memoArchived: archive.length,
      memoUnread: Number(unread?.count || 0)
    });
  }

  async updateProfile() {
    const { memberRepository, authBridge } = this.deps;
    const body = await this.getBody();
    const context = await this.getContext();

    const existing = await memberRepository.getMember(context.userId);
    const nextProfile = {
      userId: context.userId,
      nickName: body?.nickName ?? existing?.nickName ?? context.nickName ?? '',
      email: body?.email ? validateEmail(body.email) : (existing?.email ?? context.email ?? ''),
      birthday: String(body?.birthday ?? existing?.birthday ?? '').trim(),
      sex: String(body?.sex ?? existing?.sex ?? 'M').trim() || 'M',
      level: existing?.level ?? context.level ?? 1,
      isAdmin: existing?.isAdmin ?? context.isAdmin,
      isOpen: existing?.isOpen ?? true,
      registrationDateTime: existing?.registrationDateTime ?? '',
      lastLoginDateTime: existing?.lastLoginDateTime ?? ''
    };

    const reservedNickName = validateReservedNickname(nextProfile.nickName, context.userId);
    if (!reservedNickName.allowed) {
      this.conflict(getReservedNicknameMessage(reservedNickName.keyword));
    }

    if (typeof memberRepository.findByNickName === 'function' && nextProfile.nickName !== existing?.nickName) {
      const duplicateNick = await memberRepository.findByNickName(nextProfile.nickName);
      if (duplicateNick && duplicateNick.userId !== context.userId) this.conflict('이미 등록된 닉네임입니다.');
    }
    if (nextProfile.email && typeof memberRepository.findByEmail === 'function' && nextProfile.email !== existing?.email) {
      const duplicateEmail = await memberRepository.findByEmail(nextProfile.email);
      if (duplicateEmail && duplicateEmail.userId !== context.userId) this.conflict('이미 등록된 이메일 주소입니다.');
    }

    const savedProfile = await memberRepository.ensureMember(nextProfile);
    if (authBridge?.syncMemberAuthProfile) {
      try {
        await authBridge.syncMemberAuthProfile(savedProfile, {
          authUserId: context?.authUserId,
          lookupEmail: context?.email,
          allowMissingAuthUser: true
        });
      } catch (error) {
        // Rollback local profile if sync fails
        if (existing) await memberRepository.ensureMember(existing);
        throw error;
      }
    }
    return this.send(200, savedProfile);
  }

  // --- Member Account Management ---

  async getMember(params) {
    const { memberRepository } = this.deps;
    const targetUserId = params.userId;
    const context = await this.getContext();
    const allowMissing = this.requestUrl.searchParams.get('allowMissing') === '1';

    let member = await memberRepository.getMember(targetUserId);
    if (!member && targetUserId === context?.userId) {
      member = {
        userId: context.userId,
        nickName: context.nickName || context.userId,
        email: context.email || '',
        level: context.isAdmin ? 99 : Number(context.level || 1),
        isAdmin: Boolean(context.isAdmin)
      };
    }
    if (!member && targetUserId === 'guest') {
      member = { userId: 'guest', nickName: '손님', email: '', level: 1, isAdmin: false };
    }
    // [LOG: 20260429_0606] Allow profile screens to fail closed on missing users
    // without forcing a 404 fetch error into the browser console.
    if (!member) {
      if (allowMissing) return this.send(200, { found: false, member: null });
      this.notFound('회원 정보를 찾을 수 없습니다.');
    }
    if (allowMissing) return this.send(200, { found: true, member });
    return this.send(200, member);
  }

  async deleteMember(params) {
    const { memberRepository } = this.deps;
    const targetUserId = params.userId;
    const context = await this.getContext();

    const isSelf = context.userId === targetUserId;
    if (!context.isAdmin && !isSelf) this.forbidden('본인 계정만 탈퇴할 수 있습니다.');

    const deletedMember = await memberRepository.deleteMember(targetUserId);
    let authDeleted = false;
    let authDeleteError = '';

    if (isSelf) {
      const result = await this.tryDeleteAuthAccount(context.authUserId);
      authDeleted = result.deleted;
      authDeleteError = result.error;
    }

    return this.send(200, { success: true, member: deletedMember, authDeleted, authDeleteError });
  }

  async verifyPassword(params) {
    const targetUserId = params.userId;
    const body = await this.getBody();
    const password = String(body?.password || '').trim();
    const result = await this.verifyMemberPassword(targetUserId, password);

    // [LOG: 20260507_1722] Wrong passwords are transcript state, not API authorization errors.
    return this.send(200, { verified: result.verified });
  }

  async setEmail(params) {
    const { memberRepository, authBridge } = this.deps;
    const targetUserId = params.userId;
    const body = await this.getBody();
    const password = String(body?.password || '').trim();
    const nextEmailValue = validateEmail(body?.email || '');

    const passwordVerification = await this.verifyMemberPassword(targetUserId, password);
    if (!passwordVerification.verified) {
      return this.send(200, { verified: false, member: null });
    }

    const existing = await memberRepository.getMember(targetUserId);
    if (!existing) {
      this.notFound('회원 정보를 찾을 수 없습니다.');
    }

    if (nextEmailValue && typeof memberRepository.findByEmail === 'function' && nextEmailValue !== existing?.email) {
      const duplicateEmail = await memberRepository.findByEmail(nextEmailValue);
      if (duplicateEmail && duplicateEmail.userId !== targetUserId) this.conflict('이미 등록된 이메일 주소입니다.');
    }

    const nextProfile = {
      ...existing,
      userId: targetUserId,
      email: nextEmailValue
    };

    // [LOG: 20260507_1722] Update only email so the stored member password stays intact.
    const savedProfile = typeof memberRepository.setEmail === 'function'
      ? await memberRepository.setEmail(targetUserId, nextEmailValue)
      : await memberRepository.ensureMember(nextProfile);
    if (authBridge?.syncMemberAuthProfile) {
      try {
        await authBridge.syncMemberAuthProfile(savedProfile, {
          authUserId: existing?.authUserId,
          lookupEmail: existing?.email,
          allowMissingAuthUser: true
        });
      } catch (error) {
        if (existing) {
          if (typeof memberRepository.setEmail === 'function') {
            await memberRepository.setEmail(targetUserId, existing.email || '');
          } else {
            await memberRepository.ensureMember(existing);
          }
        }
        throw error;
      }
    }

    return this.send(200, savedProfile);
  }

  async setPassword(params) {
    const { authBridge, memberRepository } = this.deps;
    const targetUserId = params.userId;
    const body = await this.getBody();
    const context = await this.getContext();
    if (!context?.isAdmin && context?.userId !== targetUserId) this.forbidden('권한이 없습니다.');
    const nextPassword = String(body?.password || '').trim();

    // [LOG_ID: 20260721_0330] 보안 점검 중 발견: 이 엔드포인트는 ensureAuthenticated만 요구해
    // 관리자가 아니어도 "본인 비밀번호 변경"으로 통과한다. 그런데 요청 바디의 nickNameHint/
    // emailHint/isAdminHint를 그대로 defaults로 넘기고, 레포지토리(setPassword)는
    // `defaults.isAdmin ?? existing.isAdmin`으로 병합해 기존 값 위에 그대로 덮어쓴다 —
    // 즉 아무 로그인 사용자나 자기 비밀번호 변경 요청에 { isAdminHint: true }만 끼워 보내면
    // 스스로를 관리자(레벨 99)로 승격시킬 수 있었다(권한 상승 취약점). 실제 클라이언트 코드
    // 어디서도 이 세 Hint를 setPassword에 보내지 않는다(레벨 변경용 nickNameHint는 별도의
    // ensureAdmin 전용 /level 엔드포인트에서만 쓰임) — 즉 순수 공격 표면이었다. 비밀번호
    // 변경은 비밀번호만 바꿔야 하므로 defaults 없이 호출해 기존 프로필 값을 그대로 보존한다.
    const defaults = {};

    const authPasswordSync = await this.updateAuthPasswordForMember(authBridge, {
      context,
      password: nextPassword,
      targetUserId
    });
    const member = await memberRepository.setPassword(targetUserId, nextPassword, defaults);
    return this.send(200, {
      ...member,
      authPasswordSynced: authPasswordSync.synced,
      authPasswordSyncReason: authPasswordSync.reason
    });
  }

  async setLevel(params) {
    const { memberRepository, runtimeConfig } = this.deps;
    const targetUserId = params.userId;
    const body = await this.getBody();

    const validLevels = runtimeConfig?.validLevels || [1, 2, 99];
    const nextLevel = Number(body?.level);
    if (!validLevels.includes(nextLevel)) {
      this.validationError(`허용된 회원 레벨만 입력해 주세요. (${validLevels.join(', ')})`);
    }
    return this.send(200, await memberRepository.setLevel(targetUserId, body?.level, {
      nickName: body?.nickNameHint || targetUserId
    }));
  }

  // --- Helpers ---

  async updateAuthPasswordForMember(authBridge, options = {}) {
    const { context, password, targetUserId } = options;
    if (!authBridge?.client?.auth?.admin?.updateUserById) {
      return { synced: false, reason: 'disabled' };
    }

    const authUser = typeof authBridge._resolveAuthUser === 'function'
      ? await authBridge._resolveAuthUser({
        authUserId: context?.authUserId,
        userId: targetUserId,
        lookupEmail: context?.email,
        allowTargetEmailLookup: context?.email
      })
      : null;

    if (!authUser?.id) {
      if (context?.authUserId) {
        this.error(502, 'Supabase Auth 계정을 찾지 못해 비밀번호를 변경하지 못했습니다.');
      }
      return { synced: false, reason: 'auth-user-not-found' };
    }

    const { error } = await authBridge.client.auth.admin.updateUserById(authUser.id, {
      password
    });
    if (error) {
      if (typeof authBridge._throwAdminError === 'function') {
        authBridge._throwAdminError('Supabase Auth 비밀번호 변경', error);
      }
      this.error(502, `Supabase Auth 비밀번호 변경 실패: ${error.message || '알 수 없는 오류'}`);
    }

    return { synced: true, reason: 'auth-password-updated' };
  }

  async tryDeleteAuthAccount(authUserId) {
    const { authBridge } = this.deps;
    const id = String(authUserId || '').trim();
    if (!id || typeof authBridge?.client?.auth?.admin?.deleteUser !== 'function') {
      return { attempted: false, deleted: false, error: '' };
    }
    const { error } = await authBridge.client.auth.admin.deleteUser(id);
    if (error) {
      return { attempted: true, deleted: false, error: error.message };
    }
    return { attempted: true, deleted: true, error: '' };
  }

  async verifyMemberPassword(targetUserId, password) {
    const { authBridge, memberRepository } = this.deps;
    const normalizedUserId = String(targetUserId || '').trim();
    const normalizedPassword = String(password || '').trim();
    if (!normalizedUserId || !normalizedPassword) {
      return { verified: false, source: 'empty' };
    }

    if (typeof memberRepository.verifyPassword === 'function') {
      const localVerified = await memberRepository.verifyPassword(normalizedUserId, normalizedPassword);
      if (localVerified) {
        return { verified: true, source: 'member-password' };
      }
    }

    const member = typeof memberRepository.getMember === 'function'
      ? await memberRepository.getMember(normalizedUserId)
      : null;
    const email = validateEmail(member?.email || '');
    if (!email || typeof authBridge?.client?.auth?.signInWithPassword !== 'function') {
      return { verified: false, source: 'member-password' };
    }

    try {
      const { data, error } = await authBridge.client.auth.signInWithPassword({
        email,
        password: normalizedPassword
      });

      if (error || !data?.user) {
        return { verified: false, source: 'auth-password' };
      }

      // [LOG: 20260508_1702] Email signup stores the password in Supabase Auth first;
      // successful Auth verification repairs the local member password used by MyInfo.
      if (typeof memberRepository.setPassword === 'function') {
        await memberRepository.setPassword(normalizedUserId, normalizedPassword, {
          nickName: member?.nickName || normalizedUserId,
          email,
          isAdmin: member?.isAdmin === true
        });
      }
      return { verified: true, source: 'auth-password' };
    } catch (error) {
      console.error('[MemberRouter] Auth password fallback verification failed:', error.message);
      return { verified: false, source: 'auth-password' };
    }
  }

  // [LOG_ID: 20260713_1050] 내 부재 상태 조회 API
  async getMyAbsent() {
    const context = await this.getContext();
    const userId = context.userId;
    if (!userId || userId === 'guest') {
      return this.error(401, '로그인이 필요한 서비스입니다.');
    }
    global.absentMessages = global.absentMessages || new Map();
    const msg = global.absentMessages.get(userId) || null;
    return this.send(200, { absentMsg: msg });
  }

  // [LOG_ID: 20260713_1050] 부재 상태 설정 API
  async setAbsent() {
    const context = await this.getContext();
    const userId = context.userId;
    if (!userId || userId === 'guest') {
      return this.error(401, '로그인이 필요한 서비스입니다.');
    }
    
    const payload = await this.getJsonBody() || {};
    const msg = String(payload.absentMsg || '').trim();
    
    global.absentMessages = global.absentMessages || new Map();
    if (msg) {
      global.absentMessages.set(userId, msg);
    } else {
      global.absentMessages.delete(userId);
    }
    
    return this.send(200, { ok: true, absentMsg: msg || null });
  }
}

async function handleMemberRoutes(deps) {
  const router = new MemberRouter(deps);
  return await router.handle();
}

module.exports = handleMemberRoutes;
