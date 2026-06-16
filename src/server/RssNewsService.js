'use strict';
const crypto = require('crypto');
// [LOG: 20260615_1754] Use modern Chrome headers to bypass bot detection and prevent 429 rate limit errors
const CHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};
const RssServiceBase = require('./RssServiceBase');
const { parseNewsFeedXml, parseNewsMenuXml } = require('./RssServiceXmlParsers');
const { parseNewsArticleHtml } = require('./RssNewsArticleParser');
const { isGoogleNewsArticleUrl, normalizePublisherArticleUrl, resolveGoogleNewsSourceUrl } = require('./GoogleNewsUrlResolver');
const {
  buildNewsArticleKey,
  buildNewsTopics,
  getCachedTopicFeed,
  getOrBuildTopicFeed,
  getTopicFeedCacheKey,
  resolveTopic,
  scheduleTopicFeedWarm,
  setCachedTopicFeed,
  warmTopicFeeds
} = require('./RssNewsTopicFeedHelpers');
const {
  buildAuthor,
  isLikelyNoisyBody,
  normalize,
  normalizeUrl,
  pickArticleBody,
  pickPreferredArticleBody,
  sanitizeArticleText
} = require('./RssNewsArticleSanitizer');
const { scoreArticleText } = require('./RssNewsArticleParserScoring');

// [LOG: 20260616_1110] Decode HTML buffer dynamically using HTTP header charset or meta charset tags
function decodeHtmlBuffer(buffer, contentTypeHeader) {
  let charset = '';

  if (contentTypeHeader) {
    const headerMatch = contentTypeHeader.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
    if (headerMatch) {
      charset = headerMatch[1].trim().toLowerCase();
    }
  }

  const previewLen = Math.min(buffer.byteLength, 2048);
  const previewText = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, previewLen)));

  if (!charset) {
    const metaCharsetMatch = previewText.match(/<meta\s+[^>]*charset=["']?([a-zA-Z0-9_-]+)/i);
    if (metaCharsetMatch) {
      charset = metaCharsetMatch[1].trim().toLowerCase();
    } else {
      const equivMatch = previewText.match(/http-equiv=["']content-type["'][^>]*content=["'][^"']*charset=([a-zA-Z0-9_-]+)/i)
        || previewText.match(/content=["'][^"']*charset=([a-zA-Z0-9_-]+)["'][^>]*http-equiv=["']content-type["']/i);
      if (equivMatch) {
        charset = equivMatch[1].trim().toLowerCase();
      }
    }
  }

  const decoderName = /^(euc-kr|cp949|windows-949|ks_c_5601-1987)$/.test(charset) ? 'windows-949' : 'utf-8';
  try {
    return new TextDecoder(decoderName).decode(new Uint8Array(buffer));
  } catch (err) {
    return new TextDecoder('utf-8').decode(new Uint8Array(buffer));
  }
}

class RssNewsService extends RssServiceBase {
  constructor(options = {}) {
    super(options);
    // [LOG: 20260616_0937] Extend cache TTL to 5 minutes to balance live updates with speed
    this.cacheTtlMs = 5 * 60 * 1000;
    this.newsMenuPath = options.newsMenuPath || '';
    this.prefetchNewsTopicsOnMenu = options.prefetchNewsTopicsOnMenu !== false;
    this.topicFeedInflight = new Map();
    this.topicFeedWarmPromise = null;
  }

  async listNewsTopics() {
    const menu = await this._loadMenu('news', this.newsMenuPath, parseNewsMenuXml);
    const topics = this._buildNewsTopics(menu);
    this._scheduleTopicFeedWarm(topics);
    return { kind: 'news', title: '뉴스', level: 'topics', items: topics.map(t => ({ door: t.door, title: t.title, sourceCount: t.sources.length })) };
  }

  async getNewsFeed(newspaperDoor, categoryDoor) {
    if (!categoryDoor) return this.getNewsTopicFeed(newspaperDoor);
    const menu = await this._loadMenu('news', this.newsMenuPath, parseNewsMenuXml);
    const paper = menu.newspapers.find(p => p.door === String(newspaperDoor));
    if (!paper) throw this._notFoundError(`신문사 없음: ${newspaperDoor}`);
    const cat = paper.categories.find(c => c.door === String(categoryDoor));
    if (!cat) throw this._notFoundError(`카테고리 없음: ${categoryDoor}`);
    const feed = await this._fetchCached(`newsfeed:v5:${paper.door}:${cat.door}`, cat.rss, parseNewsFeedXml);
    return { kind: 'news', title: `뉴스 / ${paper.name} / ${cat.name}`, level: 'articles', newspaper: { door: paper.door, title: paper.name }, category: { door: cat.door, title: cat.name }, sourceUrl: cat.rss, fetchedAt: new Date().toISOString(), unavailable: !!feed.unavailable, message: feed.message || '', items: feed.items };
  }

  async getNewsTopicFeed(topicDoor, page = 1) {
    const topic = await this._resolveTopic(topicDoor);
    if (!topic) {
      throw this._notFoundError(`뉴스 주제 없음: ${topicDoor}`);
    }
    return this._getOrBuildTopicFeed(topic, page);
  }

  async _getOrBuildTopicFeed(topic, page = 1) {
    return getOrBuildTopicFeed(this, parseNewsFeedXml, topic, page);
  }

  async _buildTopicFeed(topic, page = 1) {
    const cacheKey = this._getTopicFeedCacheKey(topic?.door);
    const cached = await this._getCachedTopicFeed(cacheKey);
    if (cached) {
      return cached;
    }
    return getOrBuildTopicFeed(this, parseNewsFeedXml, topic, page);
  }

  async getNewsArticle(topicDoor, articleNo, options = {}) {
    const target = String(articleNo || '');
    const feed = await this.getNewsTopicFeed(topicDoor);

    let article = this._resolveNewsArticle(feed.items || [], target, options);

    // [LOG: 20260616_1228] Preserve original feed attributes before merging with crawl detail cache to guarantee clean fallback
    const originalFeedDescription = article?.description || '';
    const originalFeedBody = article?.body || '';

    // [LOG: 20260616_1110] Recovery mechanism for shifted or missing feed indices
    const requestedKey = String(options.articleKey || options.key || '').trim();
    const requestedLink = String(options.link || '').trim();

    let recoveredFromCache = false;
    let cachedDetail = null;

    if (requestedKey || requestedLink) {
      const hash = requestedKey || this._hashUrl(requestedLink);
      // Scan active versions of detail cache. We support v27 primarily.
      const cacheKey = `news:article:v27:${hash}`;
      const storeKey = `rss:feed:${cacheKey}`;
      try {
        cachedDetail = await this._getPersistentCacheEntry(storeKey);
        if (cachedDetail && !cachedDetail.unavailable && cachedDetail.body && cachedDetail.body.length >= 80) {
          recoveredFromCache = true;
        }
      } catch (err) {
        console.warn('캐시 복원 시도 중 오류 발생:', err.message);
      }
    }

    if (recoveredFromCache && cachedDetail) {
      // [LOG: 20260616_1620] Avoid inheriting mismatched metadata from feed article when cache resolves a shifted article
      const resolvedKey = article ? this._buildNewsArticleKey(article) : '';
      const isShifted = resolvedKey && requestedKey && resolvedKey !== requestedKey;

      article = {
        no: parseInt(target, 10) || 0,
        title: cachedDetail.title || (article?.title || ''),
        link: cachedDetail.link || requestedLink || (article?.link || ''),
        description: cachedDetail.description || (article?.description || ''),
        body: cachedDetail.body,
        date: cachedDetail.date || (article?.date || ''),
        dateTime: cachedDetail.dateTime || (article?.dateTime || ''),
        imageUrl: cachedDetail.imageUrl || (article?.imageUrl || ''),
        sourceTitle: cachedDetail.sourceTitle || (article?.sourceTitle || ''),
        sourceDoor: isShifted
          ? (this._findSourceDoorByTitle(cachedDetail.sourceTitle) || '')
          : (article?.sourceDoor || this._findSourceDoorByTitle(cachedDetail.sourceTitle) || ''),
        categoryTitle: isShifted ? '' : (article?.categoryTitle || '')
      };
    } else if (requestedLink && (!article || this._buildNewsArticleKey(article) !== requestedKey)) {
      // [LOG: 20260616_1110] Fabricate clean target container using requestedLink. Do NOT inherit mismatched article's metadata.
      article = {
        no: parseInt(target, 10) || 0,
        title: '',
        link: requestedLink,
        description: '',
        body: '',
        date: '',
        dateTime: '',
        imageUrl: '',
        sourceTitle: '',
        sourceDoor: '',
        categoryTitle: ''
      };
    }

    if (!article) {
      throw this._notFoundError(`뉴스 기사 없음: ${articleNo}`);
    }

    const actualKey = this._buildNewsArticleKey(article);
    if (requestedKey && actualKey !== requestedKey && !recoveredFromCache) {
      throw this._notFoundError(`뉴스 기사 키 불일치: ${articleNo}`);
    }

    const resolvedArticle = {
      ...article,
      articleKey: this._buildNewsArticleKey(article)
    };
    if (article.link) {
      const detail = await this._fetchNewsArticleDetail(article.link);
      if (detail?.sourceLink) {
        resolvedArticle.sourceLink = this._normalize(detail.sourceLink);
      }

      if (!detail?.unavailable) {
        const feedBody = this._sanitizeArticleText(originalFeedBody || originalFeedDescription);
        const detailBody = this._sanitizeArticleText(detail.body);

        // [LOG: 20260616_1250] Unify quality rules: treat all domains identically. Only accept body if it has sufficient length, high score, zero penalty keywords, and passes noise check.
        let acceptDetail = false;

        if (detailBody && detailBody.length >= 80) {
          const score = scoreArticleText(detailBody, 'body');
          const hasPenaltyWords = /(기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가|본문으로\s*바로가기|전체메뉴)/.test(detailBody);
          
          if (score >= 600 && !hasPenaltyWords && !isLikelyNoisyBody(detailBody)) {
            acceptDetail = true;
          }
        }

        const bestBody = acceptDetail ? detailBody : feedBody;

        if (bestBody) {
          resolvedArticle.body = bestBody;
        }
        if (!resolvedArticle.description && detail.description) {
          resolvedArticle.description = this._sanitizeArticleText(detail.description);
        }
        if (!resolvedArticle.title && detail.title) {
          resolvedArticle.title = this._normalize(detail.title);
        }
        if (!resolvedArticle.date && detail.date) {
          resolvedArticle.date = this._normalize(detail.date);
        }
        if (!resolvedArticle.dateTime && detail.dateTime) {
          resolvedArticle.dateTime = this._normalize(detail.dateTime);
        }
        if (!resolvedArticle.imageUrl && detail.imageUrl) {
          resolvedArticle.imageUrl = this._normalize(detail.imageUrl);
        }
      }
    }

    resolvedArticle.description = this._sanitizeArticleText(resolvedArticle.description);
    resolvedArticle.body = this._pickArticleBody([
      this._sanitizeArticleText(resolvedArticle.body),
      resolvedArticle.description
    ]);

    return {
      kind: 'news',
      title: `뉴스 / ${feed.topic?.title || ''}`,
      level: 'article',
      topic: feed.topic,
      articleNo: target,
      totalCount: Array.isArray(feed.items) ? feed.items.length : 0,
      article: resolvedArticle
    };
  }

  _buildNewsTopics(menu) {
    return buildNewsTopics(this, menu);
  }

  _buildNewsArticleKey(article) {
    return buildNewsArticleKey(this, article);
  }

  // [LOG: 20260615_1740] URL key-no mismatch conflict resolution (prefer manual no query)
  _resolveNewsArticle(items, targetNo, options = {}) {
    const list = Array.isArray(items) ? items : [];
    const expectedKey = this._normalize(options.articleKey || options.key || '');
    const expectedLink = this._normalize(options.link || '');
    const target = String(targetNo || '').trim();

    let byLink = null;
    if (expectedLink) {
      byLink = list.find((item) => this._normalize(item?.link || '') === expectedLink) || null;
    }

    let byKey = null;
    if (expectedKey) {
      byKey = list.find((item) => this._buildNewsArticleKey(item) === expectedKey) || null;
    }

    const byNo = target ? list.find((item, index) => String(item?.no || (index + 1)) === target) : null;

    // Detect user manual URL update conflict (different key vs no)
    const keyConflict = byKey && byNo && byKey !== byNo;
    const linkConflict = byLink && byNo && byLink !== byNo;

    if (keyConflict || linkConflict) {
      return byNo;
    }

    if (byLink) return byLink;
    if (byKey) return byKey;
    if (byNo) return byNo;

    return null;
  }

  // [LOG: 20260616_1620] Helper to map sourceTitle to its corresponding legacy newspaper door
  _findSourceDoorByTitle(sourceTitle) {
    if (!sourceTitle) return '';
    const cleanTitle = String(sourceTitle).trim().toLowerCase();
    
    const mappings = {
      '연합뉴스tv': '1',
      'sbs': '2',
      'sbs뉴스': '2',
      'sbs 뉴스': '2',
      '동아일보': '3',
      '뉴시스': '4',
      '조선일보': '5',
      '경향신문': '6',
      '매일경제': '7',
      '한국경제': '8',
      '연합뉴스': '9',
      '프레시안': '10',
      'jtbc': '11',
      'jtbc뉴스': '11',
      '한겨레': '12',
      '오마이뉴스': '13',
      '지디넷코리아': '14',
      '블로터': '15',
      'mbc': '16',
      'mbc뉴스': '16',
      'kbs': '17',
      'kbs뉴스': '17',
      '전자신문': '18',
      '뉴스1': '19',
      '머니투데이': '20',
      '구글뉴스': '21'
    };

    for (const key in mappings) {
      if (cleanTitle.includes(key) || key.includes(cleanTitle)) {
        return mappings[key];
      }
    }
    return '';
  }

  async _resolveTopic(topicDoor) {
    return resolveTopic(this, parseNewsMenuXml, topicDoor);
  }

  _getTopicFeedCacheKey(topicDoor) {
    return getTopicFeedCacheKey(topicDoor);
  }

  async _getCachedTopicFeed(cacheKey) {
    return getCachedTopicFeed(this, cacheKey);
  }

  async _setCachedTopicFeed(cacheKey, value) {
    await setCachedTopicFeed(this, cacheKey, value);
  }

  _scheduleTopicFeedWarm(topics) {
    scheduleTopicFeedWarm(this, parseNewsFeedXml, topics);
  }

  async _warmTopicFeeds(topics) {
    await warmTopicFeeds(this, parseNewsFeedXml, topics);
  }

  async _fetchNewsArticleDetail(link) {
    const normalizedLink = this._normalize(link);
    if (!normalizedLink) {
      return { unavailable: true, message: '피드 오류: 기사 링크 없음', items: [] };
    }

    const cacheKey = `news:article:v27:${this._hashUrl(normalizedLink)}`;
    const memory = this._getMemoryCacheEntry(this.feedCache, cacheKey);
    // [LOG: 20260615_1754] Ignore cached error results and retry fetch if body is empty or unavailable
    if (memory && !memory.unavailable && memory.body && memory.body.length >= 80) {
      return memory;
    }

    const storeKey = `rss:feed:${cacheKey}`;
    const persistent = await this._getPersistentCacheEntry(storeKey);
    if (persistent && !persistent.unavailable && persistent.body && persistent.body.length >= 80) {
      this._setMemoryCacheEntry(this.feedCache, cacheKey, persistent, this.cacheTtlMs);
      return persistent;
    }

    let detail;
    let resolvedSourceLink = '';
    let rawResolvedSourceLink = '';
    try {
      // [LOG: 20260616_1125] Ensure raw resolved links retain protocols for network fetch targets
      if (isGoogleNewsArticleUrl(link)) {
        const rawLink = await resolveGoogleNewsSourceUrl(link, this.fetchImpl);
        if (rawLink) {
          rawResolvedSourceLink = rawLink;
          resolvedSourceLink = this._normalize(rawLink);
        }
      }

      const fetchTarget = rawResolvedSourceLink || link;
      // [LOG: 20260610_1500] Add 3 second timeout to avoid hanging on slow servers
      const response = await this.fetchImpl(fetchTarget, {
        headers: CHROME_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(3000)
      });
      if (!response?.ok) {
        throw new Error(`upstream failed${response?.status ? ` (${response.status})` : ''}`);
      }

      // [LOG: 20260616_1110] Dynamic charset detection and decoding for primary content fetch
      const primaryBuf = await response.arrayBuffer();
      detail = parseNewsArticleHtml(decodeHtmlBuffer(primaryBuf, response.headers.get('content-type')));

      const rawResponseUrl = response?.url || '';
      const rawNormalizedResponseUrl = normalizePublisherArticleUrl(rawResponseUrl);
      const normalizedResponseUrl = this._normalize(rawNormalizedResponseUrl);
      if (!resolvedSourceLink && normalizedResponseUrl && !isGoogleNewsArticleUrl(rawResponseUrl)) {
        resolvedSourceLink = normalizedResponseUrl;
      }

      if (rawNormalizedResponseUrl
        && !isGoogleNewsArticleUrl(rawNormalizedResponseUrl)
        && normalizedResponseUrl !== this._normalize(fetchTarget)
        && normalizedResponseUrl !== this._normalize(rawResponseUrl)) {
        const canonicalResponse = await this.fetchImpl(rawNormalizedResponseUrl, {
          headers: CHROME_HEADERS,
          redirect: 'follow'
        });
        if (canonicalResponse?.ok) {
          // [LOG: 20260616_1110] Dynamic charset detection and decoding for canonical redirect fetch
          const canonicalBuf = await canonicalResponse.arrayBuffer();
          detail = parseNewsArticleHtml(decodeHtmlBuffer(canonicalBuf, canonicalResponse.headers.get('content-type')));
        }
      }
    } catch (error) {
      detail = { unavailable: true, message: `피드 오류: ${error.message}`, items: [] };
    }

    if (resolvedSourceLink && resolvedSourceLink !== normalizedLink) {
      detail = {
        ...(detail || {}),
        sourceLink: resolvedSourceLink
      };
    }

    this._setMemoryCacheEntry(this.feedCache, cacheKey, detail, this.cacheTtlMs);
    await this._setPersistentCacheEntry(storeKey, detail, this.cacheTtlMs);
    return detail;
  }

  _normalize(v) { return normalizeUrl(v); }
  _buildAuthor(src, aut) {
    return buildAuthor(src, aut);
  }
  _pickPreferredArticleBody(feedBody, detailBody, detailDescription) {
    return pickPreferredArticleBody(feedBody, detailBody, detailDescription);
  }
  _pickArticleBody(values) {
    return pickArticleBody(values);
  }
  _sanitizeArticleText(value) {
    return sanitizeArticleText(value);
  }
  _isLikelyNoisyBody(value) {
    return isLikelyNoisyBody(value);
  }
  _hashUrl(value) {
    return crypto.createHash('sha1').update(normalizeUrl(value)).digest('hex');
  }
}

module.exports = RssNewsService;
