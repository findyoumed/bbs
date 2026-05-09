'use strict';

function matchRoute(requestMethod, pathname, method, pattern) {
  if (requestMethod !== method) return null;

  if (typeof pattern === 'string') {
    if (pattern.includes(':')) {
      const regexPattern = pattern.replace(/:([^/]+)/g, '(?<$1>[^/]+)');
      const regex = new RegExp(`^${regexPattern}$`);
      const match = pathname.match(regex);
      if (match) {
        const params = match.groups ? { ...match.groups } : {};
        for (const key in params) {
          params[key] = decodeURIComponent(params[key]);
        }
        return params;
      }
      return null;
    }

    return pathname === pattern ? {} : null;
  }

  if (pattern instanceof RegExp) {
    const match = pathname.match(pattern);
    if (match) {
      return match.length > 1 ? match : {};
    }
  }

  return null;
}

module.exports = {
  matchRoute
};
