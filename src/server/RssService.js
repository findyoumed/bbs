'use strict';
const RssWeatherService = require('./RssWeatherService');
const RssNewsService = require('./RssNewsService');

class RssService {
  constructor(options = {}) {
    this.weather = new RssWeatherService(options);
    this.news = new RssNewsService(options);
  }

  async listWeatherRegions() { return this.weather.listWeatherRegions(); }
  async getWeatherFeed(door) { return this.weather.getWeatherFeed(door); }
  async getNationalWeatherFeed() { return this.weather.getNationalWeatherFeed(); }
  async getLocalWeather(clientIp) { return this.weather.getLocalWeather(clientIp); }

  async listNewsNewspapers() { return this.news.listNewsTopics(); }
  async listNewsTopics() { return this.news.listNewsTopics(); }
  async listNewsCategories(door) { return this.news.getNewsTopicFeed(door); }
  async getNewsFeed(paper, cat) { return this.news.getNewsFeed(paper, cat); }
  async getNewsTopicFeed(door) { return this.news.getNewsTopicFeed(door); }
  async getNewsArticle(topicDoor, articleNo, options) { return this.news.getNewsArticle(topicDoor, articleNo, options); }
}

module.exports = RssService;
