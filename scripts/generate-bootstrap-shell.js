'use strict';

// Generate the public TOP-menu shell from the same legacy sources used by
// the server. This lets a cold Vercel Function start in the background rather
// than deciding when the first terminal screen becomes interactive.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MenuResolver = require('../src/server/MenuResolver');
const { resolveBoardDefinitions } = require('../src/server/BoardDefinitionResolver');

const rootDir = path.resolve(__dirname, '..');
const menuFilePath = path.join(rootDir, 'legacy', 'hanulso.mnu');
const outputPath = path.join(rootDir, 'public', 'bootstrap-shell.json');
const menuSource = fs.readFileSync(menuFilePath);
const payload = {
  schemaVersion: 1,
  sourceHash: crypto.createHash('sha256').update(menuSource).digest('hex').slice(0, 16),
  menu: new MenuResolver(menuFilePath).getTree(),
  boards: resolveBoardDefinitions(menuFilePath),
  // TOP does not display counters. Dynamic stats remain available from the
  // normal API when a screen actually requests them.
  stats: {}
};
const serialized = `${JSON.stringify(payload)}\n`;

if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== serialized) {
  fs.writeFileSync(outputPath, serialized, 'utf8');
}

console.log(JSON.stringify({
  ok: true,
  output: path.relative(rootDir, outputPath),
  bytes: Buffer.byteLength(serialized),
  boards: payload.boards.length,
  topEntries: payload.menu.children.length
}));
