'use strict';

const BaseRouter = require('./BaseRouter');

class ChatServiceRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/chat/rooms', handler: 'listChatRooms' },
      { 
        method: 'POST', 
        pattern: '/api/chat/rooms', 
        handler: 'createChatRoom', 
        needContext: true,
        validate: {
          body: {
            title: { required: true, maxLength: 100 }
          }
        }
      },
      { method: 'POST', pattern: '/api/chat/rooms/:roomNo/join', handler: 'handleRoomJoin', needContext: true, needBody: true },
      { method: 'POST', pattern: '/api/chat/rooms/:roomNo/leave', handler: 'handleRoomLeave', needContext: true, needBody: true },
      // [LOG_ID: 20260714_2200] 원전 /OUT(강퇴)·/E TITLE·/E USER(방 설정 변경) 재현
      { method: 'POST', pattern: '/api/chat/rooms/:roomNo/kick', handler: 'handleRoomKick', needContext: true, needBody: true },
      { method: 'POST', pattern: '/api/chat/rooms/:roomNo/settings', handler: 'handleRoomSettings', needContext: true, needBody: true },
      { method: 'GET', pattern: '/api/chat/rooms/:roomNo/messages', handler: 'listChatMessages' },
      { 
        method: 'POST', 
        pattern: '/api/chat/rooms/:roomNo/messages', 
        handler: 'sendChatMessage', 
        needContext: true,
        needBody: true
      },
      { method: 'GET', pattern: '/api/services/weather', handler: 'listWeatherRegions' },
      { method: 'GET', pattern: '/api/services/weather/all', handler: 'getNationalWeather' },
      { method: 'GET', pattern: '/api/services/weather/local', handler: 'getLocalWeather' },
      { method: 'GET', pattern: '/api/services/weather/:regionCode', handler: 'getWeatherFeed' },
      { method: 'GET', pattern: '/api/services/news', handler: 'listNewsTopics' },
      { method: 'GET', pattern: '/api/services/news/:newspaper/:topic', handler: 'getNewsArticle' },
      { method: 'GET', pattern: '/api/services/news/:topic', handler: 'getNewsFeed' }
    ];
  }

  async listChatRooms() {
    return this.send(200, await this.deps.chatRoomRepository.list());
  }

  async createChatRoom() {
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(201, await this.deps.chatRoomRepository.create(body, context));
  }

  async handleRoomJoin(params) {
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(200, await this.deps.chatRoomRepository.join(roomNo, body || {}, context));
  }

  async handleRoomLeave(params) {
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(200, await this.deps.chatRoomRepository.leave(roomNo, body || {}, context));
  }

  async handleRoomKick(params) {
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(200, await this.deps.chatRoomRepository.kick(roomNo, body?.targetUserId, context));
  }

  async handleRoomSettings(params) {
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(200, await this.deps.chatRoomRepository.updateRoom(roomNo, body || {}, context));
  }

  async listChatMessages(params) {
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    return this.send(200, await this.deps.chatRoomRepository.listMessages(roomNo));
  }

  // [LOG: 20260428_2332] Browser chat currently sends { content }, but older payloads
  // may still use { message }. Accept both and normalize into the repository contract.
  async getChatMessageBody() {
    const body = await this.getBody();
    const payload = body && typeof body === 'object' ? body : {};
    const content = typeof payload.content === 'string'
      ? payload.content
      : (typeof payload.message === 'string' ? payload.message : '');

    if (!content.trim()) {
      this.validationError('body parameter "content" is required.');
    }

    if (content.length > 2000) {
      this.validationError('body parameter "content" must be no more than 2000 characters.');
    }

    return {
      ...payload,
      content
    };
  }

  async sendChatMessage(params) {
    const roomNo = Number(params.roomNo);
    if (isNaN(roomNo)) this.validationError('Invalid room number');
    const body = await this.getChatMessageBody();
    const context = await this.getContext();
    return this.send(201, await this.deps.chatRoomRepository.sendMessage(roomNo, body, context));
  }


  async listWeatherRegions() {
    return this.send(200, await this.deps.rssService.listWeatherRegions());
  }

  async getNationalWeather() {
    return this.send(200, await this.deps.rssService.getNationalWeatherFeed());
  }

  async getLocalWeather() {
    const clientIp = (this.req.headers['x-forwarded-for'] || this.req.headers['x-real-ip'] || this.req.socket?.remoteAddress || '').split(',')[0].trim();
    return this.send(200, await this.deps.rssService.getLocalWeather(clientIp));
  }

  async getWeatherFeed(params) {
    return this.send(200, await this.deps.rssService.getWeatherFeed(params.regionCode));
  }

  async listNewsTopics() {
    const { rssService } = this.deps;
    return this.send(200, await (rssService.listNewsTopics ? rssService.listNewsTopics() : rssService.listNewsNewspapers()));
  }

  async getNewsArticle(params) {
    const { rssService } = this.deps;
    if (typeof rssService.getNewsArticle !== 'function') return false;

    // [LOG: 20260617_2158] Support both X-Article-Key/Link headers and query params for compatibility
    const headerKey = this.req.headers['x-article-key'] || '';
    const rawHeaderLink = this.req.headers['x-article-link'] || '';
    let headerLink = '';
    if (rawHeaderLink) {
      try {
        headerLink = decodeURIComponent(rawHeaderLink);
      } catch (e) {
        headerLink = rawHeaderLink;
      }
    }

    const articleKey = headerKey 
      || this.requestUrl.searchParams.get('key') 
      || this.requestUrl.searchParams.get('articleKey') 
      || '';
    const link = headerLink 
      || this.requestUrl.searchParams.get('link') 
      || '';

    return this.send(200, await rssService.getNewsArticle(
      params.newspaper,
      params.topic,
      {
        articleKey,
        link
      }
    ));
  }

  async getNewsFeed(params) {
    const { rssService } = this.deps;
    const page = Math.max(1, Number.parseInt(this.requestUrl.searchParams.get('page'), 10) || 1);
    // [LOG: 20260616_0937] Read page query parameter and pass it to getNewsTopicFeed
    return this.send(200, await (rssService.getNewsTopicFeed
      ? rssService.getNewsTopicFeed(params.topic, page)
      : rssService.listNewsCategories(params.topic)));
  }
}

async function handleChatServiceRoutes(deps) {
  const router = new ChatServiceRouter(deps);
  return await router.handle();
}

module.exports = handleChatServiceRoutes;
