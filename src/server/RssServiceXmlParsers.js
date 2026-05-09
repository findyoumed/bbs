'use strict';

function parseWeatherMenuXml(xml) {
  const items = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const rawItem of itemMatches) {
    items.push({
      door: readTag(rawItem, 'door'),
      province: readTag(rawItem, 'province'),
      rss: readTag(rawItem, 'rss'),
      lat: readTag(rawItem, 'lat'),
      lon: readTag(rawItem, 'lon')
    });
  }
  return { items };
}

function parseNewsMenuXml(xml) {
  const newspapers = [];
  const paperMatches = xml.match(/<newspaper\b[^>]*>[\s\S]*?<\/newspaper>/g) || [];
  for (const rawPaper of paperMatches) {
    const categories = [];
    const categoryMatches = rawPaper.match(/<category>[\s\S]*?<\/category>/g) || [];
    for (const rawCategory of categoryMatches) {
      categories.push({
        door: readTag(rawCategory, 'door'),
        name: readTag(rawCategory, 'name'),
        rss: readTag(rawCategory, 'rss')
      });
    }
    newspapers.push({
      door: readAttr(rawPaper, 'door'),
      name: readAttr(rawPaper, 'name'),
      categories
    });
  }
  return { newspapers };
}

function parseNewsFeedXml(xml) {
  const items = [];
  const itemMatches = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/g) || [];
  let no = 1;
  for (const rawItem of itemMatches) {
    const title = cleanFeedText(readTag(rawItem, 'title'));
    if (!title) {
      continue;
    }

    const description = cleanHtmlToText(readTag(rawItem, 'description'));
    const body = pickLongestText([
      cleanHtmlToText(readTag(rawItem, 'content:encoded')),
      cleanHtmlToText(readTag(rawItem, 'content')),
      cleanHtmlToText(readTag(rawItem, 'encoded')),
      cleanHtmlToText(readTag(rawItem, 'media:description')),
      description
    ]);

    const link = cleanFeedText(readTag(rawItem, 'link'));
    if (isNonArticleNewsFeedItem({ title, link, description, body })) {
      continue;
    }

    const date = cleanFeedText(readFirstTag(rawItem, ['pubDate', 'dc:date', 'date', 'updated', 'published']));
    const normalizedDate = normalizeNewsDate(date || deriveDateFromUrl(link));
    items.push({
      no,
      author: cleanFeedText(readTag(rawItem, 'author')),
      title,
      link,
      description,
      body,
      date: normalizedDate.date,
      dateTime: normalizedDate.dateTime,
      imageUrl: extractNewsImageUrl(rawItem)
    });
    no += 1;
  }
  return { items };
}

function isNonArticleNewsFeedItem(item) {
  const title = cleanFeedText(item?.title);
  const link = cleanFeedText(item?.link);
  const text = cleanFeedText(`${item?.description || ''} ${item?.body || ''}`);

  if (/^(검색\s*결과|search\s*results)\s*[-:：]/i.test(title)) {
    return true;
  }

  if (/comprehensive\s+up-to-date\s+news\s+coverage/i.test(text)
    && /aggregated\s+from\s+sources\s+all\s+over\s+the\s+world\s+by\s+google\s+news/i.test(text)) {
    return true;
  }

  return /^https?:\/\/news\.google\.com\/rss\/articles\//i.test(link)
    && /google\s+news/i.test(title)
    && !/(?:\s-\s|[|｜])\S/.test(title);
}

function extractNewsImageUrl(rawItem) {
  const tagUrl = readTag(rawItem, 'image') || readTag(rawItem, 'thumbnail');
  const attrUrl = readFirstTagAttr(rawItem, ['media:content', 'media:thumbnail', 'enclosure'], ['url', 'href']);
  const htmlUrl = readFirstHtmlImageUrl([
    readTag(rawItem, 'description'),
    readTag(rawItem, 'content:encoded'),
    readTag(rawItem, 'content'),
    readTag(rawItem, 'encoded')
  ]);
  return normalizeImageUrl(attrUrl || tagUrl || htmlUrl);
}

function readFirstTagAttr(source, tagNames, attrNames) {
  for (const tagName of tagNames || []) {
    const escapedTag = escapeRegExp(tagName);
    const tagMatches = String(source || '').match(new RegExp(`<${escapedTag}\\b[^>]*>`, 'gi')) || [];
    for (const rawTag of tagMatches) {
      for (const attrName of attrNames || []) {
        const value = readAttr(rawTag, attrName);
        if (value) {
          return value;
        }
      }
    }
  }
  return '';
}

function readFirstHtmlImageUrl(values) {
  for (const value of values || []) {
    const match = String(value || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    if (match?.[1]) {
      return decodeXmlEntities(match[1]);
    }
  }
  return '';
}

function normalizeImageUrl(value) {
  const source = cleanFeedText(value);
  if (!source) {
    return '';
  }
  if (/^\/\//.test(source)) {
    return `https:${source}`;
  }
  if (/^https?:\/\//i.test(source)) {
    return source;
  }
  return '';
}

function deriveDateFromUrl(value) {
  const source = String(value || '');
  const separated = source.match(/(?:^|[^\d])((?:19|20)\d{2})[\/._-]([01]\d)[\/._-]([0-3]\d)(?:[^\d]|$)/);
  if (separated) {
    return formatUrlDate(separated[1], separated[2], separated[3]);
  }

  const compact = source.match(/((?:19|20)\d{2})([01]\d)([0-3]\d)/);
  if (compact) {
    return formatUrlDate(compact[1], compact[2], compact[3]);
  }

  return '';
}

function formatUrlDate(year, month, day) {
  const yyyy = Number(year);
  const mm = Number(month);
  const dd = Number(day);
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) {
    return '';
  }
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (date.getUTCFullYear() !== yyyy || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) {
    return '';
  }
  return `${year}-${month}-${day}`;
}

function parseWeatherFeedXml(xml) {
  const items = [];
  const bodyMatch = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : xml;
  const dataMatches = source.match(/<data\b[^>]*>[\s\S]*?<\/data>/g) || [];

  for (const rawData of dataMatches) {
    const hour = cleanFeedText(readTag(rawData, 'hour'));
    const day = normalizeWeatherDay(readTag(rawData, 'day'));
    const temp = numberOrBlank(readTag(rawData, 'temp'));
    const high = numberOrBlank(readTag(rawData, 'tmx'));
    const low = numberOrBlank(readTag(rawData, 'tmn'));
    const rain = cleanFeedText(readTag(rawData, 'pop'));
    const weather = cleanFeedText(readTag(rawData, 'wfKor'));
    const windDirection = cleanFeedText(readTag(rawData, 'wdKor'));
    const windSpeed = cleanFeedText(readTag(rawData, 'ws'));

    items.push({
      hour: hour ? `${hour}시` : '',
      day,
      temperature: temp,
      high,
      low,
      weather,
      rainProbability: rain ? `${rain}%` : '',
      windDirection,
      windSpeed: windSpeed ? `${Math.round(Number(windSpeed) || 0)}` : ''
    });
  }

  return { items };
}

function readTag(source, tagName) {
  const match = source.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXmlEntities(String(match[1] || '').trim()) : '';
}

function readFirstTag(source, tagNames) {
  for (const tagName of tagNames || []) {
    const value = readTag(source, tagName);
    if (value) {
      return value;
    }
  }
  return '';
}

function readAttr(source, attrName) {
  const match = source.match(new RegExp(`${escapeRegExp(attrName)}=["']([^"']*)["']`, 'i'));
  return match ? decodeXmlEntities(String(match[1] || '').trim()) : '';
}

function cleanFeedText(value) {
  return decodeXmlEntities(String(value || ''))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHtmlToText(value) {
  return decodeXmlEntities(String(value || ''))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pickLongestText(values) {
  return (values || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0] || '';
}

function decodeXmlEntities(value) {
  const named = {
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    middot: '·',
    hellip: '...',
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
    ndash: '-',
    mdash: '-'
  };
  let result = String(value || '');
  for (let i = 0; i < 4; i += 1) {
    const next = result
      .replace(/&#(\d+);/g, (_, code) => {
        const point = Number(code);
        return Number.isFinite(point) ? String.fromCodePoint(point) : _;
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
        const point = Number.parseInt(code, 16);
        return Number.isFinite(point) ? String.fromCodePoint(point) : _;
      })
      .replace(/&([a-z]+);/gi, (match, name) => named[String(name || '').toLowerCase()] ?? match);
    if (next === result) {
      break;
    }
    result = next;
  }

  // [LOG: 20260504_2010] 일부 RSS가 &를 제거한 채 quot;/hellip; 형태로 내려주는 제목을 보정한다.
  return result.replace(/\b(lt|gt|amp|quot|apos|nbsp|middot|hellip|lsquo|rsquo|ldquo|rdquo|ndash|mdash);/gi, (match, name) => {
    return named[String(name || '').toLowerCase()] ?? match;
  });
}

function normalizeNewsDate(value) {
  const source = cleanFeedText(value);
  if (!source) {
    return { date: '', dateTime: '' };
  }

  const normalized = source
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const ymdMatch = normalized.match(/((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymdMatch) {
    return buildNewsDateParts(
      ymdMatch[1],
      ymdMatch[2],
      ymdMatch[3],
      ymdMatch[4],
      ymdMatch[5],
      ymdMatch[6]
    );
  }

  const koreanMatch = source.match(/((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (koreanMatch) {
    return buildNewsDateParts(
      koreanMatch[1],
      koreanMatch[2],
      koreanMatch[3],
      koreanMatch[4],
      koreanMatch[5],
      koreanMatch[6]
    );
  }

  const parsed = new Date(source);
  if (!Number.isNaN(parsed.getTime())) {
    return buildNewsDateParts(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate(),
      parsed.getHours(),
      parsed.getMinutes(),
      parsed.getSeconds()
    );
  }

  return { date: '', dateTime: '' };
}

function buildNewsDateParts(year, month, day, hour = '', minute = '', second = '') {
  const yyyy = Number(year);
  const mm = Number(month);
  const dd = Number(day);
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) {
    return { date: '', dateTime: '' };
  }
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (date.getUTCFullYear() !== yyyy || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) {
    return { date: '', dateTime: '' };
  }

  const dateText = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const hh = String(hour || '').trim();
  const min = String(minute || '').trim();
  if (!hh || !min) {
    return { date: dateText, dateTime: dateText };
  }
  const ss = String(second || '00').trim();
  return {
    date: dateText,
    dateTime: `${dateText}T${String(Number(hh)).padStart(2, '0')}:${String(Number(min)).padStart(2, '0')}:${String(Number(ss)).padStart(2, '0')}`
  };
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWeatherDay(value) {
  const offset = Number(String(value || '').trim());
  if (!Number.isFinite(offset) || offset < 0) return String(value || '').trim();

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const target = new Date();
  target.setDate(target.getDate() + offset);
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const dayName = WEEKDAYS[target.getDay()];
  const suffix = offset === 0 ? ' 오늘' : offset === 1 ? ' 내일' : offset === 2 ? ' 모레' : '';
  return `${mm}/${dd}(${dayName})${suffix}`;
}

function numberOrBlank(value) {
  const numeric = Number(String(value || '').trim());
  if (!Number.isFinite(numeric) || numeric === -999) {
    return '';
  }
  return String(Math.round(numeric));
}

module.exports = {
  normalizeNewsDate,
  parseNewsFeedXml,
  parseNewsMenuXml,
  parseWeatherFeedXml,
  parseWeatherMenuXml
};
