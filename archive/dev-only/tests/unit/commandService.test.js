'use strict';

const fs = require('fs');
const path = require('path');

const codePath = path.resolve(__dirname, '../../../../public/js/core/commandService.js');
const code = fs.readFileSync(codePath, 'utf8')
  .replace('export const CMD_META =', 'const CMD_META =')
  .replace('export function getCommandMatches', 'function getCommandMatches')
  .replace('export function getBestMatch', 'function getBestMatch')
  .replace('export function getCommandDesc', 'function getCommandDesc')
  .replace('export function isValidCommand', 'function isValidCommand')
  .replace('export function createCommandService', 'function createCommandService');

const mockContext = {
  CMD_META: null,
  createCommandService: null,
  getBestMatch: null,
  getCommandMatches: null
};

// [LOG: 20260425_2358] commandService ESM을 CommonJS 단위 테스트에서 직접 검증한다.
eval(
  code
  + '; mockContext.CMD_META = CMD_META;'
  + ' mockContext.getCommandMatches = getCommandMatches;'
  + ' mockContext.getBestMatch = getBestMatch;'
  + ' mockContext.createCommandService = createCommandService;'
);

const {
  CMD_META,
  createCommandService,
  getBestMatch,
  getCommandMatches
} = mockContext;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);   
  }
}

console.log('Running commandService tests...');

assert(CMD_META.H && CMD_META.HELP, 'CMD_META should expose core command metadata');
assertEqual(getCommandMatches('').length, 0, 'empty prefixes should return no matches');
assertEqual(getCommandMatches('   ').length, 0, 'blank prefixes should return no matches after trim');

const mMatches = getCommandMatches('m');
assert(mMatches.includes('M'), 'single-letter prefixes should include exact matches');
assert(mMatches.includes('ME'), 'single-letter prefixes should include longer matches');
assert(mMatches.includes('MEMO'), 'single-letter prefixes should include memo aliases');
assert(mMatches.includes('MYINFO'), 'single-letter prefixes should include myinfo aliases');

const cMatches = getCommandMatches('c');
assertEqual(cMatches[0], 'C', 'exact matches should be ranked first');
assertEqual(cMatches[1], 'CHANGE', 'higher priority matches should rank ahead of lower priority aliases');
// [LOG: 20260430_1020] VFS 명령어(CP, CAT 등) 추가로 인해 순위가 밀릴 수 있으므로 존재 여부만 확인하거나 순위를 조정함
assert(cMatches.indexOf('COLOR') > 1, 'lower priority aliases should be present after higher priority ones');

assertEqual(getBestMatch('go'), 'GO', 'exact matches should be preserved');     
assertEqual(getBestMatch('he'), 'HELP', 'prefix matches should return the shortest valid command');
assertEqual(getBestMatch(' ch '), 'CHANGE', 'trimmed prefixes should still resolve correctly');
assertEqual(getBestMatch('mem'), 'MEMO', 'longer prefixes should resolve to the expected command');
assertEqual(getBestMatch('zz'), null, 'unknown prefixes should return null');   

const guestService = createCommandService({
  state: {
    user: { isGuest: true }
  }
});
assertEqual(guestService.isCommandAvailable('ME'), false, 'guest users should not see login-required commands');
assertEqual(guestService.isCommandAvailable('H'), true, 'public commands should remain available to guests');
assertEqual(guestService.isCommandAvailable('UNKNOWN'), false, 'unknown commands should be unavailable');

const memberService = createCommandService({
  state: {
    user: { isGuest: false }
  }
});
assertEqual(memberService.isCommandAvailable('ME'), true, 'logged-in users should see memo commands');
assertEqual(memberService.isCommandAvailable('LOGIN'), true, 'non-login-gated commands should still be available');

const fallbackService = createCommandService();
assertEqual(fallbackService.isCommandAvailable('H'), true, 'services without state should still expose public commands');
assertEqual(fallbackService.isCommandAvailable('ME'), false, 'services without user state should default login-required commands to unavailable');

console.log('commandService tests passed!');
