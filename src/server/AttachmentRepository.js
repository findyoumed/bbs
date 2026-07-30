'use strict';

const { AttachmentRepository } = require('./AttachmentRepositoryLocal');
const { SupabaseAttachmentRepository } = require('./AttachmentRepositorySupabase');
const {
  createHttpError,
  isMissingAttachmentsTableError
} = require('./AttachmentRepositoryShared');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

function createAttachmentRepository(projectRoot, options = {}) {
  return new AttachmentRepository(projectRoot, options);
}

function createAttachmentRepositoryFromEnv(projectRoot, env = {}, options = {}) {
  // !options.baseDir는 드라이버 선택 정책이 아니라 이 팩토리만의 테스트용 강제 오버라이드다
  // (baseDir를 지정하면 Supabase 설정이 있어도 로컬 저장소를 강제한다) — 여기 남겨둔다.
  if (shouldUseSupabaseDriver(env.BOARD_REPOSITORY_DRIVER, hasSupabaseConfig(env)) && !options.baseDir) {
    return new SupabaseAttachmentRepository({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      table: env.SUPABASE_ATTACHMENTS_TABLE || 'attachments',
      maxBytes: options.maxBytes
    });
  }
  return new AttachmentRepository(projectRoot, options);
}

module.exports = {
  AttachmentRepository,
  SupabaseAttachmentRepository,
  createAttachmentRepository,
  createAttachmentRepositoryFromEnv,
  isMissingAttachmentsTableError,
  createHttpError
};
