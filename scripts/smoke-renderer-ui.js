'use strict';

const fs = require('fs');
const path = require('path');
const { assert } = require('./lib/scriptUtils');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assertIncludes(content, fragment, message) {
  assert(content.includes(fragment), message);
}

function main() {
  const indexHtml = readProjectFile('public/index.html');
  const retroCss = readProjectFile('public/styles/retro-terminal.css');
  const appEvents = readProjectFile('public/js/core/appEvents.js');
  const terminalUiCore = readProjectFile('public/js/core/terminalUiCore.js');
  const terminalInputUi = readProjectFile('public/js/core/terminalInputUi.js');

  assertIncludes(indexHtml, 'id="render-progress"', 'render progress host should exist');
  assertIncludes(indexHtml, 'id="scroll-bottom-btn"', 'scroll-bottom indicator should exist');
  assertIncludes(indexHtml, 'id="shortcut-helper"', 'shortcut helper should exist');
  assertIncludes(indexHtml, 'class="shortcut-columns"', 'shortcut helper should keep column layout');
  assertIncludes(indexHtml, 'NAV (이동)', 'shortcut helper should include navigation commands');
  assertIncludes(indexHtml, 'POST (게시판)', 'shortcut helper should include post commands');
  assertIncludes(indexHtml, 'SYS/UI (시스템)', 'shortcut helper should include system commands');

  assertIncludes(retroCss, 'background: var(--help-bg);', 'shortcut helper should follow the active theme background');
  assertIncludes(retroCss, '.terminal-dialog-box--large {', 'large terminal dialog styling should exist');
  assertIncludes(retroCss, '.bbs-notification {', 'notification styling should exist');
  assertIncludes(retroCss, '.scroll-bottom-indicator {', 'scroll guardian styling should exist');

  assertIncludes(appEvents, "document.getElementById('shortcut-helper')", 'appEvents should control the shortcut helper');
  assertIncludes(appEvents, "e.key === 'Escape'", 'shortcut helper should react to Escape');
  assertIncludes(appEvents, "e.key === 'Alt'", 'shortcut helper should react to Alt');
  assertIncludes(terminalUiCore, "createTerminalInputUi({", 'terminal UI core should compose the input UI module');
  assertIncludes(terminalInputUi, 'function autoAdjustZoom()', 'terminal input UI module should expose auto zoom logic');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'ui overlay hosts',
      'shortcut helper sections',
      'theme-consistent overlay styles',
      'shortcut helper keyboard controls',
      'auto zoom hook'
    ]
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
