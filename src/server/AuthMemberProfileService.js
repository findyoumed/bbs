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

  const authProvider = String(user?.authProvider || '').trim().toLowerCase();
  if (authProvider && authProvider !== 'email' && user?.emailVerified !== true) {
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
