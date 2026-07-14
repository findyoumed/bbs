/**
 * [LOG_ID: 20260717_1200] 회원가입 아이디/비밀번호 칸의 한글 IME 조합 훼손 회귀 테스트.
 *
 * 사용자 보고: "https://01410.vercel.app/log/signup/email 의 #cmd-input 에 입력이 잘 안 된다."
 *
 * 원인: 이 단계들은 영문 전용이라 signupEmailForm.js 가 한글을 자판 키로 변환해 걸러내는데,
 * 그 변환을 'input' 이벤트에서 하고 있었다. 'input' 은 한글 조합이 **진행 중일 때도** 매 글자
 * 발동하므로, IME 가 "고"를 조합하는 도중에 cmdInput.value 를 "rh"로 갈아치웠다. 브라우저는
 * 이미 바뀐 값 위에서 조합을 이어가려 하니 글자가 씹히거나 중복된다.
 * (style.imeMode='inactive' 로 IME 를 끄려 했지만 크롬이 무시하는 비표준 속성이라 조합은 일어난다.)
 *
 * 고침: 조합 중(event.isComposing)에는 손대지 않고, 조합이 확정된 뒤에 변환한다.
 *
 * 브라우저를 띄우지 않고 #cmd-input 을 흉내 낸 가짜 엘리먼트에 실제 이벤트를 쏴서 검증한다.
 */
import fs from 'fs';
import path from 'path';

// public/js/core/*.js 는 ESM이지만 package.json 에 "type":"module" 이 없어 Node 가 CJS 로 본다.
// 기존 smoke-click-fill-command.mjs 와 동일하게 소스를 읽어 data URL 로 동적 import 한다.
const source = fs.readFileSync(path.resolve('public/js/core/signupEmailForm.js'), 'utf8')
  .replace(
    "import { shouldAutoFocusCommandInput } from './uiUtils.js';",
    'function shouldAutoFocusCommandInput() { return false; }'
  );
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { createSignupEmailHandler } = await import(moduleUrl);

function makeFakeInput() {
  const listeners = {};
  return {
    value: '',
    selectionStart: 0,
    dataset: {},
    style: {},
    disabled: false,
    inputMode: '',
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    setSelectionRange(start) { this.selectionStart = start; },
    focus() {},
    dispatchEvent() {},
    fire(type, event) { (listeners[type] || []).forEach((fn) => fn(event)); }
  };
}

globalThis.window = {
  innerWidth: 1200,
  matchMedia: () => ({ matches: false }),
  setTimeout: (fn) => fn()
};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => ({ classList: { add() {} }, dataset: {}, append() {} }),
  createTextNode: () => ({})
};

const cmdInput = makeFakeInput();
let stage = 'signup-userid';
const noop = () => {};

const attachEmailEvents = createSignupEmailHandler({
  cleanupSignupHandlers: noop,
  cmdInput,
  hintEl: null,
  mountPromptRow: noop,
  precheckSignup: async () => {},
  renderEmailScreen: noop,
  restorePromptRow: noop,
  searchMember: async () => null,
  setFooterVisibility: noop,
  setPendingSignupDraft: noop,
  setPendingSignupMethod: noop,
  setPrompt: noop,
  setSignupAgreementAccepted: noop,
  showMain: noop,
  state: {},
  updateURL: noop,
  getPendingSignupDraft: () => ({}),
  getSignupEmailStage: () => stage,
  setSignupEmailStage: (value) => { stage = value; },
  clearSignupEmailStage: noop,
  getSignupEmailTranscript: () => [],
  setSignupEmailTranscript: noop,
  appendSignupEmailTranscript: noop,
  clearSignupEmailTranscript: noop
});

attachEmailEvents({}, 'signup-userid');

const failures = [];
function check(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: 결과 "${actual}", 기대 "${expected}"`);
  }
}

// 핵심 회귀: 조합 중에는 value 를 절대 건드리면 안 된다.
cmdInput.value = '고';
cmdInput.fire('input', { isComposing: true });
check('한글 조합 중에는 value 를 건드리지 않는다', cmdInput.value, '고');

// 조합이 확정되면 두벌식 자판 키로 변환한다 ("고" = ㄱ(r) + ㅗ(h)).
cmdInput.fire('compositionend', { isComposing: false });
check('조합 확정 후 한글 → 자판 키 변환', cmdInput.value, 'rh');

// 기존 동작 회귀 없음: 영문은 그대로, 아이디 금지문자는 계속 걸러진다.
cmdInput.value = 'hong';
cmdInput.fire('input', { isComposing: false });
check('영문 입력은 그대로 유지', cmdInput.value, 'hong');

cmdInput.value = 'ho ng!@#';
cmdInput.fire('input', { isComposing: false });
check('아이디 금지문자 제거', cmdInput.value, 'hong');

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  message: 'Signup IME composition smoke passed'
}, null, 2));
