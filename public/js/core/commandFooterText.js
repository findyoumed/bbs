/**
 * commandFooterText.js
 * [LOG: 20260428_2002] Standardized command footer categories and screen mappings.
 */

export const CMD_ORDER = {
  top: ['GO', 'LOGIN', 'PF', 'C:바탕색', 'H'], // [LOG: 20260609_1157] WHO(회원정보) 삭제, HI(내정보) 삭제
  menu: ['P', 'T', 'GO', 'LOGIN', 'PF', 'H'], // [LOG: 20260609_1157] WHO(회원정보) 삭제, HI(내정보) 삭제
  authMenu: ['P', 'T', 'GO', 'H'],
  help: ['F:다음페이지', 'B:이전페이지', 'P', 'T', 'GO'],
  history: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260713_2100] GUIDE 화면 이용약관/개인정보처리방침 뷰어 — help와 동일하게 페이징.
  // [LOG_ID: 20260716_2326] '다음페이지', '이전페이지' 라벨 오버라이드
  policy: ['F:다음페이지', 'B:이전페이지', 'P', 'T', 'GO', 'H'],
  newsMenu: ['P', 'T', 'GO', 'LOGIN', 'H'],
  weatherMenu: ['P', 'T', 'GO', 'H'],
  weatherView: ['F:다음페이지', 'B:이전페이지', 'P', 'T', 'GO', 'H'],
  // [LOG: 20260622_1900] 힌트바는 동적 너비 기반(trimHintEntriesToFit)으로 자동 맞춤한다.
  // 전체 명령을 나열해도 화면에 들어가는 만큼만 표시되고, 넘치면 우선순위 낮은 순으로 숨겨 도움말(H)
  // 토큰 tooltip에 모인다. (안 넘치면 전부 노출 — 일부러 줄이지 않음)
  pdsList: ['F', 'B', 'P', 'T', 'GO', 'UP:올리기', 'DN:내리기', 'PR:연속읽기', 'LS:번호점프', 'LD:날짜점프', 'K:주제어검색', 'KW:주제어목록', 'LT:제목검색', 'LI:ID검색', 'H'],
  postList: ['F', 'B', 'L', 'P', 'T', 'GO', 'W:글쓰기', 'PR:연속읽기', 'LS:번호점프', 'LD:날짜점프', 'K:주제어검색', 'KW:주제어목록', 'LT:제목검색', 'LI:ID검색', 'H'],
  postView: ['L:목록', 'N', 'A', 'P', 'T', 'GO', 'RE:답장', 'E:수정', 'D:삭제', 'V:추천', 'U:첨부', 'LT:제목검색', 'LI:ID검색', 'H'],
  postWrite: ['P:취소', 'S:저장', 'H'],
  chat: ['P', 'T', 'GO', 'O:방만들기', 'H'], // [LOG: 20260609_1135] HI(내정보) 삭제
  // [LOG_ID: 20260718_1700] O(방만들기)는 CMD_META에서 login:true라 게스트 힌트바에선
  // 의도적으로 숨는다(로그인 시 노출). 원본의 "참여(번호)"는 힌트바 토큰이 아니라 프롬프트가
  // 안내한다 — 토큰 파서(terminalHintMarkup)는 ASCII 명령만 받으므로 한글 토큰은 못 쓴다.
  chatLobby: ['P', 'T', 'GO', 'O:방만들기', 'H'],
  memoList: ['P', 'T', 'GO', 'W:쓰기', 'H'],
  // [LOG_ID: 20260716_1800] K:보관 — 하이텔 (10)-5 편지보관함(mbox).
  memoView: ['L:목록', 'P', 'T', 'GO', 'RE:답장', 'K:보관', 'DD:삭제', 'H'],
  memoWrite: ['P:취소', 'SEND:전송', 'H'],
  profile: ['P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260716_1400] 하이텔 (1)-24 이용자검색 — 원전의 byid/byname 두 하위 항목을
  // 별도 화면이 아니라 한 화면의 두 명령으로 흡수했다(그냥 입력하면 아이디→이름 순 검색).
  memberSearch: ['BYID:아이디로', 'BYNAME:이름으로', 'P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260716_1600] 하이텔 (1)-6/8 전체 메뉴 안내 — help처럼 F/B로 페이징하고,
  // 목록의 코드를 그냥 입력하면 GO 없이 바로 이동한다.
  menuIndex: ['F:다음페이지', 'B:이전페이지', 'P', 'T', 'GO', 'H'],
  myInfoView: ['P', 'T', 'GO', 'H'],
  myInfoEdit: ['P:취소', 'T', 'ENTER:변경', 'H'],
  myInfoDelete: ['P:취소', 'T', 'ENTER:탈퇴', 'H'],
  login: ['P', 'LOGIN', 'H'],
  passwordResetRequest: ['P:취소', 'SEND:전송', 'H'],
  passwordResetUpdate: ['P:취소', 'CHANGE:변경', 'H'],
  systemInfo: ['P', 'T', 'GO', 'H'],
  systemLog: ['P', 'T', 'GO', 'R:새로고침', 'C:지우기', 'CP:복사', 'H'],
  attachmentList: ['P', 'T', 'GO', 'H'],
  newsList: ['F:다음페이지', 'B:이전페이지', 'P', 'T', 'GO', 'H'],
  // [LOG_ID: 20260712_0030] PR 표기를 '연속읽기'로 통일(사용자 결정) — 게시판(postList)과 동일 용어.
  // [LOG_ID: 20260712_0100] N/A는 뉴스 기사 화면에서 실제 동작(이전/다음 기사 이동)하는데,
  // 기본 라벨 '이전글/다음글'이 shouldShowFooterToken의 "post-view 전용" 숨김 규칙에 걸려
  // 힌트바에서만 사라져 있었다(coroke 참조 구현은 기사 화면에 '글이동(A,N)'을 표시).
  // 뉴스 맥락에 맞는 라벨로 오버라이드해 숨김 규칙을 피하고 표기도 정확히 한다.
  serviceArticle: ['F', 'B', 'N:이전기사', 'A:다음기사', 'P', 'T', 'PR:연속읽기', 'H'],
  // [LOG_ID: 20260710_1530] PR(복사) 전체 보기 모드: 엔터로 페이지 보기 복귀
  serviceArticleFull: ['ENTER:페이지보기', 'N', 'A', 'P', 'T', 'H'],
  amusementInput: ['P', 'T', 'GO', 'H'],
  amusementView: ['L:처음', 'P', 'T', 'GO', 'H'],
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
  confAgenda: ['R:재청', 'P:목록', 'T', 'GO', 'H'],
  confRoomCreate: ['P:취소', 'T', 'GO', 'H'],
  confAgendaNew: ['P:취소', 'T', 'GO', 'H'],
  // [LOG_ID: 20260715_1300] 게시판 랭킹 화면도 여론광장과 동일한 유형의 중복 하드코딩
  // 안내줄("[1]레벨 [2]글수 [3]추천 [4]조회 | [M]오락실 [T]대문")을 본문에 갖고 있었다.
  // 여기선 M/T 목적지 자체는 정확했지만(랭킹은 실제로 오락실 하위), 표준 힌트바의
  // 상위(P)·초기화면(T)와 여전히 중복이었다 — 진짜 추가 정보(1~4 분류 전환, B)만
  // 표준 체계로 흡수한다.
  rankingSummary: ['1:레벨', '2:글수', '3:추천', '4:조회', 'P', 'T', 'GO', 'H'],
  rankingDetail: ['B:종합', '1:레벨', '2:글수', '3:추천', '4:조회', 'P', 'T', 'GO', 'H']
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
  'vote-list': 'voteList', 'vote-detail': 'voteDetail', 'vote-create': 'voteCreate',
  'ranking-summary': 'rankingSummary', 'ranking-detail': 'rankingDetail',
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
      if (category === 'policy' || category === 'newsList' || category === 'weatherView' || category === 'menuIndex') {
        order = ['F:다음', 'B:이전', 'P', 'H'];
      } else if (category === 'help') {
        order = ['F:다음', 'B:이전', 'P'];
      }
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
        // [LOG_ID: 20260719_1200] WC:축하카드(vmail). [LOG_ID: 20260719_1400] GRP:그룹(주소록).
        order = ['P', 'T', 'GO', 'W:쓰기', 'WC:축하카드', 'GRP:그룹', 'S:보낸쪽지', 'MB:보관함', 'K:보관', 'H'];
      }
    }

    // [LOG_ID: 20260713_1160] 나우누리 테마 시 대화방/쪽지함 힌트바 토큰 동적 오버라이드
    if (state && state.theme === 'nownuri') {
      if (category === 'chat' || category === 'chatLobby') {
        order = ['P', 'T', 'GO', 'O:방만들기', 'EAR:귓속말', 'ST:상황판', 'H'];
      } else if (category === 'memoList') {
        order = ['P', 'T', 'GO', 'WMAIL:올리기', 'H'];
      } else if (category === 'memoView') {
        order = ['L:목록', 'P', 'T', 'GO', 'RE:답장', 'WMAIL:전달', 'DD:삭제', 'H'];
      }
    }

    return formatCommandFooter(order);
  }

  function getSupportedFooterText(nextState = state) {
    const currentState = nextState || state || {};
    const currentScreen = String(currentState.screen || '').trim();

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
