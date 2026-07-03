'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const AssetManager = require('../../../../src/core/AssetManager');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bbs-asset-manager-'));
const originalConsoleError = console.error;
const capturedErrors = [];

try {
  console.error = (...args) => {
    capturedErrors.push(args.map((value) => String(value)).join(' '));
  };

  fs.mkdirSync(path.join(tmpRoot, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, 'sample.txt'), 'sample body', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'nested', 'hello.txt'), 'nested body', 'utf8');

  const assetManager = new AssetManager(tmpRoot);

  assert(assetManager.exists('sample.txt') === true, 'exists should find direct files');
  assert(assetManager.exists('/sample.txt') === true, 'exists should ignore leading slash');
  assert(assetManager.exists('txt/sample.txt') === true, 'exists should ignore txt/ prefix');
  assert(assetManager.exists('nested\\hello.txt') === true, 'exists should normalize Windows separators');
  assert(assetManager.exists('../sample.txt') === false, 'exists should reject parent traversal');
  assert(assetManager.exists('') === false, 'exists should reject empty paths');

  Promise.resolve()
    .then(() => assetManager.getAsset('txt/sample.txt'))
    .then((content) => {
      assert(content === 'sample body', 'getAsset should read normalized txt/ paths');
      return assetManager.getAsset('nested\\hello.txt');
    })
    .then((nestedContent) => {
      assert(nestedContent === 'nested body', 'getAsset should read normalized nested paths');
      return assetManager.getAsset('../missing.txt');
    })
    .then((missingContent) => {
      assert(
        /\[Error loading asset: \.\.\/missing\.txt\]/.test(missingContent),
        'getAsset should return a readable fallback on invalid or missing paths'
      );
      assert(capturedErrors.length === 1, 'invalid paths should still be reported once via console.error');
    })
    .finally(() => {
      console.error = originalConsoleError;
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });
} catch (error) {
  console.error = originalConsoleError;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  throw error;
}
