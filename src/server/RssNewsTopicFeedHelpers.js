'use strict';

const { isGoogleNewsArticleUrl, normalizePublisherArticleUrl } = require('./GoogleNewsUrlResolver');
const { isScriptCodeDumping } = require('./RssNewsArticleSanitizer');
// [LOG_ID: 20260731_2000] escapeRegExp 로컬 복제 제거 — RssNewsArticleParserText가 원본.
const { escapeRegExp } = require('./RssNewsArticleParserText');

const MISSING_DATE_ENRICH_CONCURRENCY = 3;
const NEWS_TOPIC_ORDER = [
  '최신',
  '정치',
  '사회',
  '경제',
  '국제',
  '지역',
  '문화/생활',
  '스포츠',
  '연예',
  'IT/테크',
  '오피니언'
];

const NEWS_TOPIC_ORDER_MAP = new Map(NEWS_TOPIC_ORDER.map((title, index) => [title, index]));
const NEWS_TOPIC_ALIASES = new Map([
  ['뉴스', '최신'],
  ['주요', '최신'],
  ['video', '최신'],
  ['세계', '국제'],
  ['금융', '경제'],
  ['산업', '경제'],
  ['증권', '경제'],
  ['부동산', '경제'],
  ['수도권', '지역'],
  ['지방', '지역'],
  ['문화', '문화/생활'],
  ['생활', '문화/생활'],
  ['날씨', '문화/생활'],
  ['it', 'IT/테크'],
  ['it·바이오', 'IT/테크'],
  ['it바이오', 'IT/테크'],
  ['테크', 'IT/테크'],
  ['미디어', '오피니언']
]);

function buildNewsTopics(service, menu) {
  const topicsByTitle = new Map();
  const topicMap = new Map();

  for (const newspaper of menu.newspapers || []) {
    for (const category of newspaper.categories || []) {
      const rawTitle = service._normalize(category.name);
      const title = normalizeNewsTopicTitle(rawTitle);
      if (!title) {
        continue;
      }

      const key = title.toLowerCase();
      let topic = topicMap.get(key);
      if (!topic) {
        // [LOG: 20260504_1959] 세부 RSS 카테고리를 상위 뉴스 주제로 병합한다.
        topic = { door: '', title, sources: [] };
        topicMap.set(key, topic);
        topicsByTitle.set(title, topic);
      }

      topic.sources.push({
        newspaperDoor: newspaper.door,
        newspaperTitle: service._normalize(newspaper.name),
        categoryDoor: category.door,
        categoryTitle: rawTitle,
        rss: category.rss
      });
    }
  }

  return sortAndNumberNewsTopics(topicsByTitle);
}

function normalizeNewsTopicTitle(title) {
  const normalized = String(title || '').trim();
  const compact = normalized.replace(/\s+/g, '').toLowerCase();
  return NEWS_TOPIC_ALIASES.get(compact) || normalized;
}

function sortAndNumberNewsTopics(topicsByTitle) {
  const orderedTopics = [];
  for (const title of NEWS_TOPIC_ORDER) {
    const topic = topicsByTitle.get(title);
    if (topic) {
      orderedTopics.push(topic);
    }
  }

  for (const topic of topicsByTitle.values()) {
    if (!NEWS_TOPIC_ORDER_MAP.has(topic.title)) {
      orderedTopics.push(topic);
    }
  }

  orderedTopics.forEach((topic, index) => {
    topic.door = String(index + 1);
  });
  return orderedTopics;
}

async function resolveTopic(service, parseNewsMenuXml, topicDoor) {
  const menu = await service._loadMenu('news', service.newsMenuPath, parseNewsMenuXml);
  return buildNewsTopics(service, menu).find((topic) => topic.door === String(topicDoor)) || null;
}

// [LOG_ID: 20260710_1145] v17 -> v18: no(전역 번호)에 page 오프셋이 잘못 누적되던 버그 수정 후 캐시 무효화
function getTopicFeedCacheKey(topicDoor) {
  return `news:topicfeed:v18:${String(topicDoor || '').trim()}`;
}


function getFreshNewsCutoffTime(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.getTime();
}

function isFreshNewsItem(item, cutoffTime = getFreshNewsCutoffTime()) {
  const timestamp = Date.parse(item?.dateTime || item?.date || '');
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return timestamp >= cutoffTime;
}

function buildNewsArticleKey(service, item) {
  const link = service._normalize(item?.link || '');
  if (link) {
    return service._hashUrl(link);
  }

  const fallback = [
    item?.sourceDoor,
    item?.categoryTitle,
    item?.sourceTitle,
    item?.title,
    item?.dateTime || item?.date
  ].map((value) => service._normalize(value)).join('|');
  return fallback.trim() ? service._hashUrl(fallback) : '';
}

function normalizeNewsDedupeLink(value) {
  const source = normalizePublisherArticleUrl(value);
  if (!source) {
    return '';
  }

  try {
    const parsed = new URL(source);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';

    if (isGoogleNewsArticleUrl(parsed.toString())) {
      parsed.search = '';
      return parsed.toString();
    }

    [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'fbclid',
      'gclid',
      'oc',
      'hl',
      'gl',
      'ceid'
    ].forEach((name) => parsed.searchParams.delete(name));
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    void error;
    return String(source || '').trim();
  }
}

function normalizeNewsDedupeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeNewsDedupeTitle(service, item) {
  // [LOG: 20260616_1630] Enhance title deduplication key generation using aggressive brackets, publisher stripping, and symbol/space stripping
  let title = service._normalize(item?.title || '');
  const sourceTitle = service._normalize(item?.sourceTitle || item?.author || '');

  // 1. Remove bracketed media prefixes at the very beginning (e.g., [속보], [포토], [영상], [단독])
  title = title.replace(/^\[[^\]]+\]\s*/i, '');
  title = title.replace(/^\([^)]+\)\s*/i, '');

  // 2. Remove standard brackets / keywords like (종합), [종합], (상보), (1보), [1보]
  title = title.replace(/\s*[([](?:종합|상보|속보|단독|포토|영상|\d+보|종합\d+보)[)\]]/gi, '');

  // 3. Remove sourceTitle prefix or suffix if available
  if (title && sourceTitle) {
    const escapedSource = escapeRegExp(sourceTitle);
    title = title
      .replace(new RegExp(`^\\[?\\s*${escapedSource}\\s*\\]?\\s*(?:[:|\\-]\\s*)?`, 'i'), '')
      .replace(new RegExp(`\\s*(?:[:|\\-]\\s*)${escapedSource}$`, 'i'), '')
      .trim();
  }

  // 4. Forcefully strip common Korean media name patterns at the end (usually ends with " - PublisherName" or " / PublisherName")
  title = title.replace(/\s*[-—|•/]\s*[A-Za-z0-9가-힣\s]+(?:뉴스|tv|신문|일보|경제|포커스|데일리|타임즈|타임스|코리아|닷컴|net|한민족센터)?$/i, '');

  // 5. Apply normal dedupe text normalization (NFKC, lowercase, etc.)
  let clean = normalizeNewsDedupeText(title);

  // 6. Strip all whitespace and punctuation symbols to handle spacing and quotes mismatch
  // 6. Strip all whitespace and punctuation symbols to handle spacing and quotes mismatch
  // NOTE: Q and E are not special in JS regex — replaced with explicit character list to avoid accidentally removing 'Q' and 'E' from titles
  clean = clean.replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\]^_{|}~]/g, '').replace(/[`\u2026\u201C\u201D\u2018\u2019\u300E\u300F\u300A\u300B\u3008\u3009]/g, '');
  return clean;
}

function getNewsItemDedupeKeys(service, item) {
  const keys = [];
  const link = normalizeNewsDedupeLink(item?.link || '');
  if (link) {
    keys.push(`link:${link}`);
  }

  const title = normalizeNewsDedupeTitle(service, item);
  const date = String(item?.date || item?.dateTime || '').slice(0, 10);
  if (title && date) {
    keys.push(`title-date:${title}|${date}`);
  }

  return keys;
}

function preferNonGoogleLink(left, right) {
  const leftLink = String(left?.link || '').trim();
  const rightLink = String(right?.link || '').trim();
  if (!leftLink || !rightLink) {
    return leftLink ? left : right;
  }
  if (isGoogleNewsArticleUrl(leftLink) && !isGoogleNewsArticleUrl(rightLink)) {
    return right;
  }
  return left;
}

function pickLongerText(left, right) {
  const leftText = String(left || '').trim();
  const rightText = String(right || '').trim();
  return rightText.length > leftText.length ? rightText : leftText;
}

function mergeDuplicateNewsItem(existing, incoming) {
  const linkPreferred = preferNonGoogleLink(existing, incoming);
  return {
    ...existing,
    link: linkPreferred?.link || existing.link || incoming.link || '',
    description: pickLongerText(existing.description, incoming.description),
    body: pickLongerText(existing.body, incoming.body),
    imageUrl: existing.imageUrl || incoming.imageUrl || '',
    date: existing.date || incoming.date || '',
    dateTime: existing.dateTime || incoming.dateTime || '',
    author: existing.author || incoming.author || '',
    sourceTitle: existing.sourceTitle || incoming.sourceTitle || '',
    sourceDoor: existing.sourceDoor || incoming.sourceDoor || '',
    categoryTitle: existing.categoryTitle || incoming.categoryTitle || ''
  };
}

function dedupeNewsItems(service, items) {
  const cleanItems = (items || []).filter((item) => item !== null && item !== undefined);
  const uniqueItems = [];
  const keyToIndex = new Map();

  for (const item of cleanItems) {
    const keys = getNewsItemDedupeKeys(service, item);
    const existingIndex = keys
      .map((key) => keyToIndex.get(key))
      .find((index) => Number.isInteger(index));

    if (!Number.isInteger(existingIndex)) {
      const nextIndex = uniqueItems.length;
      uniqueItems.push(item);
      keys.forEach((key) => keyToIndex.set(key, nextIndex));
      continue;
    }

    const merged = mergeDuplicateNewsItem(uniqueItems[existingIndex], item);
    if (merged) {
      uniqueItems[existingIndex] = merged;
      getNewsItemDedupeKeys(service, uniqueItems[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
    }
  }

  return uniqueItems.filter(Boolean);
}

// [LOG: 20260610_1413] Helper function to filter items to only keep those within 3 days of the latest article date
function applyThreeDayFilter(service, items) {
  const cleanItems = (items || []).filter((item) => item !== null && item !== undefined);
  const sortedItems = [...cleanItems];
  sortedItems.sort((left, right) => {
    // [LOG: 20260619_2210] Date.parse(0)은 2000년으로 파싱되는 함정 → '' 폴백으로 NaN→0 보장
    const rightTime = Date.parse(right.dateTime || right.date || '') || 0;
    const leftTime = Date.parse(left.dateTime || left.date || '') || 0;
    return rightTime - leftTime;
  });

  if (sortedItems.length === 0) return sortedItems;

  const latestTime = Date.parse(sortedItems[0].dateTime || sortedItems[0].date || '') || 0;
  if (latestTime <= 0) return sortedItems;

  const cutoffTime = latestTime - 3 * 24 * 60 * 60 * 1000; // 3 days ago from the latest article
  return sortedItems.filter((item) => {
    if (!item) return false;
    const itemTime = Date.parse(item.dateTime || item.date || '') || 0;
    return itemTime >= cutoffTime;
  });
}

function normalizeTopicFeedItems(service, feed) {
  if (!feed || !Array.isArray(feed.items)) {
    return { feed, changed: false };
  }

  const dedupedItems = dedupeNewsItems(service, feed.items);
  const cutItems = applyThreeDayFilter(service, dedupedItems);
  const changed = cutItems.length !== feed.items.length;
  if (!changed) {
    return { feed, changed: false };
  }

  return {
    feed: {
      ...feed,
      items: cutItems.map((item, index) => ({
        ...item,
        no: index + 1,
        articleKey: item.articleKey || buildNewsArticleKey(service, item)
      }))
    },
    changed: true
  };
}

async function repairCachedTopicFeed(service, cacheKey, feed) {
  const normalized = normalizeTopicFeedItems(service, feed);
  if (!normalized.changed) {
    return normalized.feed;
  }

  // [LOG: 20260506_0929] Repair stale topic-feed caches that were built before duplicate cleanup.
  await setCachedTopicFeed(service, cacheKey, normalized.feed);
  return normalized.feed;
}

async function getCachedTopicFeed(service, cacheKey) {
  const memory = service._getMemoryCacheEntry(service.feedCache, cacheKey);
  if (memory) {
    return repairCachedTopicFeed(service, cacheKey, memory);
  }

  const persistent = await service._getPersistentCacheEntry(`rss:feed:${cacheKey}`);
  if (persistent) {
    const repaired = await repairCachedTopicFeed(service, cacheKey, persistent);
    // [LOG: 20260610_1505] Set in memory cache with the extended 12 hour stale TTL
    const extendedTtl = 12 * 60 * 60 * 1000;
    service._setMemoryCacheEntry(service.feedCache, cacheKey, repaired, extendedTtl);
    return repaired;
  }

  return null;
}

async function setCachedTopicFeed(service, cacheKey, value) {
  // [LOG: 20260610_1505] Store freshUntil inside value and save with extended 12 hour TTL for Stale-While-Revalidate
  const freshUntil = value.freshUntil || (Date.now() + service.cacheTtlMs);
  const entryWithValue = { ...value, freshUntil };
  const extendedTtl = 12 * 60 * 60 * 1000;

  service._setMemoryCacheEntry(service.feedCache, cacheKey, entryWithValue, extendedTtl);
  await service._setPersistentCacheEntry(`rss:feed:${cacheKey}`, entryWithValue, extendedTtl);
}

// [LOG: 20260617_1643] Fix typo parseFeedXml -> parseNewsFeedXml
async function buildTopicFeed(service, parseNewsFeedXml, topic, page = 1) {
  const results = await Promise.all(topic.sources.map(async (source) => ({
    source,
    // [LOG: 20260619_1420] v7 -> v8: 캐시 강제 무효화 및 스크립트 필터 적용을 위한 캐시 버전업
    feed: await service._fetchCached(`newsfeed:v8:${source.newspaperDoor}:${source.categoryDoor}`, source.rss, parseNewsFeedXml)
  })));

  const unavailable = results.filter((result) => result.feed.unavailable);
  const cutoffTime = getFreshNewsCutoffTime();
  const nowStr = new Date().toISOString();
  const items = results.flatMap((result) => (result.feed.items || [])
    .filter((item) => isFreshNewsItem(item, cutoffTime))
    // [LOG: 20260619_1945] RSS 본문(description/body)이 둘 다 빈 항목은 목록에서 제외 — 클릭 시 최소 요약을 보장하여 빈 기사 진입을 원천 차단
    .filter((item) => Boolean((item?.description || item?.body || '').trim()))
    // [LOG_ID: 20260709_1150] 스크립트 코드 유출로 오염된 기사는 목록 로딩 단계에서 원천 제외
    .filter((item) => !isScriptCodeDumping(item.description || item.body || ''))
    .map((item) => ({
      ...item,
      sourceTitle: service._normalize(result.source.newspaperTitle),
      sourceDoor: result.source.newspaperDoor,
      categoryTitle: service._normalize(result.source.categoryTitle),
      author: service._buildAuthor(result.source.newspaperTitle, item.author)
    })));

  // [LOG: 20260616_0937] Optimize: Target date enrichment to the currently requested page
  const tempItems = items.map(item => {
    const d = item.dateTime || item.date || nowStr;
    return { ...item, _tempTime: Date.parse(d) || 0 };
  });
  tempItems.sort((left, right) => right._tempTime - left._tempTime);

  let enrichTargets = [];
  if (page > 0) {
    const pageSize = 15;
    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;
    const pageItems = tempItems.slice(startIndex, endIndex);
    enrichTargets = pageItems.filter(item => !String(item.date || '').trim());
  } else {
    enrichTargets = tempItems.filter(item => !String(item.date || '').trim()).slice(0, 100);
  }

  // [LOG: 20260617_1220] Perform date enrichment in background to prevent blocking client requests on slow network fetches
  if (enrichTargets.length > 0) {
    if (page === 0) {
      await enrichMissingNewsDates(service, enrichTargets, enrichTargets.length);
    } else {
      enrichMissingNewsDates(service, enrichTargets, enrichTargets.length).catch(() => {});
    }
  }

  // [LOG: 20260610_1800] Optimization: Fallback to current time if date is still missing
  // to prevent recent articles from being dropped by the dedupe/dated filter.
  const itemsWithDates = items.map(item => {
    if (!String(item?.dateTime || item?.date || '').trim()) {
      return { ...item, date: nowStr, dateTime: nowStr, isDateFallback: true };
    }
    return item;
  });

  const datedItems = dedupeNewsItems(service, itemsWithDates);
  
  // [LOG: 20260610_1800] Optimization: Sort and clip to top 150 items to reduce client-side JSON parsing load.
  datedItems.sort((left, right) => {
    // [LOG: 20260619_2210] Date.parse(0)은 2000년으로 파싱되는 함정 → '' 폴백으로 NaN→0 보장
    const rightTime = Date.parse(right.dateTime || right.date || '') || 0;
    const leftTime = Date.parse(left.dateTime || left.date || '') || 0;
    return rightTime - leftTime;
  });

  // [LOG: 20260613_1153] 뉴스 수집 한도를 300개에서 1000개로 대폭 확장하여 오늘 뉴스 전부가 누락 없이 노출되도록 개선
  const finalItems = applyThreeDayFilter(service, datedItems).slice(0, 1000);

  const allFail = unavailable.length === results.length;
  const message = unavailable.length > 0 ? `실패: ${unavailable.map((result) => result.source.newspaperTitle).join(', ')}` : '';

  return {
    kind: 'news',
    title: `뉴스 / ${topic.title}`,
    level: 'articles',
    topic: { door: topic.door, title: topic.title },
    sources: topic.sources.map((source) => ({
      door: source.newspaperDoor,
      title: source.newspaperTitle,
      rss: source.rss
    })),
    sourceUrl: topic.sources.length === 1
      ? topic.sources[0].rss
      : `${topic.sources.map((source) => source.newspaperTitle).join(', ')} / ${topic.title}`,
    fetchedAt: nowStr,
    unavailable: allFail,
    message: allFail ? (results[0]?.feed?.message || message) : message,
    // [LOG_ID: 20260710_1145] finalItems는 page 값과 무관하게 항상 정렬된 전체 목록(최대 1000개)이다.
    // 예전엔 "페이지 단위로 잘린 배열"이라 가정하고 (page-1)*15 오프셋을 여기에 더했지만, 실제로는
    // 배열이 잘리지 않으므로 이 오프셋이 전체 배열 전 항목에 그대로 더해져 같은 기사의 no가 마지막으로
    // 빌드된 page 값에 따라 완전히 다른 값으로 뒤바뀌는 버그(예: 4번 기사에서 다음글 이동 시 166번으로
    // 점프)를 낳았다. index+1이 이미 전역(절대) 번호이므로 오프셋 없이 그대로 쓴다.
    items: finalItems.map((item, index) => ({
      ...item,
      no: index + 1,
      articleKey: buildNewsArticleKey(service, item)
    }))
  };
}

async function enrichMissingNewsDates(service, items, maxEnrich = 10) {
  const targets = (Array.isArray(items) ? items : [])
    .filter((item) => item?.link && !String(item.date || '').trim())
    .slice(0, maxEnrich);

  if (!targets.length) {
    return;
  }

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(MISSING_DATE_ENRICH_CONCURRENCY, targets.length));

  const worker = async () => {
    while (cursor < targets.length) {
      const currentIndex = cursor;
      cursor += 1;
      const item = targets[currentIndex];

      try {
        // [LOG: 20260430_2020] RSS 날짜가 비어 있는 기사만 원문 메타 날짜로 보강한다.
        const detail = await service._fetchNewsArticleDetail(item.link);
        if (!detail?.unavailable && detail?.date) {
          item.date = service._normalize(detail.date);
        }
        if (!detail?.unavailable && detail?.dateTime) {
          item.dateTime = service._normalize(detail.dateTime);
        }
        if (!detail?.unavailable && detail?.imageUrl && !item.imageUrl) {
          item.imageUrl = service._normalize(detail.imageUrl);
        }
      } catch (error) {
        void error;
      }
    }
  };

  await Promise.allSettled(Array.from({ length: workerCount }, () => worker()));
}

async function getOrBuildTopicFeed(service, parseNewsFeedXml, topic, page = 1) {
  const cacheKey = getTopicFeedCacheKey(topic?.door);
  const cached = await getCachedTopicFeed(service, cacheKey);
  if (cached) {
    const now = Date.now();
    const isFresh = cached.freshUntil && now < cached.freshUntil;
    if (isFresh) {
      return cached;
    }

    // [LOG: 20260610_1505] Stale-While-Revalidate: Return stale data instantly, and fetch fresh feed in background
    const inflight = service.topicFeedInflight.get(cacheKey);
    if (!inflight) {
      const job = (async () => {
        try {
          // [LOG: 20260616_0937] Back-ground fetch builds the full feed (page = 0)
          const freshFeed = await buildTopicFeed(service, parseNewsFeedXml, topic, 0);
          await setCachedTopicFeed(service, cacheKey, freshFeed);
        } catch (error) {
          // ignore background errors
        }
      })();
      service.topicFeedInflight.set(cacheKey, job);
      job.finally(() => {
        service.topicFeedInflight.delete(cacheKey);
      });
    }
    return cached;
  }

  const inflight = service.topicFeedInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const job = (async () => {
    // [LOG: 20260616_0937] 1. Sync load optimized for the requested page first
    const feed = await buildTopicFeed(service, parseNewsFeedXml, topic, page);
    
    // [LOG: 20260616_0937] 2. Fire and forget full feed build in background to fill cache
    (async () => {
      try {
        const fullFeed = await buildTopicFeed(service, parseNewsFeedXml, topic, 0);
        await setCachedTopicFeed(service, cacheKey, fullFeed);
      } catch (error) {
        // ignore background errors
      }
    })();

    return feed;
  })();

  service.topicFeedInflight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    service.topicFeedInflight.delete(cacheKey);
  }
}

function scheduleTopicFeedWarm(service, parseNewsFeedXml, topics) {
  if (!service.prefetchNewsTopicsOnMenu || service.topicFeedWarmPromise || !Array.isArray(topics) || topics.length === 0) {
    return;
  }

  service.topicFeedWarmPromise = warmTopicFeeds(service, parseNewsFeedXml, topics).finally(() => {
    service.topicFeedWarmPromise = null;
  });
}

async function warmTopicFeeds(service, parseNewsFeedXml, topics) {
  const queue = Array.isArray(topics) ? topics.slice(0, 10) : [];
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(3, queue.length));

  const worker = async () => {
    while (cursor < queue.length) {
      const currentIndex = cursor;
      cursor += 1;
      const topic = queue[currentIndex];
      if (!topic?.door) {
        continue;
      }

      try {
        await getOrBuildTopicFeed(service, parseNewsFeedXml, topic);
      } catch (error) {
        void error;
      }
    }
  };

  await Promise.allSettled(Array.from({ length: concurrency }, () => worker()));
}

module.exports = {
  buildNewsTopics,
  buildNewsArticleKey,
  getCachedTopicFeed,
  getOrBuildTopicFeed,
  getTopicFeedCacheKey,
  isFreshNewsItem,
  resolveTopic,
  scheduleTopicFeedWarm,
  setCachedTopicFeed,
  warmTopicFeeds
};

