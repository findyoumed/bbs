/**
 * [LOG_ID: 20260717_0100] 메뉴 배선 스모크 — "메뉴를 눌러도 아무 일도 안 일어난다" 버그를 자동으로 잡는다.
 *
 * 이 버그는 이 저장소에서 세 번 반복됐다:
 *   - 20260713_1700 refs.showMemoList 누락 → 메인 메뉴의 전자우편이 무반응
 *   - 20260713_2100 refs.showHelp/showPolicy 누락 → GUIDE의 명령어안내/이용약관이 무반응
 *   - 20260715_2400 policy가 routingUrlBuilder에 없어 URL이 '/'로 떨어짐 → P(상위)가 TOP으로 튐
 *
 * 원인이 늘 같다: menuNavigationActions.js 에 `node.type === 'x'` 분기는 멀쩡히 있는데
 * 거기서 부르는 refs.showX 가 appFactoryRuntime.js 의 refs 에 안 꽂혀 있어서,
 * executeMenuNodeAction 이 `typeof refs.showX === 'function'` 검사에 걸려 조용히 return false 한다.
 * 에러도 로그도 안 남아서 "눌러도 아무 일이 없다"로만 드러난다.
 *
 * 검사 대상은 하드코딩하지 않고 legacy/hanulso.mnu 에 실제로 쓰인 type 을 전부 훑는다.
 * (메뉴를 새로 추가하면 이 테스트가 자동으로 그것까지 검사한다.)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { assert } = require('./lib/scriptUtils');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'public', 'js', 'core');

const read = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
const readCore = (fileName) => fs.readFileSync(path.join(CORE, fileName), 'utf-8');
const coreExists = (fileName) => fs.existsSync(path.join(CORE, fileName));

const mnu = read('legacy/hanulso.mnu');
const navActions = read('public/js/core/menuNavigationActions.js');
const runtime = read('public/js/core/appFactoryRuntime.js');
const appScreens = read('public/js/core/appFactoryScreens.js');

// menuNavigationActions 가 refs 를 거치지 않고 직접 처리하는 타입.
//   menu        → showBoardSelect (deps로 직접 주입)
//   oauth-login → startOAuthLogin (deps로 직접 주입)
const SELF_HANDLED_TYPES = new Set(['menu', 'oauth-login']);

// 메뉴 type → executeMenuNodeAction 이 호출하는 refs 함수.
const REFS_BY_TYPE = {
  board: 'showPostList',
  news: 'showNewsMenu',
  weather: 'showWeatherMenu',
  vote: 'showVoteList',
  ranking: 'showRanking',
  conf: 'showConfRooms',
  biorhythm: 'showBiorhythm',
  fortune: 'showFortune',
  mbti: 'showMbti',
  'retro-art': 'showRetroArt',
  chatt: 'showChatLobby',
  memo: 'showMemoList',
  login: 'showLogin',
  'password-reset': 'showPasswordReset',
  signup: 'showSignup',
  myinfo: 'showMyInfo',
  help: 'showHelp',
  policy: 'showPolicy',
  'member-search': 'showMemberSearch',
  'menu-index': 'showMenuIndex',
  'my-stats': 'showMyStats'
};

const usedTypes = [...new Set(
  [...mnu.matchAll(/<item\s+[^>]*type="([\w-]+)"/g)].map((match) => match[1])
)].sort();

assert(usedTypes.length > 0, 'hanulso.mnu 에서 메뉴 type을 하나도 찾지 못했습니다.');

const refsBlock = (runtime.match(/Object\.assign\(refs,\s*\{[\s\S]*?\n {2}\}\);/) || [''])[0];
assert(refsBlock, 'appFactoryRuntime.js 에서 Object.assign(refs, {...}) 블록을 찾지 못했습니다.');

/**
 * refs 에 스프레드된 모듈(...screens.xxx)에서 출발해, 그 모듈이 (재귀적으로) 어떤 함수를
 * 내주는지 따라간다.
 *
 * 한 단계로는 안 된다 — 예를 들어
 *   postScreens.js    는 `return { ...handlers }` 이고 showPostList 는 handlers 의 키,
 *   serviceScreens.js 는 `return { ...newsScreens, ...weatherScreens }` 라서
 *   showNewsMenu 는 또 다른 모듈(newsScreens.js)에 있다.
 * 그래서 파일 안의 create*() 호출을 따라 하위 모듈까지 내려간다.
 *
 * 과다 탐색으로 인한 위험은 "못 잡는 것"(false negative)뿐이고 "멀쩡한 걸 실패로 모는 것"
 * (false positive)은 없다 — refs 에서 출발해 도달 가능한 모듈만 보기 때문이다.
 * 과거 3건은 전부 "모듈이 refs 에서 아예 도달 불가"였으므로 이 검사로 잡힌다.
 */
function collectProvidedNames() {
  const provided = new Set();

  // 명시적으로 적힌 것: `showHelp: screens.helpScreens.showHelp`
  for (const match of refsBlock.matchAll(/^\s*(\w+)\s*:/gm)) {
    provided.add(match[1]);
  }

  const rootModules = [...refsBlock.matchAll(/\.\.\.screens\.(\w+)/g)].map((match) => match[1]);
  const visited = new Set();

  // screens 키(memoScreens) → 그 키를 만드는 팩토리(createMemoScreens) → 파일(memoScreens.js)
  function fileForScreensKey(key) {
    const factory = appScreens.match(new RegExp(`const\\s+${key}\\s*=\\s*create(\\w+)\\s*\\(`));
    if (!factory) return null;
    const name = factory[1];
    return `${name[0].toLowerCase()}${name.slice(1)}.js`;
  }

  function walkFile(fileName) {
    if (!fileName || visited.has(fileName) || !coreExists(fileName)) return;
    visited.add(fileName);

    const src = readCore(fileName);

    // 이 파일이 내주는 이름들: 객체 키(`showX:`), 함수 선언(`function showX`), 축약 프로퍼티.
    for (const match of src.matchAll(/^\s*(show\w+|handle\w+|cancel\w+)\s*[,:]/gm)) {
      provided.add(match[1]);
    }
    for (const match of src.matchAll(/function\s+(show\w+|handle\w+|cancel\w+)\s*\(/g)) {
      provided.add(match[1]);
    }

    // 이 파일이 다시 만들어 쓰는 하위 모듈(create*)을 따라 내려간다.
    for (const match of src.matchAll(/create([A-Z]\w+)\s*\(/g)) {
      const name = match[1];
      walkFile(`${name[0].toLowerCase()}${name.slice(1)}.js`);
    }
  }

  for (const key of rootModules) {
    walkFile(fileForScreensKey(key));
  }

  return provided;
}

const provided = collectProvidedNames();
const failures = [];

for (const type of usedTypes) {
  if (SELF_HANDLED_TYPES.has(type)) continue;

  if (!new RegExp(`node\\.type === '${type}'`).test(navActions)) {
    failures.push(`type="${type}": menuNavigationActions.js 에 dispatch 분기가 없습니다 — 메뉴를 눌러도 무반응입니다.`);
    continue;
  }

  const fnName = REFS_BY_TYPE[type];
  if (!fnName) {
    failures.push(`type="${type}": 이 스모크의 REFS_BY_TYPE 표에 없습니다. 메뉴 타입을 새로 만들었다면 표에도 등록하세요.`);
    continue;
  }

  if (!provided.has(fnName)) {
    failures.push(`type="${type}": refs.${fnName} 이 refs 에서 도달 불가합니다 — executeMenuNodeAction 이 조용히 return false 합니다. appFactoryRuntime.js 의 Object.assign(refs, {...}) 에 추가하세요.`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  throw new Error(`메뉴 배선 이상 ${failures.length}건`);
}

console.log(JSON.stringify({
  ok: true,
  message: 'Menu wiring smoke passed',
  checkedTypes: usedTypes.length,
  types: usedTypes
}, null, 2));
