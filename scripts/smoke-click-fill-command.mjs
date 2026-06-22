import path from 'path';
import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createCmdInput() {
  return {
    value: '',
    focused: false,
    selectionStart: 0,
    selectionEnd: 0,
    events: [],
    focus() {
      this.focused = true;
    },
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
}

function createTarget(dataset, matchedAttr) {
  return {
    dataset,
    closest(selector) {
      const selectors = String(selector || '').split(',').map((entry) => entry.trim());
      if (selectors.includes(`[data-${matchedAttr}]`) || selectors.includes(`.${matchedAttr}`)) {
        return this;
      }
      return null;
    }
  };
}

globalThis.window = {
  matchMedia: () => ({ matches: true })
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    maxTouchPoints: 0,
    msMaxTouchPoints: 0
  }
});

const interactionSource = fs.readFileSync(path.resolve('public/js/core/interactionHandlers.js'), 'utf8')
  .replace(
    "import { isMobileDevice } from './uiUtils.js';",
    'function isMobileDevice() { return false; }'
  );
const moduleUrl = `data:text/javascript;base64,${Buffer.from(interactionSource).toString('base64')}`;
const { createInteractionHandlers } = await import(moduleUrl);

const calls = {
  commands: [],
  showPostView: 0,
  executeMenuNodeAction: 0,
  showPostList: 0
};
const suggestions = [];
const cmdInput = createCmdInput();
let signupChoiceExecuted = false;

const { handleGlobalClick } = createInteractionHandlers({
  state: {
    screen: 'signup',
    board: { id: 'free' },
    _signupEnterHandler: () => {
      signupChoiceExecuted = true;
      return true;
    }
  },
  handleCmd: (cmd) => { calls.commands.push(cmd); },
  showPostView: () => { calls.showPostView += 1; },
  showPostList: () => { calls.showPostList += 1; },
  showBoardSelect: () => {},
  getBoardSelectTitle: () => 'TOP',
  getMenuNodeByKey: () => ({ id: 'news' }),
  executeMenuNodeAction: () => { calls.executeMenuNodeAction += 1; },
  cmdInput,
  moveCaretToEnd: () => {
    cmdInput.setSelectionRange(cmdInput.value.length, cmdInput.value.length);
  },
  setGhostText: () => {},
  setSuggestions: (items) => {
    suggestions.push(items);
  }
});

const cmdTarget = createTarget({ cmd: '7' }, 'cmd');
let prevented = false;
const handledCmd = handleGlobalClick({
  target: cmdTarget,
  preventDefault: () => { prevented = true; }
});
assert(handledCmd === true, 'data-cmd click was not handled');
assert(prevented, 'data-cmd click did not prevent default');
assert(cmdInput.value === '7', `data-cmd should show pending input: ${cmdInput.value}`);
assert(cmdInput.selectionStart === 1 && cmdInput.selectionEnd === 1, 'caret was not moved to end');
assert(cmdInput.focused, 'command input was not focused');
assert(!cmdInput.events.includes('input'), 'click should not dispatch input event and open autocomplete');
assert(calls.commands.at(-1) === '7', 'data-cmd click did not execute immediately');
await Promise.resolve();
assert(cmdInput.value === '', `data-cmd pending input was not cleared after execution: ${cmdInput.value}`);

cmdInput.value = '';
cmdInput.events = [];
const postTarget = createTarget({ postid: '123' }, 'postid');
handleGlobalClick({
  target: postTarget,
  preventDefault: () => {}
});
assert(cmdInput.value === '123', `post click should show post number: ${cmdInput.value}`);
assert(!cmdInput.events.includes('input'), 'post click should not dispatch input event');
assert(calls.commands.at(-1) === '123', 'post click did not execute immediately');
await Promise.resolve();
assert(cmdInput.value === '', `post pending input was not cleared after execution: ${cmdInput.value}`);

cmdInput.value = '';
cmdInput.events = [];
const nodeTarget = createTarget({ nodeKey: 'news', cmdFill: '03' }, 'node-key');
handleGlobalClick({
  target: nodeTarget,
  preventDefault: () => {}
});
assert(cmdInput.value === '03', `node hotspot should show visible menu number: ${cmdInput.value}`);
assert(!cmdInput.events.includes('input'), 'node hotspot should not dispatch input event');
assert(calls.commands.at(-1) === '03', 'node hotspot did not execute immediately');
await Promise.resolve();
assert(cmdInput.value === '', `node pending input was not cleared after execution: ${cmdInput.value}`);

cmdInput.value = '';
cmdInput.events = [];
const topTarget = createTarget({ menuPath: 'top' }, 'menu-path');
handleGlobalClick({
  target: topTarget,
  preventDefault: () => {}
});
assert(cmdInput.value === 'T', `top menu path should show T: ${cmdInput.value}`);
assert(!cmdInput.events.includes('input'), 'top menu path should not dispatch input event');
assert(calls.commands.at(-1) === 'T', 'top menu path did not execute immediately');
await Promise.resolve();
assert(cmdInput.value === '', `top pending input was not cleared after execution: ${cmdInput.value}`);

cmdInput.value = '';
cmdInput.events = [];
const topbarTarget = {
  dataset: { menuPath: 'top' },
  closest(selector) {
    const text = String(selector || '');
    if (text.includes('[data-menu-path]') || text.includes('.menu-path')) return this;
    if (text.includes('.retro-topbar--ansi')) return this;
    return null;
  }
};
handleGlobalClick({
  target: topbarTarget,
  preventDefault: () => {}
});
assert(cmdInput.value === '', `topbar home click should not show T: ${cmdInput.value}`);
assert(calls.commands.at(-1) === 'T', 'topbar home click did not execute immediately');

cmdInput.value = '';
cmdInput.events = [];
const signupTarget = createTarget({ signupChoice: 'y' }, 'signup-choice');
handleGlobalClick({
  target: signupTarget,
  preventDefault: () => {}
});
assert(cmdInput.value === 'y', `signup alphabet choice should show y: ${cmdInput.value}`);
assert(!cmdInput.events.includes('input'), 'signup alphabet choice should not dispatch input event');
assert(signupChoiceExecuted, 'signup choice did not execute immediately');
await Promise.resolve();
assert(cmdInput.value === '', `signup pending input was not cleared after execution: ${cmdInput.value}`);

assert(suggestions.length >= 5, 'suggestions were not cleared during click fill');

const serviceUiUtilsSource = fs.readFileSync(path.resolve('public/js/core/serviceUiUtils.js'), 'utf8');
const serviceUiUtilsUrl = `data:text/javascript;base64,${Buffer.from(serviceUiUtilsSource).toString('base64')}`;
const { createServiceUiUtils } = await import(serviceUiUtilsUrl);
globalThis.document = {
  createElement(tagName) {
    return {
      tagName,
      type: '',
      className: '',
      dataset: {},
      style: {},
      title: '',
      attrs: {},
      setAttribute(name, value) {
        this.attrs[name] = value;
      }
    };
  }
};
const { createHotspotButton } = createServiceUiUtils({ displayWidth: (value) => String(value || '').length });
const newsMenuHotspot = createHotspotButton('1', 'news topic', { left: 0, top: 0, width: 10, height: 10 });
assert(newsMenuHotspot.dataset.cmd === '1', `service hotspot command missing: ${newsMenuHotspot.dataset.cmd}`);
assert(newsMenuHotspot.dataset.cmdFill === '1', `service hotspot should show visible menu number: ${newsMenuHotspot.dataset.cmdFill}`);
const sourceLinkHotspot = createHotspotButton('', 'source link', { left: 0, top: 0, width: 10, height: 10 });
assert(!Object.prototype.hasOwnProperty.call(sourceLinkHotspot.dataset, 'cmdFill'), 'blank command hotspot should not expose cmdFill');

const clickListeners = [];
globalThis.document = {
  addEventListener(type, handler, options = {}) {
    if (type === 'click') {
      clickListeners.push({ handler, options });
    }
  },
  getElementById() {
    return null;
  },
  querySelector() {
    return null;
  }
};
globalThis.window = {
  addEventListener() {},
  getSelection: () => ({ toString: () => '' })
};

const appEventsSource = fs.readFileSync(path.resolve('public/js/core/appEvents.js'), 'utf8')
  .replace(
    "import { bindCommandInputEvents } from './appEventsCommandInput.js';",
    'function bindCommandInputEvents() { return { moveCaretToEnd: () => {} }; }'
  );
const appEventsUrl = `data:text/javascript;base64,${Buffer.from(appEventsSource).toString('base64')}`;
const { bindAppEvents } = await import(appEventsUrl);

const hintMarkupSource = fs.readFileSync(path.resolve('public/js/core/terminalHintMarkup.js'), 'utf8')
  .replace(
    "import { CMD_META } from './commandService.js';",
    'const CMD_META = { P: { label: "상위" }, T: { label: "초기화면" }, GO: { label: "이동" }, H: { label: "도움말" } };'
  );
const hintMarkupUrl = `data:text/javascript;base64,${Buffer.from(hintMarkupSource).toString('base64')}`;
const { createTerminalHintMarkup } = await import(hintMarkupUrl);

const hintMarkup = createTerminalHintMarkup({
  state: { screen: 'post-write', user: { isGuest: false } },
  esc: (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
});
const renderedFooterMarkup = hintMarkup.renderHintMarkup('번호/명령(P:취소,T,GO,H)');
assert(renderedFooterMarkup.includes('취소(P)'), 'footer markup did not render command label text');
assert(renderedFooterMarkup.includes('data-cmd='), 'footer markup should expose clickable data-cmd attributes');
assert(!renderedFooterMarkup.includes('data-cmd-fill='), 'footer markup should not expose clickable data-cmd-fill attributes');
assert(renderedFooterMarkup.includes('cmd-clickable'), 'footer markup should render clickable command tokens');

const captureInput = createCmdInput();
const captureSuggestions = [];
const executedCommands = [];
bindAppEvents({
  cmdInput: captureInput,
  handleCmd: (cmd) => {
    executedCommands.push(cmd);
  },
  state: {
    _signupEnterHandler: (raw) => {
      executedCommands.push(`signup:${raw}`);
      return true;
    }
  },
  setGhostText: () => {},
  setSuggestions: (items) => captureSuggestions.push(items),
  interactionHandlers: {
    handleGlobalClick: () => {
      throw new Error('capture command click reached global click handler');
    },
    shouldAutoFocusCommandInput: () => true
  }
});

const captureClick = clickListeners.find((entry) => entry.options?.capture === true);
assert(captureClick, 'capture click listener was not registered');
let capturePrevented = false;
let propagationStopped = false;
const commandElement = {
  dataset: { cmd: 'P' },
  closest(selector) {
    return String(selector || '').includes('[data-cmd]') ? this : null;
  }
};
captureClick.handler({
  target: commandElement,
  preventDefault: () => { capturePrevented = true; },
  stopPropagation: () => { propagationStopped = true; },
  stopImmediatePropagation: () => { propagationStopped = true; }
});

assert(captureInput.value === 'P', `captured alphabet command should show pending input: ${captureInput.value}`);
assert(capturePrevented, 'captured alphabet command did not prevent default');
assert(propagationStopped, 'captured alphabet command did not stop propagation');
assert(!captureInput.events.includes('input'), 'captured alphabet command should not dispatch input event');
assert(captureSuggestions.length === 1, 'captured alphabet command did not clear suggestions');
assert(executedCommands.at(-1) === 'P', 'normal capture command did not execute immediately');
await Promise.resolve();
assert(captureInput.value === '', `captured command pending input was not cleared after execution: ${captureInput.value}`);

captureInput.value = '';
captureInput.events = [];
capturePrevented = false;
propagationStopped = false;
const signupCommandElement = {
  dataset: { signupChoice: 'n' },
  closest(selector) {
    return String(selector || '').includes('[data-signup-choice]') ? this : null;
  }
};
captureClick.handler({
  target: signupCommandElement,
  preventDefault: () => { capturePrevented = true; },
  stopPropagation: () => { propagationStopped = true; },
  stopImmediatePropagation: () => { propagationStopped = true; }
});

assert(captureInput.value === 'N', `captured signup alphabet choice should show pending input: ${captureInput.value}`);
assert(capturePrevented, 'captured signup alphabet choice did not prevent default');
assert(propagationStopped, 'captured signup alphabet choice did not stop propagation');
assert(executedCommands.at(-1) === 'signup:N', 'captured signup alphabet choice did not execute immediately');
await Promise.resolve();
assert(captureInput.value === '', `captured signup pending input was not cleared after execution: ${captureInput.value}`);

captureInput.value = '';
captureInput.events = [];
capturePrevented = false;
propagationStopped = false;
const executeCommandElement = {
  dataset: { cmd: 'P', cmdExecute: 'true' },
  closest(selector) {
    const text = String(selector || '');
    return text.includes('[data-cmd-execute]') || text.includes('[data-cmd]') ? this : null;
  }
};
captureClick.handler({
  target: executeCommandElement,
  preventDefault: () => { capturePrevented = true; },
  stopPropagation: () => { propagationStopped = true; },
  stopImmediatePropagation: () => { propagationStopped = true; }
});

assert(captureInput.value === 'P', `execute click should show pending input: ${captureInput.value}`);
assert(capturePrevented, 'captured execute command did not prevent default');
assert(propagationStopped, 'captured execute command did not stop propagation');
assert(executedCommands.at(-1) === 'P', 'captured execute command did not run immediately');
await Promise.resolve();
assert(captureInput.value === '', `captured execute pending input was not cleared after execution: ${captureInput.value}`);

console.log(JSON.stringify({ ok: true, shown: ['7', '123', '03', 'T', 'y', 'P', 'N', 'P'], hidden: ['topbar:T'], cleared: true, executed: ['7', '123', '03', 'T', 'T', 'signup:y', 'P', 'signup:N', 'P'] }, null, 2));
