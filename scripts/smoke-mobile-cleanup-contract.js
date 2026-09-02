/**
 * Static contract for mobile smoke resource cleanup.
 * Failure must unwind through finally so the browser and local server close.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, 'smoke-mobile-viewports.js'),
  'utf8'
);
const runStart = source.indexOf('async function runMobileSmokeTests()');
const finallyStart = source.indexOf('  } finally {', runStart);
assert(runStart >= 0 && finallyStart > runStart, 'mobile smoke should have a discoverable try/finally boundary');

const runBeforeFinally = source.slice(runStart, finallyStart);
const cleanupFinally = source.slice(finallyStart, source.indexOf('\n  }\n}', finallyStart));

assert(/let browser\s*=\s*null/.test(runBeforeFinally), 'mobile smoke should retain browser handle for cleanup');
assert(/if \(errors\.length > 0\)[\s\S]*throw new Error\(`Mobile smoke failed/.test(runBeforeFinally), 'failure should throw after recording errors');
assert(!/process\.exit\(/.test(runBeforeFinally), 'runMobileSmokeTests should not exit before finally cleanup');
assert(/await browser\.close\(\)\.catch\(\(\) => \{\}\)/.test(cleanupFinally), 'finally should close the browser');
assert(/serverProcess\.kill\(\)/.test(cleanupFinally), 'finally should stop the local server');
assert(/runMobileSmokeTests\(\)\.catch\([\s\S]*process\.exit\(1\)/.test(source), 'top-level catch should preserve a failing exit code');

console.log('Mobile smoke cleanup contract checks passed.');
