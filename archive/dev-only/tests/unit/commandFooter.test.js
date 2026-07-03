'use strict';

const fs = require('fs');
const path = require('path');

const codePath = path.resolve(__dirname, '../../../../public/js/core/commandFooter.js');
const code = fs.readFileSync(codePath, 'utf8')
  .replace('export function createCommandFooterUtils', 'function createCommandFooterUtils');

const mockContext = {
  createCommandFooterUtils: null
};

eval(code + '; mockContext.createCommandFooterUtils = createCommandFooterUtils;');

const { createCommandFooterUtils } = mockContext;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('Running commandFooter tests...');

module.exports = (async () => {
  const assetCache = {};
  const cacheStats = { hits: 0, misses: 0 };
  let fetchCalls = 0;

  const utils = createCommandFooterUtils({
    assetCache,
    onCacheHit: () => { cacheStats.hits += 1; },
    onCacheMiss: () => { cacheStats.misses += 1; },
    fetchImpl: async (url) => {
      fetchCalls += 1;
      return {
        ok: true,
        text: async () => `footer:${url}`
      };
    }
  });

  const firstLoad = await utils.loadAssetText('txt/cmd_menu_footer.txt');
  const secondLoad = await utils.loadAssetText('txt/cmd_menu_footer.txt');

  assert(fetchCalls === 1, 'loadAssetText should cache successful footer asset responses');
  assert(cacheStats.misses === 1, 'first footer asset load should count as a cache miss');
  assert(cacheStats.hits === 1, 'second footer asset load should count as a cache hit');
  assert(firstLoad === secondLoad, 'cached footer asset text should match the first load');
  assert(firstLoad.includes('/api/assets/txt/cmd_menu_footer.txt'), 'asset URL should be built from the encoded asset path');

  const originalWarn = console.warn;
  const capturedWarns = [];
  console.warn = (...args) => {
    capturedWarns.push(args.join(' '));
  };

  try {
    const failedCache = {};
    let failedFetchCalls = 0;
    const failedUtils = createCommandFooterUtils({
      assetCache: failedCache,
      fetchImpl: async () => {
        failedFetchCalls += 1;
        return {
          ok: false,
          status: 404,
          text: async () => ''
        };
      }
    });

    const failedFirst = await failedUtils.loadAssetText('txt/missing_footer.txt');
    const failedSecond = await failedUtils.loadAssetText('txt/missing_footer.txt');

    assert(failedFirst === '', 'failed footer asset loads should fall back to empty text');
    assert(failedSecond === '', 'failed footer asset loads should stay cached as empty text');
    assert(failedFetchCalls === 1, 'failed footer asset loads should also be cached');
    assert(capturedWarns.length === 1, 'failed footer asset loads should warn exactly once');
    assert(capturedWarns[0].includes('footer asset load failed:'), 'failed footer asset loads should emit a readable warning');
  } finally {
    console.warn = originalWarn;
  }

  const parsed = utils.parseCommandFooter('\u001b[37m번호/명령(P:상위,H:도움말)\n>>\u001b[0m');
  assert(parsed.hint === '번호/명령(P:상위,H:도움말)', 'parseCommandFooter should strip ANSI codes from hint text');
  assert(parsed.prompt === '>>', 'parseCommandFooter should keep the prompt marker');

  const fallbackParsed = utils.parseCommandFooter('', '기본 힌트');
  assert(fallbackParsed.hint === '기본 힌트', 'parseCommandFooter should use fallback text when the footer is empty');
  assert(utils.looksLikeCommandFooter('안내문\n>>') === true, 'looksLikeCommandFooter should detect prompt-based footers');
  assert(utils.looksLikeCommandFooter('안내문만 있음') === false, 'looksLikeCommandFooter should reject plain text');

  console.log('commandFooter tests passed!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
