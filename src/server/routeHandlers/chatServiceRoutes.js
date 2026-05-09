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
    return this.send(200, await rssService.getNewsArticle(
      params.newspaper,
      params.topic,
      {
        articleKey: this.requestUrl.searchParams.get('key') || this.requestUrl.searchParams.get('articleKey') || '',
        link: this.requestUrl.searchParams.get('link') || ''
      }
    ));
  }

  async getNewsFeed(params) {
    const { rssService } = this.deps;
    return this.send(200, await (rssService.getNewsTopicFeed
      ? rssService.getNewsTopicFeed(params.topic)
      : rssService.listNewsCategories(params.topic)));
  }
}

async function handleChatServiceRoutes(deps) {
  const router = new ChatServiceRouter(deps);
  return await router.handle();
}

module.exports = handleChatServiceRoutes;
