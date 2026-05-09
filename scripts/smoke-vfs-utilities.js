/**
 * [LOG: 20260502_0130] Smoke test for VFS Utilities (WC, SORT, UNIQ)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { assert } = require('./lib/scriptUtils');

// 1. Check if files exist
const vfsRouterPath = path.join(__dirname, '../public/js/core/commandRouterVfs.js');
assert(fs.existsSync(vfsRouterPath), 'commandRouterVfs.js should exist');

// 2. Check if commandService.js is updated
const cmdServicePath = path.join(__dirname, '../public/js/core/commandService.js');
const cmdServiceContent = fs.readFileSync(cmdServicePath, 'utf8');
assert(cmdServiceContent.includes('WC:'), 'CMD_META should include WC');
assert(cmdServiceContent.includes('SORT:'), 'CMD_META should include SORT');
assert(cmdServiceContent.includes('UNIQ:'), 'CMD_META should include UNIQ');

// 3. Check if appFactory.js is updated
const appFactoryPath = path.join(__dirname, '../public/js/core/appFactory.js');
const appFactoryContent = fs.readFileSync(appFactoryPath, 'utf8');
assert(appFactoryContent.includes('createVfsCommandHandler'), 'appFactory.js should import createVfsCommandHandler');
assert(appFactoryContent.includes('handleVfsCommand'), 'appFactory.js should initialize handleVfsCommand');

// 4. Check if commandDispatcher.js is updated
const dispatcherPath = path.join(__dirname, '../public/js/core/commandDispatcher.js');
const dispatcherContent = fs.readFileSync(dispatcherPath, 'utf8');
assert(dispatcherContent.includes('handleVfsCommand'), 'commandDispatcher.js should include handleVfsCommand in pipeline');

console.log(JSON.stringify({ ok: true, message: 'VFS Utilities smoke tests passed' }, null, 2));
