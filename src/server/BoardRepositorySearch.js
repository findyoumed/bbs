'use strict';

function sortPostsThreaded(posts) {
  return posts.slice().sort((left, right) => {
    if (left.family !== right.family) {
      return right.family - left.family;
    }

    if (left.orderby !== right.orderby) {
      return left.orderby - right.orderby;
    }

    return left.id - right.id;
  });
}

function normalizeSearchMode(mode) {
  return String(mode || '').trim().toLowerCase();
}

const MAX_QUERY_LENGTH = 100;

function normalizeSearchOptions(options = {}) {
  const category = String(options.search?.category || options.category || options.header || '').trim();
  const directMode = normalizeSearchMode(options.search?.mode);
  const directQuery = String(options.search?.query || '').trim().slice(0, MAX_QUERY_LENGTH);
  const k = String(options.k || '').trim();
 
  let search = null;
  if (directMode && directQuery) {
    search = { mode: directMode, query: directQuery };
  } else {
    const modes = ['lt', 'li', 'lc', 'ln', 'la', 'recent'];
    for (const mode of modes) {
      const query = String(options[mode] || '').trim().slice(0, MAX_QUERY_LENGTH);
      if (query) {
        search = { mode: normalizeSearchMode(mode), query };
        break;
      }
    }
  }
 
  if (category) {
    search = { ...(search || {}), category };
  }

  // [LOG_ID: 20260713_1020] 주제어 검색 필터 k를 search 객체에 영사
  if (k) {
    search = { ...(search || {}), k };
  }
 
  return search;
}

function containsIgnoreCase(value, query) {
  return String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
}

// [LOG_ID: 20260722_3200] 하이텔 길라잡이 책(그림 9.4, LT 명령어 설명, p.124) 실측 —
// "LT 단어1 * 단어2"는 두 단어가 모두 들어간 제목만(AND), "LT 단어1 + 단어2"는 둘 중
// 하나만 있어도(OR) 검색된다고 명시돼 있는데, 우리 LT는 지금까지 쿼리 문자열 전체를
// 하나의 부분 문자열로만 취급해 "*"/"+"가 그냥 검색어의 일부 글자처럼 처리됐다.
// AND가 OR보다 먼저 매치되면 "*"가 있는 쿼리에 "+"도 우연히 섞였을 때 애매해지므로
// 한쪽만 있을 때만 그 연산자로 해석하고, 둘 다 없거나 둘 다 있으면 원래처럼 단일 검색어로 둔다.
function parseMultiTermQuery(query) {
  const raw = String(query || '');
  const hasAnd = raw.includes('*');
  const hasOr = raw.includes('+');
  if (hasAnd && !hasOr) {
    const terms = raw.split('*').map((t) => t.trim()).filter(Boolean);
    if (terms.length > 1) return { operator: 'and', terms };
  }
  if (hasOr && !hasAnd) {
    const terms = raw.split('+').map((t) => t.trim()).filter(Boolean);
    if (terms.length > 1) return { operator: 'or', terms };
  }
  return { operator: 'single', terms: [raw] };
}

function filterPostsBySearch(posts, search) {
  let result = posts.slice();

  if (search?.category) {
    const cat = String(search.category).toLowerCase();
    result = result.filter(post => String(post.category || post.header || '').toLowerCase() === cat);
  }

  // [LOG_ID: 20260713_1020] 대괄호 안에 들어있는 주제어([k]) 필터 검사 적용
  if (search?.k) {
    const keyword = String(search.k).toLowerCase();
    result = result.filter(post => {
      const title = String(post.title || '').toLowerCase();
      return title.includes(`[${keyword}]`);
    });
  }

  if (!search?.mode || !search?.query) {
    return result;
  }

  const query = String(search.query).toLowerCase().trim();
  const mode = search.mode;

  return result.filter((post) => {
    switch (mode) {
      case 'lt': { // Title + Content, "*"(AND)/"+"(OR) 다중 검색어 지원(그림 9.4)
        const parsed = parseMultiTermQuery(query);
        const matchesTerm = (term) => containsIgnoreCase(post.title, term) || containsIgnoreCase(post.content, term);
        if (parsed.operator === 'and') return parsed.terms.every(matchesTerm);
        if (parsed.operator === 'or') return parsed.terms.some(matchesTerm);
        return matchesTerm(query);
      }
      case 'li': // ID + Nickname
        return containsIgnoreCase(post.userId, query) || containsIgnoreCase(post.nickName, query);
      case 'lc': // Content only
        return containsIgnoreCase(post.content, query);
      case 'ln': // Nickname only
        return containsIgnoreCase(post.nickName, query);
      case 'la': // All fields (Search All)
        return containsIgnoreCase(post.title, query) || 
               containsIgnoreCase(post.content, query) || 
               containsIgnoreCase(post.userId, query) || 
               containsIgnoreCase(post.nickName, query);
      case 'recent': {
        const days = Number(query) || 3;
        const ts = Date.now() - (days * 24 * 60 * 60 * 1000);
        return new Date(post.createdAt || post.created_at).getTime() >= ts;
      }
      default:
        return true;
    }
  });
}

module.exports = {
  sortPostsThreaded,
  normalizeSearchOptions,
  filterPostsBySearch,
  parseMultiTermQuery
};
