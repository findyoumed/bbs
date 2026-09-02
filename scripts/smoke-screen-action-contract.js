/**
 * Regression checks for the screen-action contract shared by footer text,
 * hint markup, and command metadata.
 */
'use strict';

const path = require('path');
const { assert } = require('./lib/scriptUtils');
const { loadBrowserHarnessModule } = require('./smoke/common-utils');

const coreDir = path.join(__dirname, '..', 'public/js/core');
const moduleCache = new Map();
const {
  CMD_META,
  CONTEXT_CMD_META,
  getCommandMeta
} = loadBrowserHarnessModule(path.join(coreDir, 'commandService.js'), moduleCache);
const {
  CMD_ORDER,
  SCREEN_TO_CATEGORY,
  createCommandFooterTextUtils
} = loadBrowserHarnessModule(path.join(coreDir, 'commandFooterText.js'), moduleCache);
const {
  SCREEN_ACTION_REGISTRY,
  getScreenActionContract,
  getScreenActions,
  getScreenAction
} = loadBrowserHarnessModule(path.join(coreDir, 'screenActionRegistry.js'), moduleCache);
const { createTerminalHintMarkup } = loadBrowserHarnessModule(
  path.join(coreDir, 'terminalHintMarkup.js'),
  moduleCache
);

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function commandPart(token) {
  return String(token || '').trim().split(':', 1)[0].trim().toUpperCase();
}

function verifyScreenCategoryMappings() {
  for (const [screen, category] of Object.entries(SCREEN_TO_CATEGORY)) {
    assert(Array.isArray(CMD_ORDER[category]), `${screen} should map to a declared footer category`);
    assert(CMD_ORDER[category].length > 0, `${category} should expose at least one footer action`);
    const contract = getScreenActionContract(screen);
    assert(contract && contract.category === category, `${screen} should expose a screen action contract`);
    assert(getScreenActions(screen).length === CMD_ORDER[category].length, `${screen} action count should match footer order`);
  }
  assert(Object.isFrozen(SCREEN_ACTION_REGISTRY), 'screen action registry should be immutable');
}

function verifyFooterCommandMetadata() {
  const tokens = new Set(Object.values(CMD_ORDER).flat().map(commandPart));
  for (const command of tokens) {
    assert(getCommandMeta(command), `${command} in CMD_ORDER should resolve through command metadata`);
  }

  for (const command of Object.keys(CONTEXT_CMD_META)) {
    assert(!CMD_META[command], `${command} should remain screen-local rather than global help metadata`);
  }
}

function verifyFooterMarkup() {
  const state = { screen: 'main', user: { isGuest: false }, envVars: {} };
  const footerUtils = createCommandFooterTextUtils({ state });
  const hintMarkup = createTerminalHintMarkup({ state, esc });

  for (const [category, order] of Object.entries(CMD_ORDER)) {
    const text = footerUtils.getCommandFooterText(category);
    const html = hintMarkup.renderHintMarkup(text);
    assert(/cmd-token[^>]*role="button"/.test(html), `${category} footer should contain a clickable action token`);
    for (const token of order) {
      const command = commandPart(token);
      const tokenMarkup = createTerminalHintMarkup({
        state: {
          screen: 'post-view',
          postPageNo: 2,
          postPageCount: 3,
          user: { isGuest: !getCommandMeta(command)?.login },
          envVars: {}
        },
        esc
      });
      const rendered = tokenMarkup.renderHintMarkup(`번호/명령(${token})`);
      assert(/cmd-token[^>]*role="button"/.test(rendered), `${category}:${command} should render as a clickable token`);
    }
  }

  for (const contract of Object.values(SCREEN_ACTION_REGISTRY)) {
    for (const action of contract.actions) {
      assert(action.click && action.keyboard, `${contract.screen}:${action.command} should declare click and keyboard parity`);
      const canonical = getCommandMeta(action.command);
      assert(action.meta && canonical && action.meta.label === canonical.label && action.meta.tip === canonical.tip,
        `${contract.screen}:${action.command} should carry canonical metadata`);
      assert(['execute', 'prefill', 'fill'].includes(action.activation),
        `${contract.screen}:${action.command} should declare a supported activation mode`);
      const expectedAttribute = action.activation === 'fill'
        ? 'data-cmd-fill'
        : action.activation === 'prefill'
          ? 'data-cmd-prefill'
          : 'data-cmd';
      assert(action.binding?.attribute === expectedAttribute,
        `${contract.screen}:${action.command} should expose the ${expectedAttribute} binding`);
      assert(getScreenAction(contract.screen, action.command) === action,
        `${contract.screen}:${action.command} should resolve from its screen contract`);

      const screenState = {
        screen: contract.screen,
        user: { isGuest: false },
        envVars: {},
        page: 1,
        totalPages: 3,
        helpTotalPages: 3,
        postPageCount: 3,
        memoViewPageCount: 3,
        serviceData: { pageCount: 3 }
      };
      const screenFooter = createCommandFooterTextUtils({ state: screenState })
        .getCommandFooterText(contract.category);
      const screenMarkup = createTerminalHintMarkup({ state: screenState, esc })
        .renderHintMarkup(screenFooter);
      const header = String(screenFooter || '').split('\n', 1)[0].replace(/\([^)]*\)$/, '');
      const isolatedMarkup = createTerminalHintMarkup({
        state: { ...screenState, screen: 'main', user: { isGuest: true } },
        esc
      }).renderHintMarkup(`${header}(${action.command}:X)`);
      assert(screenMarkup.includes(`${action.binding.attribute}="${esc(action.binding.value)}"`)
        || isolatedMarkup.includes(`${action.binding.attribute}="${esc(action.binding.value)}"`),
        `${contract.screen}:${action.command} should render its canonical action binding`);
    }
  }
}

function verifyDynamicContextActions() {
  const state = { screen: 'chat-room', user: { isGuest: false }, envVars: {} };
  const hintMarkup = createTerminalHintMarkup({ state, esc });
  const dynamicText = '번호/명령(I:받은편지 S:보낸편지 MB:보관함 SEND:전송 CHANGE:변경 ENTER:확인 CP:복사 /L:목록 /W:참여자 /Z:다시보기 0:게임끝내기)';
  const html = hintMarkup.renderHintMarkup(dynamicText);

  for (const command of ['I', 'S', 'SEND', 'CHANGE', 'ENTER', 'CP', '/L', '/W', '/Z', '0']) {
    assert(html.includes(`data-cmd="${command}"`), `${command} should expose a clickable data-cmd target`);
  }
}

verifyScreenCategoryMappings();
verifyFooterCommandMetadata();
verifyFooterMarkup();
verifyDynamicContextActions();
console.log('Screen action contract smoke checks passed.');
