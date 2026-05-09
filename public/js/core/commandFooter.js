export function createCommandFooterUtils(deps = {}) {
  const {
    assetCache = {},
    fetchImpl = (...args) => fetch(...args),
    onCacheHit = () => {},
    onCacheMiss = () => {}
  } = deps;

  function buildAssetUrl(assetPath) {
    return '/api/assets/' + String(assetPath || '')
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  const DEFAULT_COMMAND_PROMPT = '선택 >> ';

  async function loadAssetText(assetPath) {
    const key = String(assetPath || '').trim();
    if (!key) return '';
    if (Object.prototype.hasOwnProperty.call(assetCache, key)) {
      onCacheHit(key);
      return assetCache[key];
    }

    onCacheMiss(key);

    try {
      const res = await fetchImpl(buildAssetUrl(key));
      if (!res.ok) {
        throw new Error(`asset ${res.status}`);
      }
      const text = await res.text();
      assetCache[key] = text;
      return text;
    } catch (error) {
      console.warn('footer asset load failed:', key, error?.message || error);
      assetCache[key] = '';
      return '';
    }
  }

  function stripAnsiCodes(text) {
    return String(text || '').replace(/\x1b\[[0-9;=?]*[A-Za-z]/g, '');
  }

  function parseCommandFooter(text, fallbackText = '') {
    const source = stripAnsiCodes(text || fallbackText)
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => ({ raw: line, trimmed: line.trim() }))
      .filter((line) => line.trimmed);

    if (!source.length) {
      return { hint: String(fallbackText || '').trim(), prompt: DEFAULT_COMMAND_PROMPT };
    }

    let prompt = DEFAULT_COMMAND_PROMPT;
    const hintLines = [];

    source.forEach((line) => {
      if (line.trimmed.includes('>>')) {
        prompt = line.trimmed.includes('??') ? DEFAULT_COMMAND_PROMPT : line.raw.trimStart();
        return;
      }
      hintLines.push(line.trimmed);
    });

    return {
      hint: hintLines.join(' '),
      prompt: prompt || '>>'
    };
  }

  function looksLikeCommandFooter(text) {
    const source = stripAnsiCodes(text);
    return source.includes('??/??') || source.includes('>>');
  }

  return {
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter
  };
}
