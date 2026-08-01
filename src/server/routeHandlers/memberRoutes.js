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
      // [LOG_ID: 20260801_1730] absent 라우트에 ensureAuthenticated 추가 — getMyAbsent/setAbsent가
      // 핸들러 내부에서 context.userId === 'guest' 수동 검사로 401을 던지고 있었으나, 미들웨어 층이
      // 없어 인증 여부와 무관하게 핸들러까지 요청이 도달했다. 다른 모든 개인 정보 라우트와 통일한다.
      { method: 'GET', pattern: '/api/members/absent', handler: 'getMyAbsent', needContext: true, middlewares: ['ensureAuthenticated'] },
      { method: 'POST', pattern: '/api/members/absent', handler: 'setAbsent', needContext: true, middlewares: ['ensureAuthenticated'] },
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

    // [LOG_ID: 20260731_2230] 종전엔 Supabase 경로가 posts 테이블 **전체**를 `select('*')`
    // (content 전문 포함, 필터·범위 없음)로 받아와 JS에서 내 글만 걸러 집계했다 — 두 가지
    // 잠복 결함: ① PostgREST 기본 응답 상한(1000행)을 넘는 순간 초과분이 조용히 잘려 통계가
    // 틀려진다(오류 없이 undercount), ② 집계에 쓰는 건 hits/recommend 두 숫자뿐인데 전 게시글
    // 본문까지 매 요청 네트워크로 전송한다. 필터(작성자·미삭제)와 컬럼 선택을 DB로 내려
    // 내 글 행만 받는다. is_deleted 조건은 종전 JS 필터(`=== true`만 제외 — NULL은 포함)와
    // 정확히 같은 의미로 맞췄고, user_id/author_id 폴백 체인은 실측(전 행에서 user_id 존재,
    // author_id와 전부 일치)으로 불필요함을 확인해 user_id 단일 기준으로 정리했다.
    let mine = [];
    if (memberRepository.getMeta().driver === 'supabase') {
      const postsTable = (boardRepository.tables && boardRepository.tables.posts) || 'posts';
      const { data, error } = await boardRepository.client
        .from(postsTable)
        .select('hits, recommend')
        .eq('user_id', userId)
        .or('is_deleted.is.null,is_deleted.eq.false');
      if (error) {
        this.error(502, `이용 현황 집계 실패: ${error.message}`);
      }
      mine = data || [];
    } else {
      mine = (boardRepository.posts || []).filter((post) => {
        if (post.is_deleted === true || post.isDeleted === true) return false;
        const author = post.user_id || post.userId || post.author_id || post.authorId || '';
        return String(author) === userId;
      });
    }

    const postCount = mine.length;
    const hitsSum = mine.reduce((sum, post) => sum + Number(post.hits ?? post.hit ?? 0), 0);
    const recommendSum = mine.reduce((sum, post) => sum + Number(post.recommend ?? post.likes ?? 0), 0);

    // 쪽지 수는 레포지토리 API로만 센다(드라이버별 컬럼명 차이를 레포가 이미 흡수한다).
    // [LOG_ID: 20260731_2230] 서로 독립인 4개 조회를 순차 await로 기다리던 것을 병렬화 —
    // Supabase 드라이버 기준 왕복 4회가 1회 시간으로 줄어든다(결과·순서 의미 변화 없음).
    const [inbox, sent, archive, unread] = await Promise.all([
      memoRepository.listForUser({ ...context, box: 'inbox' }),
      memoRepository.listForUser({ ...context, box: 'sent' }),
      memoRepository.listForUser({ ...context, box: 'archive' }),
      memoRepository.countUnread(context)
    ]);

    return this.send(200, {
      userId: member.userId,
      nickName: member.nickName,
      level: member.level,
      isAdmin: Boolean(member.isAdmin),
      registrationDateTime: member.registrationDateTime || '',
      // [LOG_ID: 20260731_2130] member.lastLoginDateTime(memberRepository.getMember로 다시 읽은
      // DB 원본)은 가입 시 DEFAULT now()로 고정된 뒤 갱신되지 않는 값이다 — 이미 위에서 구한
      // context가 AuthBridge/AuthMemberProfileService를 거쳐 Supabase Auth의 fresh
      // last_sign_in_at을 반영한 값이므로(20260731_2030에서 /api/auth/session에는 이미 적용됨),
      // 여기서도 context를 우선한다. 실측: 같은 계정에서 /api/auth/session은 "최근 접속"이
      // 오늘 로그인으로 나오는데 이 엔드포인트(/account 화면)만 04/30에 얼어붙어 있었다.
      lastLoginDateTime: context.lastLoginDateTime || member.lastLoginDateTime || '',
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

  _parseTargetUserId(params) {
    const targetUserId = String(params?.userId || '').trim().toLowerCase();
    if (!targetUserId) {
      this.validationError('사용자 아이디가 필요합니다.');
    }
    return targetUserId;
  }

  async getMember(params) {
    const { memberRepository } = this.deps;
    const targetUserId = this._parseTargetUserId(params);
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
    const targetUserId = this._parseTargetUserId(params);
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

    // [LOG_ID: 20260728_2340] 운영자가 강제 탈퇴시킨 회원의 Supabase Auth 계정은 여기서 지우지
    // 않고 있었다(isSelf일 때만 삭제) — 그런데 AuthMemberProfileService.enrichUser()는 인증된
    // 요청인데 members 행이 없으면 "최초 로그인 자동 가입" 로직으로 ensureMember()를 호출해
    // members 행을 그대로 되살린다. 즉 강제 탈퇴된 사용자가 아직 유효한 로그인 세션(JWT)으로
    // 아무 API나 한 번만 더 호출하면 탈퇴가 조용히 무효화됐다(실측 확인: deleteMember 직후
    // enrichUser를 그 사용자 컨텍스트로 호출하면 members 행이 그대로 재생성됨). 대상 회원의
    // Supabase Auth 계정 자체를 지워 세션을 무효화해야 재로그인 없이는 enrichUser가 호출될
    // 여지가 없다 — self/admin 구분 없이 항상 대상(deletedMember)의 authUserId로 삭제한다.
    const result = await this.tryDeleteAuthAccount(deletedMember?.authUserId);
    const authDeleted = result.deleted;
    const authDeleteError = result.error;

    return this.send(200, { success: true, member: deletedMember, authDeleted, authDeleteError });
  }

  async verifyPassword(params) {
    const targetUserId = this._parseTargetUserId(params);
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
    const targetUserId = this._parseTargetUserId(params);
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
    const targetUserId = this._parseTargetUserId(params);
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

    // [LOG_ID: 20260729_0005] 관리자가 "본인이 아닌" 다른 회원의 비밀번호를 바꿀 때,
    // updateAuthPasswordForMember에 context.authUserId(요청자=관리자 자신의 authUserId)를
    // 그대로 넘기고 있었다. _resolveAuthUser는 authUserId가 주어지면 getUserById로 그 즉시
    // 반환해버려(userId/lookupEmail은 아예 확인하지 않음), 대상이 아니라 관리자 자신의
    // Supabase Auth 계정이 조회되고, 그 계정의 비밀번호가 관리자가 "대상 회원용으로" 입력한
    // 값으로 그대로 덮어써졌다 — 실측 재현: authUserId=관리자uuid, userId=다른 회원 조합으로
    // resolveAuthUser를 호출하면 관리자 자신의 auth 레코드가 반환됨을 확인. 바로 아래
    // setEmail()은 이미 대상 회원의 authUserId(existing.authUserId)를 정확히 쓰고 있어 —
    // 그 패턴과 동일하게 대상 회원의 authUserId/email을 조회해서 넘기도록 고친다.
    const targetMember = await memberRepository.getMember(targetUserId);
    const authPasswordSync = await this.updateAuthPasswordForMember(authBridge, {
      targetAuthUserId: targetMember?.authUserId,
      targetEmail: targetMember?.email,
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
    const targetUserId = this._parseTargetUserId(params);
    const body = await this.getBody();

    const validLevels = runtimeConfig?.validLevels || [1, 2, 99];
    const nextLevel = Number(body?.level);
    if (!validLevels.includes(nextLevel)) {
      this.validationError(`허용된 회원 레벨만 입력해 주세요. (${validLevels.join(', ')})`);
    }
    // [LOG: 20260801_2300] nickNameHint가 제공되지 않으면 undefined를 넘겨 레포지토리가
    // existing?.nickName으로 자연히 폴백하도록 한다 — 종전 `|| targetUserId` 폴백은
    // nickNameHint 미제공 시 대상 회원의 닉네임을 userId로 덮어썼다(버그).
    return this.send(200, await memberRepository.setLevel(targetUserId, body?.level, {
      nickName: body?.nickNameHint || undefined
    }));
  }

  // --- Helpers ---

  async updateAuthPasswordForMember(authBridge, options = {}) {
    // [LOG_ID: 20260729_0005] targetAuthUserId/targetEmail은 항상 "비밀번호를 바꾸려는 대상"의
    // 값이어야 한다 — 호출자(관리자)의 context를 여기 넘기면 관리자 자신의 Auth 계정이 대신
    // 조회·변경된다(setPassword의 호출부 주석 참고).
    const { targetAuthUserId, targetEmail, password, targetUserId } = options;
    if (!authBridge?.client?.auth?.admin?.updateUserById) {
      return { synced: false, reason: 'disabled' };
    }

    const authUser = typeof authBridge._resolveAuthUser === 'function'
      ? await authBridge._resolveAuthUser({
        authUserId: targetAuthUserId,
        userId: targetUserId,
        lookupEmail: targetEmail,
        allowTargetEmailLookup: targetEmail
      })
      : null;

    if (!authUser?.id) {
      if (targetAuthUserId) {
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

    // [LOG_ID: 20260801_1730] getJsonBody()는 BaseRouter에 정의된 적 없는 메서드 — 인증된 사용자가
    // POST /api/members/absent 호출 시 항상 "this.getJsonBody is not a function" 500 오류 발생.
    // 동일 기능의 getBody()로 교체한다.
    const payload = await this.getBody() || {};
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
