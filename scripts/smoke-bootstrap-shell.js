'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const MenuResolver = require('../src/server/MenuResolver');
const { resolveBoardDefinitions } = require('../src/server/BoardDefinitionResolver');
const { assert } = require('./lib/scriptUtils');

const rootDir = path.resolve(__dirname, '..');
const menuFilePath = path.join(rootDir, 'legacy', 'hanulso.mnu');
const shellPath = path.join(rootDir, 'public', 'bootstrap-shell.json');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function main() {
  assert(fs.existsSync(shellPath), 'bootstrap shell should be generated in public');
  const shell = JSON.parse(fs.readFileSync(shellPath, 'utf8'));
  const source = fs.readFileSync(menuFilePath);
  const sourceHash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
  const expectedMenu = new MenuResolver(menuFilePath).getTree();
  const expectedBoards = resolveBoardDefinitions(menuFilePath);
  const navigation = read('public/js/core/menuNavigation.js');
  const app = read('public/js/app.js');

  assert(shell.schemaVersion === 1, 'bootstrap shell schema version should be supported');
  assert(shell.sourceHash === sourceHash, 'bootstrap shell should match the current legacy menu source');
  assert(JSON.stringify(shell.menu) === JSON.stringify(expectedMenu), 'bootstrap shell menu should match MenuResolver output');
  assert(JSON.stringify(shell.boards) === JSON.stringify(expectedBoards), 'bootstrap shell boards should match resolver output');
  assert(navigation.includes("fetch('/bootstrap-shell.json'"), 'navigation should load the public bootstrap shell first');
  assert(navigation.includes("apiFetch('/api/bootstrap', { silent: true })"), 'navigation should refresh live bootstrap data in the background');
  assert(navigation.includes('hydrateBoards(liveBootstrap.boards)'), 'live bootstrap refresh should update the board index');
  assert(app.includes('await authReady;\n      await restoreStateFromURL();'), 'non-root routes should wait for authentication before restoring state');
  assert(app.includes('await showMain();\n      void authReady.then'), 'root route should render before background authentication completes');

  console.log(JSON.stringify({
    ok: true,
    sourceHash,
    boardCount: shell.boards.length,
    topEntries: shell.menu.children.length,
    staticFirst: true
  }));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
