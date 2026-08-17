'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/server/RssWeatherService.js'), 'utf8');
const start = source.indexOf('function getKstDateKey');
const end = source.indexOf('function toKoreanCity');
assert(start >= 0 && end > start, 'KST date helpers should be present');

const context = { Intl, Date, globalThis: null };
context.globalThis = context;
vm.runInNewContext(
  `${source.slice(start, end)}\nglobalThis.getKstDateKey = getKstDateKey; globalThis.formatKstForecastDay = formatKstForecastDay;`,
  context,
  { filename: 'RssWeatherService.js' }
);

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
assert.strictEqual(
  context.getKstDateKey(new Date('2026-08-16T15:00:00Z')),
  '2026-08-17',
  '한국시간 자정 경계는 서버 UTC 날짜가 아니라 KST 날짜를 사용해야 한다'
);
assert.strictEqual(
  context.formatKstForecastDay('2026-08-16', '2026-08-17', weekdays),
  '08/16(일)',
  '이전 날짜가 현재 날짜로 잘못 표시되면 안 된다'
);
assert.strictEqual(
  context.formatKstForecastDay('2026-08-17', '2026-08-17', weekdays),
  '08/17(월) 오늘'
);
assert.strictEqual(
  context.formatKstForecastDay('2026-08-18', '2026-08-17', weekdays),
  '08/18(화) 내일'
);

console.log(JSON.stringify({ ok: true, checked: ['KST boundary', 'previous day', 'today', 'tomorrow'] }));
