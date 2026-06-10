'use strict';

const { isGoogleNewsArticleUrl, normalizePublisherArticleUrl } = require('./GoogleNewsUrlResolver');

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

function getTopicFeedCacheKey(topicDoor) {
  return `news:topicfeed:v12:${String(topicDoor || '').trim()}`;
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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeNewsDedupeTitle(service, item) {
  let title = service._normalize(item?.title || '');
  const sourceTitle = service._normalize(item?.sourceTitle || item?.author || '');

  if (title && sourceTitle) {
    const escapedSource = escapeRegExp(sourceTitle);
    title = title
      .replace(new RegExp(`^\\[?\\s*${escapedSource}\\s*\\]?\\s*(?:[:|\\-]\\s*)?`, 'i'), '')
      .replace(new RegExp(`\\s*(?:[:|\\-]\\s*)${escapedSource}$`, 'i'), '')
      .trim();
  }

  return normalizeNewsDedupeText(title);
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
  const uniqueItems = [];
  const keyToIndex = new Map();

  for (const item of items || []) {
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

    uniqueItems[existingIndex] = mergeDuplicateNewsItem(uniqueItems[existingIndex], item);
    getNewsItemDedupeKeys(service, uniqueItems[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
  }

  return uniqueItems;
}

function normalizeTopicFeedItems(service, feed) {
  if (!feed || !Array.isArray(feed.items)) {
    return { feed, changed: false };
  }

  const dedupedItems = dedupeNewsItems(service, feed.items);
  const changed = dedupedItems.length !== feed.items.length;
  if (!changed) {
    return { feed, changed: false };
  }

  return {
    feed: {
      ...feed,
      items: dedupedItems.map((item, index) => ({
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
    service._setMemoryCacheEntry(service.feedCache, cacheKey, repaired, service.cacheTtlMs);
    return repaired;
  }

  return null;
}

async function setCachedTopicFeed(service, cacheKey, value) {
  service._setMemoryCacheEntry(service.feedCache, cacheKey, value, service.cacheTtlMs);
  await service._setPersistentCacheEntry(`rss:feed:${cacheKey}`, value, service.cacheTtlMs);
}

async function buildTopicFeed(service, parseNewsFeedXml, topic) {
  const results = await Promise.all(topic.sources.map(async (source) => ({
    source,
    feed: await service._fetchCached(`newsfeed:v4:${source.newspaperDoor}:${source.categoryDoor}`, source.rss, parseNewsFeedXml)
  })));
  const unavailable = results.filter((result) => result.feed.unavailable);
  const cutoffTime = getFreshNewsCutoffTime();
  const items = results.flatMap((result) => (result.feed.items || [])
    .filter((item) => isFreshNewsItem(item, cutoffTime))
    .map((item) => ({
      ...item,
      sourceTitle: service._normalize(result.source.newspaperTitle),
      sourceDoor: result.source.newspaperDoor,
      categoryTitle: service._normalize(result.source.categoryTitle),
      author: service._buildAuthor(result.source.newspaperTitle, item.author)
    })));

  await enrichMissingNewsDates(service, items);
  // [LOG: 20260506_0907] Merge duplicate articles collected from overlapping RSS sources before numbering.
  const datedItems = dedupeNewsItems(
    service,
    items.filter((item) => String(item?.dateTime || item?.date || '').trim())
  );
  datedItems.sort((left, right) => {
    const rightTime = Date.parse(right.dateTime || right.date || 0) || 0;
    const leftTime = Date.parse(left.dateTime || left.date || 0) || 0;
    return rightTime - leftTime;
  });

  // [LOG: 20260610_1404] Dynamic gap cutting: if date gap exceeds 3 days, discard subsequent items (keep at least 50 items)
  let cutIndex = datedItems.length;
  const MIN_PRESERVE_COUNT = 50;
  for (let i = 0; i < datedItems.length - 1; i++) {
    const currentTime = Date.parse(datedItems[i].dateTime || datedItems[i].date || 0) || 0;
    const nextTime = Date.parse(datedItems[i + 1].dateTime || datedItems[i + 1].date || 0) || 0;
    if (currentTime > 0 && nextTime > 0) {
      const gapMs = currentTime - nextTime;
      const gapDays = gapMs / (1000 * 60 * 60 * 24);
      if (gapDays > 3 && (i + 1) >= MIN_PRESERVE_COUNT) {
        cutIndex = i + 1;
        break;
      }
    }
  }
  const finalItems = datedItems.slice(0, cutIndex);

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
    fetchedAt: new Date().toISOString(),
    unavailable: allFail,
    message: allFail ? (results[0]?.feed?.message || message) : message,
    items: finalItems.map((item, index) => ({
      ...item,
      no: index + 1,
      articleKey: item.articleKey || buildNewsArticleKey(service, item)
    }))
  };
}

async function enrichMissingNewsDates(service, items) {
  const targets = (Array.isArray(items) ? items : [])
    .filter((item) => item?.link && !String(item.date || '').trim());

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

async function getOrBuildTopicFeed(service, parseNewsFeedXml, topic) {
  const cacheKey = getTopicFeedCacheKey(topic?.door);
  const cached = await getCachedTopicFeed(service, cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = service.topicFeedInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const job = (async () => {
    const feed = await buildTopicFeed(service, parseNewsFeedXml, topic);
    await setCachedTopicFeed(service, cacheKey, feed);
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
