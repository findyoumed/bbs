'use strict';

const { AttachmentRepository } = require('./AttachmentRepositoryLocal');
const { SupabaseAttachmentRepository } = require('./AttachmentRepositorySupabase');
const {
  createHttpError,
  isMissingAttachmentsTableError
} = require('./AttachmentRepositoryShared');

function createAttachmentRepository(projectRoot, options = {}) {
  return new AttachmentRepository(projectRoot, options);
}

function createAttachmentRepositoryFromEnv(projectRoot, env = {}, options = {}) {
  const hasSupabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY;
  const requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabase)) && hasSupabase && !options.baseDir) {
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
