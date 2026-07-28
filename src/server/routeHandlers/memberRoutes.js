'use strict';

const BaseRouter = require('./BaseRouter');
const { validateEmail } = require('../httpUtils');
const {
  getReservedNicknameMessage,
  validateReservedNickname
} = require('../ReservedNicknamePolicy');
const { withAuthAdminRetry } = require('../AuthBridgeUtils');
const logger = require('../logger');

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
      // [LOG_ID: 20260721_0415] 보안 점검 중 발견: 두 엔드포인트 다 미들웨어가 전혀 없어
      // 로그인조차 없이 아무 userId·password 조합으로 호출 가능한 "비밀번호 오라클"이었다 —
      // /verify는 맞았는지 여부를, /email은 틀리면 {verified:false}를 그대로 알려줘 둘 다
      // 무제한 무차별 대입에 쓸 수 있었다(로컬 비밀번호 최소 길이가 4자뿐이라 실효성도 있었다).
      // 실제 클라이언트(myInfoActions.js)는 항상 state.user.userId(로그인한 본인)만 넘기므로
      // ensureAuthenticated + 본인/관리자 제한을 걸어도 기존 기능은 그대로 동작한다.
      {
        method: 'POST',
        pattern: '/api/members/:userId/password/verify',
        handler: 'verifyPassword',
        middlewares: ['ensureAuthenticated'],
        needContext: true,
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
        middlewares: ['ensureAuthenticated'],
        needContext: true,
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

  // [LOG_ID: 20260721_2020] 보안 감사 중 발견: getMember(/api/members/:userId)와
  // search(/api/members/search)는 미들웨어가 없어 로그인 없이 누구나 호출할 수 있는데,
  // toPublicMember는 password/id/authUserId만 걷어내고 email/birthday/sex/
  // lastLoginDateTime은 그대로 남겨둔다 — 즉 아이디만 알면 아무나 다른 회원의 이메일·생일·
  // 성별·최근 접속시각을 그대로 조회할 수 있었다(개인정보 유출). 클라이언트 어디에도 이
  // 필드들을 화면에 표시하는 곳이 없어(프로필/검색 화면은 닉네임·레벨·가입일만 씀) 기존
  // 기능을 깨지 않고 본인/관리자가 아닌 조회에서만 이 필드들을 제거한다.
  _toDirectoryMember(member, context, targetUserId) {
    if (!member) return member;
    const isSelfOrAdmin = Boolean(context?.isAdmin) || context?.userId === (targetUserId ?? member.userId);
    if (isSelfOrAdmin) return member;
    // [LOG: 20260724_1242] 아이디 로그인 시 이메일 맵핑 처리가 필수적이므로 email은 비로그인 필터링 대상에서 제외함
    // [LOG_ID: 20260728_2320] birthday/sex/lastLoginDateTime과 정확히 같은 이유(화면 어디서도
    // 안 씀 — buildProfileAnsi는 userId/nickName/level/registrationDateTime만 렌더)로
    // authUserId(Supabase Auth UUID)와 id(members 테이블 내부 PK)도 비로그인 조회에서 새어
    // 나오고 있었다 — 실측 확인: 인증 없는 GET /api/members/sysop이 authUserId까지 그대로
    // 반환. 클라이언트가 쓰지 않는 내부 식별자를 익명 요청에 불필요하게 노출할 이유가 없어
    // 함께 제거한다.
    const { birthday, sex, lastLoginDateTime, authUserId, id, ...rest } = member;
    return rest;
  }

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
    const context = await this.getContext();
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

    member = this._toDirectoryMember(member, context, member.userId);
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
    member = this._toDirectoryMember(member, context, targetUserId);
    if (allowMissing) return this.send(200, { found: true, member });
    return this.send(200, member);
  }

  async deleteMember(params) {
    const { memberRepository, chatRoomRepository } = this.deps;
    const targetUserId = params.userId;
    const context = await this.getContext();

    const isSelf = context.userId === targetUserId;
    if (!context.isAdmin && !isSelf) this.forbidden('본인 계정만 탈퇴할 수 있습니다.');

    const deletedMember = await memberRepository.deleteMember(targetUserId);

    // [LOG_ID: 20260722_0100] "반드시 필요한 작업만" — 게시글/쪽지는 손대지 않되(다른 회원의
    // 콘텐츠에 영향을 주는 삭제/익명화는 별도 정책 결정이 필요), 탈퇴 회원이 방장인 대화방만
    // 정리한다. 정리하지 않으면 다시는 로그인할 수 없는 아이디가 owner_user_id로 영원히 남아
    // 그 방의 설정변경(/E)·강퇴(/OUT)가 영구적으로 막히는 실질적 결함이 있었다. 회원 삭제
    // 자체는 이미 끝났으므로 방 정리 실패는 탈퇴 자체를 막지 않고 경고만 남긴다.
    if (chatRoomRepository && typeof chatRoomRepository.closeRoomsOwnedBy === 'function') {
      try {
        await chatRoomRepository.closeRoomsOwnedBy(targetUserId);
      } catch (error) {
        logger.warn('탈퇴 회원 소유 대화방 정리 실패', { component: 'MemberRouter', targetUserId, error: error.message });
      }
    }

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
    const context = await this.getContext();
    if (!context?.isAdmin && context?.userId !== targetUserId) this.forbidden('권한이 없습니다.');
    const body = await this.getBody();
    const password = String(body?.password || '').trim();
    const result = await this.verifyMemberPassword(targetUserId, password);

    // [LOG: 20260507_1722] Wrong passwords are transcript state, not API authorization errors.
    return this.send(200, { verified: result.verified });
  }

  async setEmail(params) {
    const { memberRepository, authBridge } = this.deps;
    const targetUserId = params.userId;
    const context = await this.getContext();
    if (!context?.isAdmin && context?.userId !== targetUserId) this.forbidden('권한이 없습니다.');
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

    const { error } = await withAuthAdminRetry(() => authBridge.client.auth.admin.updateUserById(authUser.id, {
      password
    }));
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
    const { error } = await withAuthAdminRetry(() => authBridge.client.auth.admin.deleteUser(id));
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
      logger.error('Auth password fallback verification failed', { component: 'MemberRouter', error: error.message });
      return { verified: false, source: 'auth-password' };
    }
  }

  // [LOG_ID: 20260722_3000] 내 부재 상태 조회 API — 종전엔 global.absentMessages(프로세스
  // 메모리 Map)에서 메시지 문자열 하나만 읽었는데, 서버 재시작/서버리스 인스턴스 교체마다
  // 사라지는 결함이 있었다(하이텔·천리안 두 책 모두 확인한 부재통지는 시작일/종료일까지
  // 포함하는데 그마저도 없었다). members 테이블(absent_start/absent_end/absent_reason,
  // 0020_member_absence.sql)에서 읽도록 교체.
  async getMyAbsent() {
    const { memberRepository } = this.deps;
    const context = await this.getContext();
    const userId = context.userId;
    if (!userId || userId === 'guest') {
      return this.error(401, '로그인이 필요한 서비스입니다.');
    }
    const member = await memberRepository.getMember(userId);
    return this.send(200, {
      absentStart: member?.absentStart || null,
      absentEnd: member?.absentEnd || null,
      absentReason: member?.absentReason || '',
      // 하위 호환: 기존 클라이언트가 absentMsg만 읽어도 동작하도록 별칭 유지.
      absentMsg: member?.absentReason || null
    });
  }

  // [LOG_ID: 20260722_3000] 부재 상태 설정 API. { reason, start, end }를 받는다 — 원전(그림 7.12,
  // NOMAN)과 동일하게 시작/종료일시를 남길 수 있다. 과거 클라이언트 호환을 위해 { absentMsg }만
  // 와도 사유로 받아들이고(날짜 없이 즉시~수동해제까지 무기한 활성), reason이 빈 문자열이면 해제.
  async setAbsent() {
    const { memberRepository } = this.deps;
    const context = await this.getContext();
    const userId = context.userId;
    if (!userId || userId === 'guest') {
      return this.error(401, '로그인이 필요한 서비스입니다.');
    }

    const payload = await this.getJsonBody() || {};
    const reason = String(payload.reason ?? payload.absentMsg ?? '').trim();
    const start = reason ? String(payload.start || '').trim() || null : null;
    const end = reason ? String(payload.end || '').trim() || null : null;

    const member = await memberRepository.setAbsence(userId, { start, end, reason });
    return this.send(200, {
      ok: true,
      absentStart: member.absentStart || null,
      absentEnd: member.absentEnd || null,
      absentReason: member.absentReason || '',
      absentMsg: member.absentReason || null
    });
  }
}

async function handleMemberRoutes(deps) {
  const router = new MemberRouter(deps);
  return await router.handle();
}

module.exports = handleMemberRoutes;
