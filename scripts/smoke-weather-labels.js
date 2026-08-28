'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadWeatherBuilders() {
  const root = path.resolve(__dirname, '..');
  const utilsSource = fs.readFileSync(path.join(root, 'public/js/core/ansiBuilderUtils.js'), 'utf8')
    .replace('export function createAnsiBuilderUtils', 'function createAnsiBuilderUtils');
  const weatherSource = fs.readFileSync(path.join(root, 'public/js/core/weatherAnsiBuilders.js'), 'utf8')
    .replace("import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';", '')
    .replace('export function createWeatherAnsiBuilders', 'function createWeatherAnsiBuilders');

  const context = { console, window: { innerWidth: 390 }, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(utilsSource + '\n' + weatherSource + '\nglobalThis.createWeatherAnsiBuilders = createWeatherAnsiBuilders;', context, {
    filename: 'weatherAnsiBuilders.js'
  });

  const displayWidth = (text) => Array.from(String(text || '')).reduce(
    (total, ch) => total + (/[^\u0000-\u007f]/.test(ch) ? 2 : 1),
    0
  );
  return context.createWeatherAnsiBuilders({
    displayWidth,
    isWideChar: (ch) => /[^\u0000-\u007f]/.test(ch),
    buildPageLabel: () => '(01/01)',
    buildTopHeader: () => ''
  });
}

const stripAnsi = (value) => String(value || '').replace(/\x1b\[[0-9=;]*[A-Za-z]/g, '');
const builders = loadWeatherBuilders();
const rendered = stripAnsi(builders.buildLocalWeatherAnsi({
  city: '고양',
  days: [
    { day: '08/16(일) 오늘', weather: '약한 비', high: '22', low: '20', rainProbability: '98%' },
    { day: '08/17(월) 내일', weather: '구름 조금', high: '30', low: '22', rainProbability: '44%' }
  ]
}));

assert(/08\/16\(일\)\s+약한 비/.test(rendered), '오늘 접미사가 날씨 칸으로 흘러가면 안 된다');
assert(/08\/17\(월\)\s+구름 조금/.test(rendered), '내일 접미사가 날씨 칸으로 흘러가면 안 된다');
assert(!rendered.includes('오약한 비'), '날짜 접미사 오가 날씨명 앞에 남아 있다');
assert(!rendered.includes('내구름 조금'), '날짜 접미사 내가 날씨명 앞에 남아 있다');
console.log(JSON.stringify({ ok: true, checked: ['오늘', '내일'] }));
