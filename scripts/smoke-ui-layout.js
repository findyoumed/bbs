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
  const styleCss = readProjectFile('public/style.css');
  const terminalUiCore = readProjectFile('public/js/core/terminalUiCore.js');
  const terminalHintFooter = readProjectFile('public/js/core/terminalHintFooter.js');
  const terminalHintLayout = readProjectFile('public/js/core/terminalHintLayout.js');
  const appFactory = readProjectFile('public/js/core/appFactory.js');
  const appFactoryServices = readProjectFile('public/js/core/appFactoryServices.js');

  assertIncludes(indexHtml, 'id="terminal-wrapper"', 'terminal wrapper should exist');
  assertIncludes(indexHtml, 'id="terminal-container"', 'terminal container should exist');
  assertIncludes(indexHtml, 'id="terminal-screen"', 'terminal screen should exist');
  assertIncludes(indexHtml, 'id="terminal-footer"', 'terminal footer should exist');
  assertIncludes(indexHtml, 'id="cmd-suggestion-box"', 'suggestion box should exist');
  assertIncludes(indexHtml, 'id="cmd-hint"', 'command hint area should exist');
  assertIncludes(indexHtml, 'id="terminal-prompt-row"', 'prompt row should exist');
  assertIncludes(indexHtml, 'id="cmd-input"', 'command input should exist');

  assertIncludes(styleCss, '#cmd-hint.is-expanded', 'expanded hint style should exist');
  assertIncludes(styleCss, '.cmd-entry--last-visible .cmd-sep', 'hint separator trimming style should exist');
  assertIncludes(styleCss, '#terminal-prompt-row', 'prompt row style should exist');

  assertIncludes(terminalUiCore, "createTerminalHintFooter({", 'terminal UI core should compose the hint footer module');
  assertIncludes(terminalHintFooter, 'scheduleHintTrim', 'hint footer module should reschedule trimming after render');
  assertIncludes(terminalHintLayout, 'function trimHintEntriesToFit()', 'hint trimming logic should exist');
  assertIncludes(terminalHintLayout, 'function toggleHintExpansion()', 'hint expansion logic should exist');
  assertIncludes(terminalHintLayout, 'applyHiddenCommandsToHelpToken', 'overflow should route hidden commands to the help(H) token tooltip');
  assertIncludes(terminalHintLayout, '이 화면의 다른 명령', 'overflow hint tooltip should describe hidden commands');
  assert(!terminalHintLayout.includes(".filter((e) => e.hidden = false)"), 'hint expansion should not contain assignment bug');

  assertIncludes(appFactory, "createAppFactoryServices({", 'appFactory should compose the services module');
  assertIncludes(appFactoryServices, "hintEl: document.getElementById('cmd-hint')", 'appFactory services should wire cmd-hint');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'terminal layout nodes',
      'hint expansion styles',
      'hint overflow logic',
      'appFactory services hint wiring'
    ]
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
