'use strict';

// [LOG_ID: 20260719_1600] 토론의 광장(CONF) API — 회의실/안건/재청.
const BaseRouter = require('./BaseRouter');

class ConfRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/conf/rooms', handler: 'listRooms' },
      { method: 'POST', pattern: '/api/conf/rooms', handler: 'createRoom', middlewares: ['ensureAuthenticated'], needBody: true },
      { method: 'POST', pattern: '/api/conf/rooms/:roomNo/close', handler: 'closeRoom', middlewares: ['ensureAuthenticated'], needBody: true },
      { method: 'GET', pattern: '/api/conf/rooms/:roomNo/agendas', handler: 'listAgendas' },
      { method: 'POST', pattern: '/api/conf/rooms/:roomNo/agendas', handler: 'createAgenda', middlewares: ['ensureAuthenticated'], needBody: true },
      { method: 'GET', pattern: '/api/conf/agendas/:agendaId', handler: 'getAgenda', needContext: true },
      { method: 'POST', pattern: '/api/conf/agendas/:agendaId/second', handler: 'secondAgenda', middlewares: ['ensureAuthenticated'], needBody: true }
    ];
  }

  async listRooms() {
    const { confRepository } = this.deps;
    const includeClosed = this.requestUrl.searchParams.get('closed') === '1';
    return this.send(200, await confRepository.listRooms({ includeClosed }));
  }

  async createRoom() {
    const { confRepository } = this.deps;
    const body = await this.getBody() || {};
    const context = await this.getContext();
    return this.send(201, await confRepository.createRoom(body, context));
  }

  async closeRoom(params) {
    const { confRepository } = this.deps;
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const context = await this.getContext();
    return this.send(200, await confRepository.closeRoom(roomNo, context));
  }

  async listAgendas(params) {
    const { confRepository } = this.deps;
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    // [LOG_ID: 20260729_0020] getAgenda/secondAgenda/createAgenda는 모두 context를 넘겨
    // _publicAgenda가 "내가 재청했는지"(seconded)를 실제 로그인 사용자 기준으로 계산하는데,
    // 여기만 context를 아예 안 넘겨 항상 'guest' 기준으로 계산됐다(현재 클라이언트 목록
    // 화면이 seconded를 표시하지 않아 관측되진 않지만, 형제 메서드들과의 비대칭 자체가
    // 잠재 결함이라 함께 바로잡는다).
    const context = await this.getContext();
    return this.send(200, await confRepository.listAgendas(roomNo, context));
  }

  async createAgenda(params) {
    const { confRepository } = this.deps;
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const body = await this.getBody() || {};
    const context = await this.getContext();
    return this.send(201, await confRepository.createAgenda(roomNo, body, context));
  }

  async getAgenda(params) {
    const { confRepository } = this.deps;
    const agendaId = Number(params.agendaId);
    if (isNaN(agendaId)) this.validationError('Invalid agenda id');
    const context = await this.getContext();
    return this.send(200, await confRepository.getAgenda(agendaId, context));
  }

  async secondAgenda(params) {
    const { confRepository } = this.deps;
    const agendaId = Number(params.agendaId);
    if (isNaN(agendaId)) this.validationError('Invalid agenda id');
    const context = await this.getContext();
    return this.send(200, await confRepository.secondAgenda(agendaId, context));
  }
}

async function handleConfRoutes(deps) {
  const router = new ConfRouter(deps);
  return await router.handle();
}

module.exports = handleConfRoutes;
