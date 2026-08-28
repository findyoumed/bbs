'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/server/RssWeatherService.js'), 'utf8');
const start = source.indexOf('function isPrivateClientIp');
const end = source.indexOf('function getKstDateKey');
assert(start >= 0 && end > start, 'private IP helper should be present');

const context = { globalThis: null };
context.globalThis = context;
vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.isPrivateClientIp = isPrivateClientIp;`, context);

for (const ip of ['', '127.0.0.1', '::1', '10.20.30.40', '172.16.0.1', '172.31.255.255', '192.168.1.20', '169.254.1.2', '::ffff:192.168.1.20', 'fd00::1']) {
  assert.strictEqual(context.isPrivateClientIp(ip), true, `${ip || '(empty)'} should use server geolocation`);
}
for (const ip of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '172.100.20.1', '1.1.1.1']) {
  assert.strictEqual(context.isPrivateClientIp(ip), false, `${ip} should be sent to IP geolocation`);
}

console.log(JSON.stringify({ ok: true, checked: 16 }));
