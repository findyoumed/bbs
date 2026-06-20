'use strict';

const fs = require('fs');
const path = require('path');
const { assert } = require('./lib/scriptUtils');

function readProjectFile(relativePath) {
  // [LOG: 20260620_1025] 멀티라인 fragment 검증은 줄바꿈 형식에 무관해야 한다.
  // Windows에서 CSS가 CRLF로 저장되면 LF 기준 패턴이 false negative를 내므로 LF로 정규화한다.
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function assertIncludes(content, fragment, message) {
  assert(content.includes(fragment), message);
}

function assertNotIncludes(content, fragment, message) {
  assert(!content.includes(fragment), message);
}

function main() {
  const retroCss = readProjectFile('public/styles/retro-terminal.css');
  const layoutCss = readProjectFile('public/style.css');
  const terminalInputUi = readProjectFile('public/js/core/terminalInputUi.js');

  assertIncludes(layoutCss, '@media (max-width: 768px) and (orientation: portrait)', 'mobile portrait layout rules should exist');
  assertIncludes(layoutCss, '@media (max-height: 480px) and (orientation: landscape)', 'mobile landscape layout rules should exist');

  assertIncludes(retroCss, 'min-width: min(320px, calc(100vw - 32px));', 'dialog min width should shrink on narrow screens');
  assertIncludes(retroCss, 'max-width: min(80%, calc(100vw - 32px));', 'dialog max width should stay inside the viewport');
  assertIncludes(retroCss, 'width: min(800px, calc(100vw - 32px));', 'large helper/dialog surfaces should fit inside the viewport');
  assertIncludes(retroCss, 'height: min(500px, calc(100vh - 32px));', 'large editor dialog height should fit inside the viewport');
  assertIncludes(retroCss, 'max-width: min(420px, calc(100vw - 24px));', 'notifications should avoid mobile overflow');
  assertIncludes(retroCss, 'max-width: calc(100vw - 24px);', 'scroll-bottom indicator should avoid mobile overflow');
  assertIncludes(retroCss, 'white-space: normal;', 'mobile helper descriptions should be allowed to wrap');
  assertIncludes(retroCss, '@media (max-width: 768px) {\n    :root {\n        --terminal-scale: 1;', 'mobile portrait should disable transform auto scaling');
  assertIncludes(retroCss, '@media (max-height: 540px) and (orientation: landscape) {\n    :root {\n        --terminal-scale: 1;', 'mobile landscape should disable transform auto scaling');

  assertIncludes(terminalInputUi, "window.getComputedStyle(document.documentElement).getPropertyValue('--terminal-scale')", 'auto zoom should preserve the configured CSS scale');
  assertIncludes(terminalInputUi, 'setZoom(cssScale);', 'auto zoom should apply the CSS-managed scale');
  assertNotIncludes(terminalInputUi, 'const wrapperWidth = terminalWrapper?.clientWidth || window.innerWidth || 800;', 'auto zoom should not dynamically shrink by wrapper width');
  assertNotIncludes(terminalInputUi, 'const isMobilePortrait = viewportWidth <= 768 && viewportHeight > viewportWidth;', 'auto zoom should not branch into separate mobile transform logic');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'mobile portrait layout rules',
      'mobile landscape layout rules',
      'dialog viewport constraints',
      'helper viewport constraints',
      'notification viewport constraints',
      'css-managed zoom logic'
    ]
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
