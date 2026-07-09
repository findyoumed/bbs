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
    // [LOG: 20260617_1132] Keep /service/news menu entry fast; topic feeds load only after explicit selection.
    this.prefetchNewsTopicsOnMenu = options.prefetchNewsTopicsOnMenu === true;
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
    // [LOG: 20260619_1800] v7 -> v8: 캐시 강제 무효화 및 스크립트 필터 적용을 위한 캐시 버전업
    const feed = await this._fetchCached(`newsfeed:v8:${paper.door}:${cat.door}`, cat.rss, parseNewsFeedXml);
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
    let originalFeedDescription = article?.description || '';
    let originalFeedBody = article?.body || '';

    // [LOG: 20260616_1110] Recovery mechanism for shifted or missing feed indices
    const requestedKey = String(options.articleKey || options.key || '').trim();
    const requestedLink = String(options.link || '').trim();

    let recoveredFromCache = false;
    let cachedDetail = null;

    if (requestedKey || requestedLink) {
      const hash = requestedKey || this._hashUrl(requestedLink);
      // Scan active versions of detail cache. We support v28 primarily.
      const cacheKey = `news:article:v28:${hash}`;
      const storeKey = `rss:feed:${cacheKey}`;
      try {
        cachedDetail = await this._getPersistentCacheEntry(storeKey);
        // [LOG: 20260618_0910] Support cached short articles by validating detailFetched with unavailability check
        if (cachedDetail && !cachedDetail.unavailable) {
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

      // [LOG: 20260619_1920] 캐시된 기사는 크롤/RSS 구분 불가 — 30자 이상이면 허용 (말줄임표 검사 제거)
      const cachedBody = cachedDetail.body || '';
      const trimmedCached = cachedBody.trim();
      const detailFetched = !cachedDetail.unavailable && trimmedCached.length >= 30;

      article = {
        no: parseInt(target, 10) || 0,
        title: cachedDetail.title || (article?.title || ''),
        link: cachedDetail.link || requestedLink || (article?.link || ''),
        description: cachedDetail.description || (article?.description || ''),
        // [LOG: 20260619_1930] 캐시 body가 비어있으면 RSS 피드 원본 body로 폴백
        body: cachedDetail.body || (article?.body || ''),
        date: cachedDetail.date || (article?.date || ''),
        dateTime: cachedDetail.dateTime || (article?.dateTime || ''),
        imageUrl: cachedDetail.imageUrl || (article?.imageUrl || ''),
        sourceTitle: cachedDetail.sourceTitle || (article?.sourceTitle || ''),
        sourceDoor: isShifted
          ? (this._findSourceDoorByTitle(cachedDetail.sourceTitle) || '')
          : (article?.sourceDoor || this._findSourceDoorByTitle(cachedDetail.sourceTitle) || ''),
        categoryTitle: isShifted ? '' : (article?.categoryTitle || ''),
        detailFetched: !!detailFetched
      };
      // [LOG: 20260619_1930] non-empty 값만 덮어써서 RSS 원본 description/body를 잃지 않도록 보호
      if (article.description) originalFeedDescription = article.description;
      if (article.body) originalFeedBody = article.body;
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
      // [LOG: 20260616_1715] Clear original feed backup variables to ensure fabricated article does not inherit mismatch data
      originalFeedDescription = '';
      originalFeedBody = '';
    }

    if (!article) {
      throw this._notFoundError(`뉴스 기사 없음: ${articleNo}`);
    }

    // [LOG: 20260617_2010] UX Priority: Disable strict key mismatch blocking.
    // Feed shifting and URL normalization changes often cause keys to mismatch
    // between the list view and detail view. We now allow entry as long as 
    // the article exists in the feed (via link or no).
    // [LOG: 20260617_1651] Key drift is expected with live RSS feeds; allow silently.

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
        // [LOG: 20260617_0930] Pass resolved title to sanitizeArticleText to strip repeating lead title headers
        const feedBody = this._sanitizeArticleText(originalFeedBody || originalFeedDescription, resolvedArticle.title);
        const detailBody = this._sanitizeArticleText(detail.body, resolvedArticle.title || detail.title);

        // [LOG: 20260616_1250] Unify quality rules: treat all domains identically. Only accept body if it has sufficient length, high score, zero penalty keywords, and passes noise check.
        // [LOG: 20260617_1935] Further lower thresholds to support extremely short breaking news (e.g. MK).
        let acceptDetail = false;

        if (detailBody && detailBody.length >= 15) {
          // [LOG: 20260618_0920] Pass full title string to scoreArticleText
          const score = scoreArticleText(detailBody, 'body', resolvedArticle.title || detail.title);
          // [LOG: 20260619_2030] 단독 '요약'은 본문 정상어(예: 경제전망요약)를 오탐하므로 버튼 형태(요약봇/AI 요약)만 패널티 처리
          const hasPenaltyWords = /(기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약봇|AI\s*요약|구글\s*검색\s*선호\s*매체로\s*추가|본문으로\s*바로가기|전체메뉴)/.test(detailBody);
          
          // [LOG: 20260619_2050] 충분히 길고 점수 높은 본문은 단일 키워드 오탐(예: 본문 속 '댓글','요약')을 무시하고 신뢰.
          // 노이즈 덩어리는 score가 낮게 나오므로 길이+점수 동시 충족 시에만 우회 허용.
          const isHighQualityLong = detailBody.length >= 400 && score >= 1000;

          if (isHighQualityLong) {
            acceptDetail = true;
          } else if (!hasPenaltyWords && !isLikelyNoisyBody(detailBody)) {
            if (detailBody.length >= 80 && score >= 600) {
              acceptDetail = true;
            } else if (detailBody.length >= 15 && score >= 150) {
              acceptDetail = true;
            }
          }
        }

        const bestBody = acceptDetail ? detailBody : feedBody;

        if (bestBody) {
          resolvedArticle.body = bestBody;
        }
        if (!resolvedArticle.description && detail.description) {
          resolvedArticle.description = this._sanitizeArticleText(detail.description, resolvedArticle.title || detail.title);
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

        // [LOG: 20260619_1920] 크롤 성공 시 품질 검사: acceptDetail=true이면 크롤 본문에 엄격한 기준 적용,
        // RSS 폴백(acceptDetail=false)이면 말줄임표 검사 없이 30자 이상만 확인.
        const finalBody = this._sanitizeArticleText(resolvedArticle.body || resolvedArticle.description || '', resolvedArticle.title || detail.title);
        const trimmed = (finalBody || '').trim();

        const isTruncated = /[.]{2,}$|[…,\-:/]$/.test(trimmed)
          || /[며고나면지를을은는이가와과의로]/.test(trimmed.slice(-3));
        const hasBreakingNewsKeyword = /\[\s*(속보|단독|긴급|Breaking)\s*\]/i.test(resolvedArticle.title || detail.title)
          || /속보|단독|긴급|breaking/i.test(resolvedArticle.title || detail.title)
          || /속보|단독|긴급|breaking/i.test(trimmed);

        // [LOG: 20260624_1215] 회원님 요청("이런 기사는 차라리 나오던지")에 따라 기사 차단 정책 완전 폐기.
        // 불완전한 기사(문장 잘림, 짧은 내용)라도 무조건 본문을 보여주도록 허용.
        resolvedArticle.detailFetched = true;
      } else {
        // [LOG: 20260624_1215] 크롤 실패 시 RSS 요약 폴백 표시도 무조건 허용.
        resolvedArticle.detailFetched = true;
      }
    } else {
      // [LOG: 20260616_1715] Default fallback for articles with missing links
      // [LOG: 20260624_1215] 무조건 열람 허용 (불완전 기사 차단 폐기)
      resolvedArticle.detailFetched = true;
    }

    resolvedArticle.description = this._sanitizeArticleText(resolvedArticle.description, resolvedArticle.title);
    resolvedArticle.body = this._pickArticleBody([
      this._sanitizeArticleText(resolvedArticle.body, resolvedArticle.title),
      resolvedArticle.description
    ]);

    // [LOG: 20260622_1500] "완벽하게 보여주든지 아예 없든지" — 불완전(짤린/너무 짧은) 기사는 차단한다.
    // 단, 기사 자체는 피드에 존재하므로(리소스 없음 아님) HTTP 404가 아니라 200 + available:false 로 알린다.
    // 404 상태는 브라우저가 콘솔에 빨간 에러로 남겨 "버그"처럼 보이므로, 정상적인 정책 차단은 200으로 응답하고
    // 클라이언트가 available:false 를 보고 조용히 목록 복귀/자동 스킵하도록 한다. ("뉴스 기사 없음" 404는 그대로 유지)
    if (resolvedArticle.detailFetched === false) {
      return {
        kind: 'news',
        title: `뉴스 / ${feed.topic?.title || ''}`,
        level: 'article',
        topic: feed.topic,
        articleNo: target,
        totalCount: Array.isArray(feed.items) ? feed.items.length : 0,
        available: false,
        reason: 'incomplete',
        message: `불완전한 뉴스 기사입니다: ${articleNo}`,
        article: resolvedArticle
      };
    }

    // [LOG_ID: 20260709_1150] 스크립트 코드 유출로 오염된 기사는 단건 조회 시에도 강제 차단
    const { isScriptCodeDumping } = require('./RssNewsArticleSanitizer');
    if (isScriptCodeDumping(resolvedArticle.body || resolvedArticle.description || '')) {
      return {
        kind: 'news',
        title: `뉴스 / ${feed.topic?.title || ''}`,
        level: 'article',
        topic: feed.topic,
        articleNo: target,
        totalCount: Array.isArray(feed.items) ? feed.items.length : 0,
        available: false,
        reason: 'incomplete',
        message: `스크립트 오류로 인해 차단된 기사입니다: ${articleNo}`,
        article: resolvedArticle
      };
    }

    return {
      kind: 'news',
      title: `뉴스 / ${feed.topic?.title || ''}`,
      level: 'article',
      topic: feed.topic,
      articleNo: target,
      totalCount: Array.isArray(feed.items) ? feed.items.length : 0,
      available: true,
      article: resolvedArticle
    };
  }

  _buildNewsTopics(menu) {
    return buildNewsTopics(this, menu);
  }

  _buildNewsArticleKey(article) {
    return buildNewsArticleKey(this, article);
  }

  // [LOG: 20260617_1840] Prefer stable identifiers (link, key) over unstable indices (no)
  // This solves the bug where a shifting feed causes the wrong article to be displayed
  // if the feed refreshes between the list view and the detail view request.
  _resolveNewsArticle(items, targetNo, options = {}) {
    const list = Array.isArray(items) ? items : [];
    const expectedKey = this._normalize(options.articleKey || options.key || '');
    const expectedLink = this._normalize(options.link || '');
    const target = String(targetNo || '').trim();

    let byLink = null;
    if (expectedLink) {
      byLink = list.find((item) => this._normalize(item?.link || '') === expectedLink) || null;
      if (!byLink) {
        // [LOG_ID: 20260709_1010] 리다이렉트나 캐싱 과정에서 쿼리 파라미터가 유실/순서가 변경되어 
        // byLink 매칭이 엄격하게 이루어질 때 실패하는 문제를 완벽히 차단하기 위해,
        // 클라이언트와 동일하게 프로토콜, www., 쿼리스트링을 전부 지운 초정규화(superNormalize) 매칭 폴백을 작동한다.
        const superExpected = this._superNormalize(expectedLink);
        byLink = list.find((item) => this._superNormalize(item?.link || '') === superExpected) || null;
      }
    }

    let byKey = null;
    if (expectedKey) {
      byKey = list.find((item) => this._buildNewsArticleKey(item) === expectedKey) || null;
    }

    let byNo = target ? list.find((item, index) => String(item?.no || (index + 1)) === target) : null;
    if (byNo) {
      // [LOG: 20260618_0935] If both key and link mismatch, reject to prevent showing wrong article
      const actualKey = this._buildNewsArticleKey(byNo);
      const actualLink = this._normalize(byNo?.link || '');
      if (expectedKey && actualKey && actualKey !== expectedKey) {
        if (!expectedLink || actualLink !== expectedLink) {
          byNo = null;
        }
      }
      if (byNo && expectedLink && actualLink && actualLink !== expectedLink) {
        if (!expectedKey || actualKey !== expectedKey) {
          byNo = null;
        }
      }
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

    const cacheKey = `news:article:v28:${this._hashUrl(normalizedLink)}`;
    const memory = this._getMemoryCacheEntry(this.feedCache, cacheKey);
    // [LOG: 20260618_0915] Accept cached entries if they are not unavailable to prevent re-crawling short articles
    if (memory && !memory.unavailable) {
      return memory;
    }

    const storeKey = `rss:feed:${cacheKey}`;
    const persistent = await this._getPersistentCacheEntry(storeKey);
    // [LOG: 20260618_0915] Accept cached entries if they are not unavailable to prevent re-crawling short articles
    if (persistent && !persistent.unavailable) {
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
      // [LOG: 20260621_1000] 6초→8초: 연합뉴스 등 일부 매체가 6~8초 소요되어 크롤 실패→RSS 폴백되던 문제 완화.
      // RSS 폴백은 더 이상 표시하지 않으므로(완전 본문만 허용), 크롤 성공률을 최대한 끌어올린다.
      const response = await this.fetchImpl(fetchTarget, {
        headers: CHROME_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
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
  _superNormalize(v) {
    let str = String(v || '').trim();
    if (!str) return '';
    str = str.replace(/^https?:\/\//i, '');
    str = str.replace(/^www\./i, '');
    const qIdx = str.indexOf('?');
    if (qIdx !== -1) str = str.substring(0, qIdx);
    const hIdx = str.indexOf('#');
    if (hIdx !== -1) str = str.substring(0, hIdx);
    return str.replace(/\/+$/, '').trim();
  }
  _buildAuthor(src, aut) {
    return buildAuthor(src, aut);
  }
  _pickPreferredArticleBody(feedBody, detailBody, detailDescription) {
    return pickPreferredArticleBody(feedBody, detailBody, detailDescription);
  }
  _pickArticleBody(values) {
    return pickArticleBody(values);
  }
  _sanitizeArticleText(value, title) {
    return sanitizeArticleText(value, title);
  }
  _isLikelyNoisyBody(value) {
    return isLikelyNoisyBody(value);
  }
  _hashUrl(value) {
    return crypto.createHash('sha1').update(normalizeUrl(value)).digest('hex');
  }
}

module.exports = RssNewsService;
