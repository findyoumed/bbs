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

  let search = null;
  if (directMode && directQuery) {
    search = { mode: directMode, query: directQuery };
  } else {
    const modes = ['lt', 'li', 'lc', 'ln', 'la'];
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

  return search;
}

function containsIgnoreCase(value, query) {
  return String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
}

function filterPostsBySearch(posts, search) {
  let result = posts.slice();

  if (search?.category) {
    const cat = String(search.category).toLowerCase();
    result = result.filter(post => String(post.category || post.header || '').toLowerCase() === cat);
  }

  if (!search?.mode || !search?.query) {
    return result;
  }

  const query = String(search.query).toLowerCase().trim();
  const mode = search.mode;

  return result.filter((post) => {
    switch (mode) {
      case 'lt': // Title + Content
        return containsIgnoreCase(post.title, query) || containsIgnoreCase(post.content, query);
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
      default:
        return true;
    }
  });
}

module.exports = {
  sortPostsThreaded,
  normalizeSearchOptions,
  filterPostsBySearch
};
