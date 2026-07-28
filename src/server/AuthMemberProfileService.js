'use strict';

const logger = require('./logger');

function mergeMemberProfile(user, member) {
  if (!member) {
    return user;
  }

  return {
    ...user,
    userId: member.userId || user.userId,
    nickName: member.nickName || user.nickName,
    email: member.email || user.email,
    birthday: member.birthday || user.birthday || '',
    sex: member.sex || user.sex || '',
    level: member.isAdmin ? 99 : member.level,
    isAdmin: Boolean(user.isAdmin || member.isAdmin),
    registrationDateTime: member.registrationDateTime || user.registrationDateTime || '',
    lastLoginDateTime: member.lastLoginDateTime || user.lastLoginDateTime || ''
  };
}

function buildMemberSeed(user) {
  return {
    userId: user.userId,
    nickName: user.nickName,
    email: user.email,
    level: user.level,
    isAdmin: user.isAdmin
  };
}

function isDuplicateEmailConflict(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('idx_members_email_unique')
    || message.includes('duplicate key value violates unique constraint')
    || message.includes('email_unique')
  );
}

function isGeneratedOAuthUserId(user) {
  const userId = String(user?.userId || '').trim();
  const authUserId = String(user?.authUserId || '').trim();
  return Boolean(
    userId
    && authUserId
    && userId === authUserId
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
  );
}

function canReuseMemberByEmail(user, member) {
  const memberAuthUserId = String(member?.authUserId || '').trim();
  const userAuthUserId = String(user?.authUserId || '').trim();
  // [LOG: 20260429_1745] Do not let a different auth account claim an explicitly linked member row by email.
  if (memberAuthUserId && userAuthUserId && memberAuthUserId !== userAuthUserId) {
    return false;
  }

  // [LOG_ID: 20260728_2355] authProvider === 'email'(Supabase 자체 이메일/비밀번호 가입)일 때만
  // emailVerified 검사를 완전히 건너뛰고 있었다 — email_confirmed_at은 provider와 무관하게
  // 실제 인증 여부를 나타내는 동일한 신호인데, 'email' provider만 예외로 뒀을 근거가 없다.
  // 공격자가 남의 이메일로 (아직 확인 링크를 누르지 않은) 이메일/비밀번호 계정을 새로 만들면,
  // 이 예외 때문에 그 세션이 곧바로 같은 이메일을 쓰는 기존 member 행(닉네임/userId 포함)을
  // 자기 것으로 병합해 가져갈 수 있었다 — OAuth 경로는 이미 emailVerified를 요구하므로 동일한
  // 기준을 provider 구분 없이 적용한다.
  if (user?.emailVerified !== true) {
    return false;
  }

  return true;
}

class AuthMemberProfileService {
  constructor(options = {}) {
    this.memberRepository = options.memberRepository || null;
    this.logger = options.logger || logger;
    this.memberSyncWarned = false;
  }

  async _findMemberByEmail(user) {
    const normalizedEmail = String(user?.email || '').trim();
    if (!normalizedEmail || typeof this.memberRepository?.findByEmail !== 'function') {
      return null;
    }
    return this.memberRepository.findByEmail(normalizedEmail);
  }

  async enrichUser(user) {
    if (!this.memberRepository || !user?.userId) {
      return user;
    }

    try {
      const member = await this.memberRepository.getMember(user.userId);
      if (member) {
        return mergeMemberProfile(user, member);
      }

      if (!user.isGuest) {
        // [LOG: 20260422_1738] Reuse an existing member row when the auth identity shares an email.
        const memberByEmail = await this._findMemberByEmail(user);
        if (memberByEmail && canReuseMemberByEmail(user, memberByEmail)) {
          return mergeMemberProfile(user, memberByEmail);
        }

        // Avoid persisting a raw Supabase Auth UUID as the BBS userId for first-time OAuth logins.
        if (isGeneratedOAuthUserId(user)) {
          return user;
        }

        const savedMember = await this.memberRepository.ensureMember(buildMemberSeed(user));
        return mergeMemberProfile(user, savedMember);
      }
    } catch (error) {
      if (isDuplicateEmailConflict(error)) {
        try {
          const memberByEmail = await this._findMemberByEmail(user);
          if (memberByEmail && canReuseMemberByEmail(user, memberByEmail)) {
            return mergeMemberProfile(user, memberByEmail);
          }
        } catch (lookupError) {
          this.logger.error(lookupError.message || 'member email lookup error', {
            component: 'AuthMemberProfileService',
            stack: lookupError?.stack
          });
        }
      }

      if (error?.status >= 500) {
        if (!this.memberSyncWarned) {
          this.memberSyncWarned = true;
          this.logger.warn('member persistence unavailable', {
            component: 'AuthMemberProfileService',
            error: error.message
          });
        }
      } else {
        this.logger.error(error.message || 'member sync error', {
          component: 'AuthMemberProfileService',
          stack: error?.stack
        });
      }
    }

    return user;
  }
}

module.exports = {
  AuthMemberProfileService,
  mergeMemberProfile,
  buildMemberSeed
};
