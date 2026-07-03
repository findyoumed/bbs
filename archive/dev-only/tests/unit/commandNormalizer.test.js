'use strict';

const fs = require('fs');
const path = require('path');

const commandServicePath = path.resolve(__dirname, '../../../../public/js/core/commandService.js');
const commandServiceCode = fs.readFileSync(commandServicePath, 'utf8')
  .replace('export const CMD_META =', 'const CMD_META =')
  .replace('export function getCommandMatches', 'function getCommandMatches')
  .replace('export function getBestMatch', 'function getBestMatch')
  .replace('export function getCommandDesc', 'function getCommandDesc')
  .replace('export function isValidCommand', 'function isValidCommand')
  .replace('export function createCommandService', 'function createCommandService');

const codePath = path.resolve(__dirname, '../../../../public/js/core/commandNormalizer.js');
const code = fs.readFileSync(codePath, 'utf8')
  .replace(/import\s+[\s\S]*?from\s+['"].\/commandService\.js['"];?\s*/g, '')
  .replace('export function', 'function');

// Mock state and global scope
const mockContext = {
  normalizeCommand: null
};

// [LOG: 20260425_2358] commandNormalizer 테스트가 commandService import 변경을 따라가도록 보정한다.
eval(commandServiceCode + '\n' + code + '; mockContext.normalizeCommand = normalizeCommand;');

const { normalizeCommand } = mockContext;

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

// Tests
console.log('Running commandNormalizer tests...');

// 1. Basic normalization (Korean typos)
assertEqual(normalizeCommand('ㅣ', 'main'), 'L', 'ㅣ should be L');
assertEqual(normalizeCommand('ㅅ', 'main'), 'T', 'ㅅ should be T');
assertEqual(normalizeCommand('ㅕㄴㄷㄱ', 'main'), 'USER', 'ㅕㄴㄷㄱ should be USER');
assertEqual(normalizeCommand('   ls   ', 'main'), 'LS', 'trimmed LS should remain LS on main screen');
assertEqual(normalizeCommand('', 'main'), '', 'empty command should remain empty');

// 2. Global search command normalization
assertEqual(normalizeCommand('/안녕', 'main'), '/안녕', '/ should be preserved');
assertEqual(normalizeCommand('find hello', 'main'), 'FIND hello', 'find should be capitalized');
assertEqual(normalizeCommand('/ㅁ', 'main'), '/Q', '/ㅁ should normalize to /Q');
assertEqual(normalizeCommand('/균ㅆ', 'main'), '/QUIT', '/균ㅆ should normalize to /QUIT');

// 3. Screen specific normalization
assertEqual(normalizeCommand('dir', 'board-select'), 'L', 'DIR should be L on list screens');
assertEqual(normalizeCommand('SW query', 'post-list'), 'LT query', 'SW should be LT in post-list');
assertEqual(normalizeCommand('SI writer', 'post-list'), 'LI writer', 'SI should be LI in post-list');
assertEqual(normalizeCommand('SN writer', 'post-list'), 'LI writer', 'SN should be LI in post-list');
assertEqual(normalizeCommand('LN writer', 'post-list'), 'LI writer', 'LN should be LI in post-list');
assertEqual(normalizeCommand('SW query', 'main'), 'SW query', 'SW should NOT be LT in main');
assertEqual(normalizeCommand('ls', 'post-view'), 'LS', 'LS should stay LS outside list screens');

// 4. Combined typo and args
assertEqual(normalizeCommand('ㅌㅊㅣ query', 'post-list'), 'LT query', 'ㅌㅊㅣ should be LT');
assertEqual(normalizeCommand('[', 'news-list'), 'N', '[ should map to N');
assertEqual(normalizeCommand('[[', 'news-list'), 'N', '[[ should map to N');
assertEqual(normalizeCommand(']', 'news-list'), 'A', '] should map to A');

console.log('commandNormalizer tests passed!');
