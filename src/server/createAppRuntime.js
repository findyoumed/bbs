'use strict';

const { createAppServices, loadEnvFile, resolvePublishableKey } = require('./createAppServices');
const createRequestHandler = require('./createRequestHandler');

function createAppRuntime(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const env = options.env || process.env;
  const shouldLoadEnvFile = options.loadEnvFile !== false;

  if (shouldLoadEnvFile) {
    loadEnvFile(require('path').join(rootDir, '.env'), env);
  }

  const services = createAppServices(rootDir, env);
  const requestHandler = createRequestHandler({
    env,
    projectRoot: rootDir,
    ...services
  });

  return {
    requestHandler,
    boardRepository: services.boardRepository,
    attachmentRepository: services.attachmentRepository,
    chatRoomRepository: services.chatRoomRepository,
    memoRepository: services.memoRepository,
    runtimeConfig: services.runtimeConfig,
    memberRepository: services.memberRepository,
    voteRepository: services.voteRepository, // [LOG: 20260623_0013] origin/main 포팅

    repositoryDiagnostics: services.repositoryDiagnostics,
    errorTracker: services.errorTracker,
    shutdown: async () => {
      if (services.registry) {
        await services.registry.closeAll();
      }
    }
  };
}

function createAppRequestHandler(options = {}) {
  return createAppRuntime(options).requestHandler;
}

module.exports = {
  createAppRuntime,
  createAppRequestHandler,
  loadEnvFile,
  resolvePublishableKey
};
