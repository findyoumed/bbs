/**
 * [LOG: 20260417_1815] Command parity smoke checks
 */
'use strict';

const { assert } = require('./lib/scriptUtils');

function normalizeCommand(rawCmd, stateScreen) {
  if (!rawCmd) return rawCmd;

  let cmd = String(rawCmd).trim().toUpperCase();

  if (cmd === ']') cmd = 'A';
  if (cmd === '[') cmd = 'N';

  const isListScreen = [
    'main',
    'board-select',
    'post-list',
    'weather-menu',
    'news-menu',
    'news-list',
    'chat-lobby',
    'memos-list'
  ].includes(stateScreen);

  if (isListScreen) {
    if (cmd === 'DIR') cmd = 'L';
    if (cmd === 'LS') cmd = 'P';
  }

  if (stateScreen === 'post-list') {
    if (cmd.startsWith('SW ')) cmd = cmd.replace(/^SW\s+/, 'LT ');
    if (cmd.startsWith('SI ')) cmd = cmd.replace(/^SI\s+/, 'LI ');
    if (cmd.startsWith('SN ')) cmd = cmd.replace(/^SN\s+/, 'LI ');
    if (cmd.startsWith('LN ')) cmd = cmd.replace(/^LN\s+/, 'LI ');
    if (cmd === 'SW') cmd = 'LT';
    if (cmd === 'SI' || cmd === 'SN' || cmd === 'LN') cmd = 'LI';
  }

  return cmd;
}

assert(normalizeCommand('DIR', 'post-list') === 'L', 'DIR should map to L');
assert(normalizeCommand('LS', 'board-select') === 'P', 'LS should map to P');
assert(normalizeCommand('N', 'post-list') === 'N', 'N should stay N on post-list');
assert(normalizeCommand(']', 'post-view') === 'A', '] should map to A');
assert(normalizeCommand('[', 'post-view') === 'N', '[ should map to N');
assert(normalizeCommand('SW title', 'post-list') === 'LT TITLE', 'SW should map to LT');
assert(normalizeCommand('SI writer', 'post-list') === 'LI WRITER', 'SI should map to LI');
assert(normalizeCommand('SN writer', 'post-list') === 'LI WRITER', 'SN should map to LI');

console.log(JSON.stringify({ ok: true, message: 'Command parity tests passed (v20260417)' }, null, 2));
