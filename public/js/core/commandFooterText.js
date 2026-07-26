/**
 * commandFooterText.js
 * [LOG: 20260428_2002] Standardized command footer categories and screen mappings.
 */

export const CMD_ORDER = {
  top: ['GO', 'LOGIN', 'PF', 'C:바탕색', 'H'], // [LOG: 20260609_1157] WHO(회원정보) 삭제, HI(내정보) 삭제
  menu: ['P', 'T', 'GO', 'LOGIN', 'PF', 'H'], // [LOG: 20260609_1157] WHO(회원정보) 삭제, HI(내정보) 삭제
  authMenu: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260725_1030] 사용자 요청(전수조사) — postView/weatherView에 적용한 짧은 라벨(다음/이전)
  // + T 생략 구조를 정확히 같은 모양(F/B 다음페이지·이전페이지 + P + T + GO)이던 help/policy/
  // menuIndex/newsList 네 카테고리에도 동일 적용한다. T(초기화면) 명령 자체는 계속 동작하며
  // (commandDispatcherExecution.js의 HISTORY_BACK_SCREENS 공용 처리), 힌트바 노출만 뺀다.
  help: ['F:다음', 'B:이전', 'P', 'GO'],
  history: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260713_2100] GUIDE 화면 이용약관/개인정보처리방침 뷰어 — help와 동일하게 페이징.
  // [LOG_ID: 20260716_2326] '다음페이지', '이전페이지' 라벨 오버라이드
  // [LOG_ID: 20260725_1030] 짧은 라벨 + T 생략 구조로 통일(위 help 주석 참고)
  policy: ['F:다음', 'B:이전', 'P', 'GO', 'H'],
  newsMenu: ['P', 'T', 'GO', 'LOGIN', 'H'],
  weatherMenu: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260725_0900] 사용자 요청 — "모바일에서 명령어힌트바 공지사항글의 힌트바처럼
  // 구성해줘"(postView가 이미 쓰는 짧은 라벨 + T 생략 스타일과 통일). '다음페이지'/'이전페이지'
  // 대신 '다음'/'이전'을 써도 shouldShowFooterToken의 페이지네이션 숨김 검사(20260723_2240)가
  // 이미 인식하는 라벨이라 첫/마지막 페이지 숨김 동작은 그대로 유지된다. T(초기화면)는 상위(P)가
  // 있으니 힌트바에서 뺀다(T 명령 자체는 그대로 동작, 노출만 뺌).
  weatherView: ['F:다음', 'B:이전', 'P', 'GO', 'H'],
  // [LOG: 20260622_1900] 힌트바는 동적 너비 기반(trimHintEntriesToFit)으로 자동 맞춤한다.
  // 전체 명령을 나열해도 화면에 들어가는 만큼만 표시되고, 넘치면 우선순위 낮은 순으로 숨겨 도움말(H)
  // 토큰 tooltip에 모인다. (안 넘치면 전부 노출 — 일부러 줄이지 않음)
  pdsList: ['F', 'B', 'P', 'T', 'GO', 'UP:올리기', 'DN:내리기', 'PR:연속읽기', 'LS:번호점프', 'LD:날짜점프', 'K:주제어검색', 'KW:주제어목록', 'LT:제목검색', 'LI:ID검색', 'H'],
  postList: ['F', 'B', 'L', 'P', 'T', 'GO', 'W:글쓰기', 'PR:연속읽기', 'LS:번호점프', 'LD:날짜점프', 'K:주제어검색', 'KW:주제어목록', 'LT:제목검색', 'LI:ID검색', 'H'],
  // [LOG_ID: 20260724_1950] 사용자 요청: "다음(F),이전(B),상위(P) 힌트바에 써줘" — '다음페이지'/
  // '이전페이지'는 길어서 모바일 폭에서 다른 토큰을 더 밀어냈다. 짧은 '다음'/'이전'으로 줄여도
  // shouldShowFooterToken의 페이지네이션 숨김 검사(['다음쪽','다음','다음페이지'] 등)가 이미
  // 인식하는 라벨이라 마지막/첫 페이지에서 숨는 동작은 그대로 유지된다.
  // [LOG_ID: 20260724_2000] 사용자 요청: "초기화면 대신에 상위(P)" — 요청한 세 토큰(F/B/P)에
  // 없던 T(초기화면)가 우선순위(98)가 높아 늘 함께 노출되며 상위(P)의 존재감을 가렸다. T를
  // 목록에서 빼도 T 명령 자체는 그대로 동작한다(commandRouterPostView.js가 타이핑 입력을
  // 별도로 처리) — 힌트바 노출만 뺀다.
  postView: ['F:다음', 'B:이전', 'P', 'GO', 'N:다음글', 'A:이전글', 'OK:추천', 'E:수정', 'D:삭제', 'H'],
  postWrite: ['P:취소', 'S:저장', 'H'],
  // [LOG_ID: 20260721_1830] 'EAR:귓속말'을 두 화면 모두에서 뺐다 — chat(대화방): /EAR은
  // "대상 아이디 메시지" 두 인자가 필요해 클릭 한 번으로는 완성할 수 없고(타이핑으로는 그대로
  // 동작), chatLobby(대기실): 애초에 아직 아무 방에도 안 들어간 상태라 귓속말 핸들러 자체가
  // 없어 EAR을 눌러도(쳐도) 아무 반응이 없었다. 'ST:상황판'도 chatLobby에서 같은 이유로
  // 뺐다 — /ST(현재 방 접속자 조회) 핸들러가 chat-room 안에만 있어 대기실에선 완전히
  // 죽어 있었다 — "다른 화면도 명령어 감사해줘" 조사로 발견.
  chat: ['P', 'T', 'GO', 'O:방만들기', 'ST:상황판', 'H'], // [LOG: 20260609_1135] HI(내정보) 삭제
  // [LOG_ID: 20260718_1700] O(방만들기)는 CMD_META에서 login:true라 게스트 힌트바에선
  // 의도적으로 숨는다(로그인 시 노출). 원본의 "참여(번호)"는 힌트바 토큰이 아니라 프롬프트가
  // 안내한다 — 토큰 파서(terminalHintMarkup)는 ASCII 명령만 받으므로 한글 토큰은 못 쓴다.
  chatLobby: ['P', 'T', 'GO', 'O:방만들기', 'H'],
  // [LOG_ID: 20260722_3700] DD:삭제 — 나우누리 책(p.114) "DD 3-9"(범위)/"DD 1,3,4..."(나열)
  // 다중 삭제 재현.
  memoList: ['P', 'T', 'GO', 'W:쓰기', 'WMAIL:올리기', 'DD:삭제', 'H'],
  // [LOG_ID: 20260716_1800] K:보관 — 하이텔 (10)-5 편지보관함(mbox).
  // [LOG_ID: 20260722_3500] N/A — 하이텔 책(p.109) "이동 명령어 'A'(나중에 도착한 편지)/'N'(전에 도착한 편지)".
  // terminalHintMarkup.js가 정확히 '이전글'/'다음글' 라벨만 post-view 전용으로 숨기므로(이번 세션에서
  // 손대지 않기로 한 파일), 그 문자열과 다른 커스텀 라벨(이전편지/다음편지)을 써서 필터에 걸리지 않게 한다.
  memoView: ['L:목록', 'N:다음편지', 'A:이전편지', 'P', 'T', 'GO', 'RE:답장', 'WMAIL:전달', 'K:보관', 'DD:삭제', 'H'],
  memoWrite: ['P:취소', 'SEND:전송', 'H'],
  // [LOG_ID: 20260719_2300] ME:쪽지쓰기 — 나우로 웹프리 ID수첩("아이디 클릭 → 바로 쪽지 보내기") 재현.
  profile: ['P', 'T', 'GO', 'ME:쪽지쓰기', 'H'],
  // [LOG_ID: 20260716_1400] 하이텔 (1)-24 이용자검색 — 원전의 byid/byname 두 하위 항목을
  // 별도 화면이 아니라 한 화면의 두 명령으로 흡수했다(그냥 입력하면 아이디→이름 순 검색).
  memberSearch: ['BYID:아이디로', 'BYNAME:이름으로', 'P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260716_1600] 하이텔 (1)-6/8 전체 메뉴 안내 — help처럼 F/B로 페이징하고,
  // 목록의 코드를 그냥 입력하면 GO 없이 바로 이동한다.
  // [LOG_ID: 20260725_1030] 짧은 라벨 + T 생략 구조로 통일(위 help 주석 참고)
  menuIndex: ['F:다음', 'B:이전', 'P', 'GO', 'H'],
  myInfoView: ['P', 'T', 'GO', 'H'],
  myInfoEdit: ['P:취소', 'T', 'ENTER:변경', 'H'],
  myInfoDelete: ['P:취소', 'T', 'ENTER:탈퇴', 'H'],
  login: ['P', 'LOGIN', 'H'],
  passwordResetRequest: ['P:취소', 'SEND:전송', 'H'],
  passwordResetUpdate: ['P:취소', 'CHANGE:변경', 'H'],
  systemInfo: ['P', 'T', 'GO', 'H'],
  systemLog: ['P', 'T', 'GO', 'R:새로고침', 'C:지우기', 'CP:복사', 'H'],
  attachmentList: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260725_1030] 짧은 라벨 + T 생략 구조로 통일(위 help 주석 참고)
  newsList: ['F:다음', 'B:이전', 'P', 'GO', 'H'],
  // [LOG_ID: 20260712_0030] PR 표기를 '연속읽기'로 통일(사용자 결정) — 게시판(postList)과 동일 용어.
  // [LOG_ID: 20260712_0100] N/A는 뉴스 기사 화면에서 실제 동작(이전/다음 기사 이동)하는데,
  // 기본 라벨 '이전글/다음글'이 shouldShowFooterToken의 "post-view 전용" 숨김 규칙에 걸려
  // 힌트바에서만 사라져 있었다(coroke 참조 구현은 기사 화면에 '글이동(A,N)'을 표시).
  // 뉴스 맥락에 맞는 라벨로 오버라이드해 숨김 규칙을 피하고 표기도 정확히 한다.
  serviceArticle: ['F', 'B', 'N:이전기사', 'A:다음기사', 'P', 'T', 'PR:연속읽기', 'H'],
  // [LOG_ID: 20260710_1530] PR(복사) 전체 보기 모드: 엔터로 페이지 보기 복귀
  serviceArticleFull: ['ENTER:페이지보기', 'N', 'A', 'P', 'T', 'H'],
  amusementInput: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260725_0830] F 추가 — 혈액형 결과처럼 본문이 길어 여러 페이지로 나뉘는 화면에서
  // 클릭 가능한 "다음(F)" 토큰을 제공한다. shouldShowFooterToken의 기본 폴백(state.serviceData
  // .pageNo/pageCount, terminalHintMarkup.js getFooterPageState 참고)이 이미 이 값을 안 쓰는
  // 다른 amusementView 화면(예: bio-result)에서는 pageNo/pageCount가 항상 1이라 자동으로 숨는다.
  amusementView: ['L:처음', 'F', 'P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260715_1100] 설문조사(여론광장/ACRO) 화면 전용 카테고리 — 종전엔 표준
  // 힌트바(P/T/GO/H, amusementInput 재사용) 위에 "[번호] 보기 | [W] 설문등록 | [P] 이전 |
  // [M] ... | [T] 대문" 같은 문구를 ANSI 본문에 직접 하드코딩해 완전히 중복되면서도
  // 서로 다른 용어(이전/상위, 대문/초기화면)를 썼다(사용자 지적: "메뉴가 이상하다"). 다른
  // 화면(postList/memoList 등)과 동일하게 표준 힌트바 토큰 체계로 흡수한다.
  voteList: ['P', 'T', 'GO', 'W:설문등록', 'H'],
  voteDetail: ['B:목록', 'P', 'T', 'GO', 'H'],
  voteCreate: ['B:취소', 'P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260719_1600] 토론의 광장(CONF) 하단 힌트바
  confRooms: ['O:회의실개설', 'P', 'T', 'GO', 'H'],
  confAgendas: ['N:안건발의', 'B:회의실', 'C:닫기', 'P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260726_2300] 본문 페이징 추가(buildConfAgendaViewAnsi) — 게시글 보기와 동일하게
  // F:다음/B:이전을 안내한다(B는 1쪽에서는 기존처럼 목록으로 동작, postView와 같은 관례).
  confAgenda: ['R:재청', 'F:다음', 'B:이전', 'P:목록', 'T', 'GO', 'H'],
  confRoomCreate: ['P:취소', 'T', 'GO', 'H'],
  confAgendaNew: ['P:취소', 'T', 'GO', 'H'],

  // [LOG_ID: 20260720_1358] 오락실 게임 5종 — 진행/종료 공용(arcadePlay). 행맨은 진행 중
  // 단일 알파벳이 전부 추측으로 소비되므로 내비게이션 키를 안내하지 않는다(hangmanPlay).
  arcadePlay: ['L:새게임', 'P', 'T', 'GO', 'H'],
  hangmanPlay: ['0:포기']
};

const SCREEN_TO_CATEGORY = {
  main: 'top',
  'board-select': 'menu',
  help: 'help',
  history: 'history',
  policy: 'policy',
  'post-list': 'postList',
  'post-view': 'postView',
  'post-write': 'postWrite',
  chat: 'chat',
  'chat-lobby': 'chatLobby',
  'chat-room': 'chat',
  'news-menu': 'newsMenu',
  'news-list': 'newsList',
  'news-view': 'serviceArticle',
  'weather-menu': 'weatherMenu',
  'weather-view': 'weatherView',
  'memo-list': 'memoList',
  'memo-view': 'memoView',
  'memo-write': 'memoWrite',
  profile: 'profile',
  'member-search': 'memberSearch',
  'menu-index': 'menuIndex',
  // [LOG_ID: 20260716_2200] 이용 현황 — 다른 조회 전용 화면과 같은 systemInfo(P/T/GO/H).
  'my-stats': 'systemInfo',
  'active-users': 'systemInfo',
  'activity-summary': 'systemInfo',
  'system-diagnostics': 'systemInfo',
  'system-log': 'systemLog',
  'attachment-list': 'attachmentList',
  'bio-input': 'amusementInput', 'bio-result': 'amusementView',
  'fortune-input': 'amusementInput', 'fortune-result': 'amusementView',
  'mbti-list': 'amusementInput', 'mbti-detail': 'amusementView',
  'retro-list': 'amusementInput', 'retro-view': 'amusementView',
  // [LOG_ID: 20260721_2010] blood/compat/tojeong 7개 화면이 SCREEN_TO_CATEGORY에 아예 없어
  // 힌트바가 완전히 비어 있었다(getSupportedFooterText가 category를 못 찾고 '' 반환) —
  // 다른 철학관 입력/결과 화면과 동일하게 amusementInput/amusementView로 매핑한다.
  'blood-input': 'amusementInput', 'blood-result': 'amusementView',
  'compat-input': 'amusementInput', 'compat-input2': 'amusementInput', 'compat-result': 'amusementView',
  'tojeong-input': 'amusementInput', 'tojeong-result': 'amusementView',
  // [LOG_ID: 20260720_1358] 오락실 게임 5종 (오목/오델로/숫자야구/영어단어맞추기/숫자판맞추기)
  'omok-play': 'arcadePlay', 'oth-play': 'arcadePlay', 'base-play': 'arcadePlay',
  'hangman-play': 'hangmanPlay', 'puzzle15-play': 'arcadePlay',
  'scramble-play': 'arcadePlay', 'wp-play': 'arcadePlay',
  'typing-play': 'arcadePlay', 'quiz-play': 'arcadePlay',
  'battle-play': 'arcadePlay',
  'vote-list': 'voteList', 'vote-detail': 'voteDetail', 'vote-create': 'voteCreate',
  'conf-rooms': 'confRooms', 'conf-agendas': 'confAgendas', 'conf-agenda': 'confAgenda',
  'conf-room-create': 'confRoomCreate', 'conf-agenda-new': 'confAgendaNew',
  login: 'login',
  signup: 'authMenu'
};

export function createCommandFooterTextUtils(deps) {
  const { state } = deps;
  // [LOG: 20260611_1524] Store prompts without trailing spaces; CSS owns the one-cell prompt gap.
  const DEFAULT_COMMAND_PROMPT = '선택 >>';

  // [LOG: 20260622_1900] 푸터를 '번호/명령(...)' 디렉티브로 emit한다. renderHintMarkup이 이를 .cmd-entry-list +
  // 우선순위(.cmd-entry[data-priority])로 변환하므로, 너비 기반 동적 트림(trimHintEntriesToFit)이 작동한다.
  // 토큰은 'CMD' 또는 'CMD:라벨'(공백 구분). 안 넘치면 전부 노출, 넘치면 우선순위 낮은 순으로 숨겨 H tooltip에 모음.
  function formatCommandFooter(order) {
    const tokens = (Array.isArray(order) ? order : [])
      .map((token) => String(token || '').trim())
      .filter(Boolean);
    return tokens.length ? `번호/명령(${tokens.join(' ')})\n${DEFAULT_COMMAND_PROMPT}` : '';
  }

  function getCommandFooterText(category) {
    let order = Array.isArray(CMD_ORDER[category]) ? CMD_ORDER[category] : [];
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile) {
      if (category === 'help') {
        // [LOG_ID: 20260718_2330] 페이지가 1쪽뿐인 도움말(F/B가 둘 다 필터링되는 경우)에서
        // T·GO까지 빠져 있어 상위(P) 토큰 하나만 남아 보였다(사용자 지적: "메뉴 힌트바가 많이
        // 없어졌는데"). 데스크톱 help 세트와 동일하게 맞춘다 — 안 들어가면 동적
        // 트림(trimHintEntriesToFit)이 알아서 H 툴팁으로 접는다.
        // [LOG_ID: 20260725_1030] 데스크톱 help 세트에서 T를 뺐으므로(전수조사) 여기도 맞춘다.
        order = ['F:다음', 'B:이전', 'P', 'GO'];
      }
      // [LOG_ID: 20260723_1900] policy/newsList/weatherView/menuIndex도 같은 종류의 문제였다
      // (사용자 지적: "힌트바에 기능이 두개만 나오는데. 원래 더 많은데") — 페이지가 1쪽뿐이라
      // F/B가 둘 다 필터링되면 P,H(또는 P만)만 남아 T·GO가 완전히 사라져 보였다. 위 help 수정과
      // 동일한 원인이었는데 그때는 help만 고쳐졌고 나머지 셋은 예전의 축소 목록(F/B/P/H)이
      // 그대로 남아 있었다. CMD_ORDER[category]의 데스크톱 풀세트를 그대로 쓰고 동적
      // 트림(trimHintEntriesToFit)이 좁은 화면에서 알아서 줄이도록 맡긴다 — 별도 오버라이드 불필요.
    }

    // [LOG_ID: 20260713_1230] 쪽지함 상자별 힌트바 — 보낸쪽지함에서는 나우누리 CMAIL식
    // 발송취소(CM)를, 받은쪽지함에서는 보낸쪽지함 전환(S)을 안내한다.
    // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) 추가 — 상자가 셋이 됐다.
    if (category === 'memoList' && state) {
      if (state._memoBox === 'archive') {
        order = ['P', 'T', 'GO', 'I:받은쪽지', 'S:보낸쪽지', 'K:보관해제', 'H'];
      } else if (state._memoBox === 'sent') {
        order = ['P', 'T', 'GO', 'I:받은쪽지', 'MB:보관함', 'CM:발송취소', 'K:보관', 'H'];
      } else {
        // [LOG_ID: 20260720_1740] WMAIL:올리기(나우누리), WC:축하카드(vmail), GRP:그룹(주소록) 3사 기능 힌트 전역 통합
        order = ['P', 'T', 'GO', 'W:쓰기', 'WMAIL:올리기', 'WC:축하카드', 'GRP:그룹', 'S:보낸쪽지', 'MB:보관함', 'K:보관', 'H'];
      }
    }

    // [LOG_ID: 20260720_1740] 테마 구분 없이 3사 기능이 힌트바에 통합되어 나우누리 전용 오버라이드 제거

    return formatCommandFooter(order);
  }

  function getSupportedFooterText(nextState = state) {
    const currentState = nextState || state || {};
    const currentScreen = String(currentState.screen || '').trim();

    // [LOG_ID: 20260723_1139] 사용자 지시 — 오락실의 모든 입력/결과 화면에서 하단 힌트바(L/P/T/GO/H 등)가 노출되고 마우스 클릭 가능해야 함.
    // 미니게임 플레이 화면(omok-play 등)만 게임에 집중하도록 힌트바 숨김 유지.
    const gamePlayOnlyScreens = [
      'omok-play', 'oth-play', 'base-play', 'hangman-play',
      'puzzle15-play', 'scramble-play', 'wp-play', 'typing-play',
      'quiz-play', 'battle-play'
    ];
    if (gamePlayOnlyScreens.includes(currentScreen)) {
      return '';
    }

    if (!currentScreen) {
      return getCommandFooterText('top');
    }

    // [LOG: 20260429_1033] /log uses the shared board-select screen, but its
    // auth menu footer should not advertise the LOGIN shortcut in the hint bar.
    if (currentScreen === 'board-select' && String(currentState.boardMenuPath || '').trim().toLowerCase() === 'log') {
      return getCommandFooterText('authMenu');
    }

    // [LOG_ID: 20260710_1530] PR(복사) 전체 보기 모드에서는 엔터 복귀 힌트를 우선 노출한다.
    if (currentScreen === 'news-view' && currentState.serviceData?._printView) {
      return getCommandFooterText('serviceArticleFull');
    }

    // [LOG: 20260429_1033] Unified PDS list keeps paging/search hints but
    // omits the first-page shortcut token from the shared footer.
    if (currentScreen === 'post-list') {
      const boardId = String(currentState.board?.boardId || currentState.board?.id || '').trim().toLowerCase();
      if (boardId === 'pds') {
        return getCommandFooterText('pdsList');
      }
    }

    if (currentScreen === 'myinfo') {
      const mode = String(currentState._myInfoMode || 'view').trim().toLowerCase();
      if (mode === 'delete') return getCommandFooterText('myInfoDelete');
      if (mode === 'nickname' || mode === 'email' || mode === 'password') return getCommandFooterText('myInfoEdit');
      return getCommandFooterText('myInfoView');
    }

    if (currentScreen === 'password-reset') {
      return getCommandFooterText(
        currentState._passwordResetMode === 'update'
          ? 'passwordResetUpdate'
          : 'passwordResetRequest'
      );
    }

    const category = SCREEN_TO_CATEGORY[currentScreen];
    return category ? getCommandFooterText(category) : '';
  }

  return { getCommandFooterText, getSupportedFooterText };
}
