'use strict';

const BaseRouter = require('./BaseRouter');
const { eventBus, Events } = require('../EventBus');

// [LOG: 20260622_2301] VoteRouter 구현 — 투표 API 핸들러
class VoteRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/votes', handler: 'listVotes' },
      { method: 'GET', pattern: '/api/votes/:voteId', handler: 'getVote' },
      {
        method: 'POST',
        pattern: '/api/votes',
        handler: 'createVote',
        middlewares: ['ensureAuthenticated'],
        needBody: true
      },
      {
        method: 'POST',
        pattern: '/api/votes/:voteId/cast',
        handler: 'castVote',
        middlewares: ['ensureAuthenticated'],
        needBody: true
      },
      {
        method: 'DELETE',
        pattern: '/api/votes/:voteId',
        handler: 'deleteVote',
        middlewares: ['ensureAuthenticated']
      }
    ];
  }

  async listVotes() {
    const { voteRepository } = this.deps;
    const context = await this.getContext();
    return this.send(200, await voteRepository.listVotes(context));
  }

  _parseVoteId(params) {
    return this.parsePositiveIntParam(params?.voteId, '유효하지 않은 안건 번호입니다.');
  }

  async getVote(params) {
    const { voteRepository } = this.deps;
    const voteId = this._parseVoteId(params);
    const context = await this.getContext();
    return this.send(200, await voteRepository.getVote(voteId, context));
  }

  async createVote() {
    const { voteRepository } = this.deps;
    const body = await this.getBody() || {};
    const context = await this.getContext();
    const vote = await voteRepository.createVote(body, context);

    // [LOG: 20260622_2301] VOTE_CREATED 이벤트 발행
    eventBus.emit(Events.VOTE_CREATED, { repo: this.deps.boardRepository, vote, context }).catch(() => {});

    return this.send(201, vote);
  }

  async castVote(params) {
    const { voteRepository } = this.deps;
    const voteId = this._parseVoteId(params);

    const body = await this.getBody() || {};
    const optionIndex = Number(body.optionIndex);
    if (!Number.isInteger(optionIndex) || optionIndex < 0) {
      this.validationError('유효하지 않은 투표 항목 번호입니다.');
    }

    const context = await this.getContext();
    const record = await voteRepository.castVote(voteId, optionIndex, context);

    // [LOG: 20260622_2301] VOTE_CAST 이벤트 발행
    eventBus.emit(Events.VOTE_CAST, { repo: this.deps.boardRepository, voteRecord: record, context }).catch(() => {});

    return this.send(200, record);
  }

  async deleteVote(params) {
    const { voteRepository } = this.deps;
    const voteId = this._parseVoteId(params);
    const context = await this.getContext();
    return this.send(200, await voteRepository.deleteVote(voteId, context));
  }
}

async function handleVoteRoutes(deps) {
  const router = new VoteRouter(deps);
  return await router.handle();
}

module.exports = handleVoteRoutes;
