/**
 * scripts/test-ui-evolution.js
 * [LOG: 20260426_1430] Test script for terminal UI evolution checks.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function checkFileContains(filePath, pattern) {
  const content = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
  if (content.includes(pattern)) {
    console.log(`✅ [${filePath}] contains: ${pattern.slice(0, 50)}...`);
    return true;
  }

  console.error(`❌ [${filePath}] DOES NOT contain: ${pattern}`);
  return false;
}

console.log('Verifying current terminal UI contracts...');

const checks = [
  { file: 'public/index.html', pattern: 'id="terminal-wrapper"' },
  { file: 'public/index.html', pattern: 'id="terminal-footer"' },
  { file: 'public/index.html', pattern: 'id="cmd-suggestion-box"' },
  { file: 'public/index.html', pattern: 'id="cmd-hint"' },
  { file: 'public/style.css', pattern: '#cmd-hint.is-expanded' },
  { file: 'public/style.css', pattern: '.cmd-entry--last-visible .cmd-sep' },
  { file: 'public/js/core/terminalUiCore.js', pattern: 'function trimHintEntriesToFit()' },
  { file: 'public/js/core/terminalUiCore.js', pattern: 'function toggleHintExpansion()' },
  { file: 'public/js/core/terminalUiCore.js', pattern: '숨김 명령 ${hiddenEntries.length}개:' },
  { file: 'public/js/core/terminalUiCore.js', pattern: "window.getComputedStyle(document.documentElement).getPropertyValue('--terminal-scale')" },
  { file: 'public/js/core/apiFetch.js', pattern: 'translateErrorMessage' },
  { file: 'public/js/core/apiFetch.js', pattern: 'onActivity(true)' },
  { file: 'public/js/core/appFactory.js', pattern: "hintEl: document.getElementById('cmd-hint')" },
  { file: 'public/styles/retro-terminal.css', pattern: 'width: min(800px, calc(100vw - 32px));' },
  { file: 'public/styles/retro-terminal.css', pattern: 'max-width: min(420px, calc(100vw - 24px));' },
  { file: 'public/styles/retro-terminal.css', pattern: '--terminal-scale: 1;' }
];

let allPassed = true;
for (const check of checks) {
  if (!checkFileContains(check.file, check.pattern)) {
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\nAll current terminal UI checks passed.');
} else {
  console.error('\nSome current terminal UI checks failed.');
  process.exit(1);
}
