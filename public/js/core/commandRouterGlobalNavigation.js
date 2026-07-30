import { CMD_META } from './commandService.js';
import { listBuddies, addBuddy, removeBuddy } from './chatBuddies.js';

export function createGlobalNavigationCommandHandler(deps) {
  const {
    state,
    doLogout,
    toggleHintExpansion,
    executeGoCommand,
    showProfile,
    showActiveUsers,
    showMyInfo,
    showHelp,
    showHistory,
    showPolicy,
    // [LOG_ID: 20260716_1600] 전체 메뉴 안내(INDEX) — F/B 페이징 + 코드 직접 입력.
    showMenuIndex,
    handleHistoryBack,
    setHint,
    setPrompt,
    findBoardByCode,
    showPostList,
    showLogin,
    showConfirm,
    showMemoList,
    showMemoWrite,
    settingsService
  } = deps;

  function setDefaultPrompt() {
    setPrompt('>>');
  }

  function isLoginShortcutScreen() {
    return ['main', 'board-select', 'top'].includes(state.screen);
  }

  return async function handleGlobalNavigationCommand({ cmd, rawCmd, input }) {

    if (cmd === 'LOGIN' || (cmd === 'L' && isLoginShortcutScreen())) {
      if (state.user?.isGuest) {
        if (typeof showLogin === 'function') {
          showLogin();
          return true;
        }
        return false;
      }

      if (cmd === 'LOGIN') {
        setHint('이미 로그인되어 있습니다.');
        setDefaultPrompt();
        return true;
      }
    }

    // [LOG_ID: 20260729_1750] FIND 단독 입력 시에도 통합 검색 안내 및 동작 수행
    if (cmd === 'FIND' || cmd.startsWith('/') || cmd.startsWith('FIND ')) {
      // [LOG: 20260703_1720] 대화실에서는 '/' 입력이 채팅 명령(/Q, /QUIT, /ST, /AL 등)이고
      // 일반 텍스트는 메시지이므로, 전역 검색이 가로채지 않고 chat 핸들러(commandRouterChat)로 넘긴다.
      // 대화방 개설 단계(chat-lobby + _chatRoomCreateStage)의 '/M' 취소 입력도 동일하게 보호한다.
      if (state.screen === 'chat-room' || (state.screen === 'chat-lobby' && state._chatRoomCreateStage)) {
        return false;
      }
      const query = cmd === 'FIND' ? '' : (cmd.startsWith('/') ? rawCmd.slice(1).trim() : rawCmd.slice(5).trim());
      if (!query) {
        setHint('검색어를 입력해 주세요. (예: /안녕 또는 FIND 안녕)');
        setPrompt('검색어 >>');
        return true;
      }

      const lowerQuery = query.toLowerCase();

      if (state.screen === 'post-list' && state.board) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { lt: query }
        });
        return true;
      }

      const targetBoard = findBoardByCode(query);
      if (targetBoard) {
        setHint(`${targetBoard.name} 게시판으로 이동합니다...`);
        await showPostList(targetBoard.id || targetBoard.boardId, 1, {
          menuPath: targetBoard.menuPath || 'top',
          menuTitle: targetBoard.menuTitle || '게시판'
        });
        return true;
      }

      if (deps.menuService) {
        const menuTree = state.menuTree || (await deps.menuService.loadMenuTree());
        const findInNodes = (nodes) => {
          for (const node of nodes) {
            const label = (deps.menuService.getMenuNodeLabel(node) || '').toLowerCase();
            const code = (node.go || node.door || '').toLowerCase();
            if (label.includes(lowerQuery) || (code && code.includes(lowerQuery))) {
              return node;
            }
            if (node.children) {
              const found = findInNodes(node.children);
              if (found) {
                return found;
              }
            }
          }
          return null;
        };

        const targetNode = findInNodes(menuTree || []);
        if (targetNode) {
          setHint(`메뉴 [${deps.menuService.getMenuNodeLabel(targetNode)}] 로 이동합니다...`);
          await executeGoCommand(targetNode.go || targetNode.door || targetNode.id);
          return true;
        }
      }

      // [LOG_ID: 20260730_1719] '채팅', '대화', 'chat' 검색 시 대화실 로비로 바로 이동
      if (['채팅', '대화', 'chat'].includes(lowerQuery)) {
        setHint('대화실 로비로 이동합니다...');
        if (typeof deps.refs?.showChatLobby === 'function') {
          await deps.refs.showChatLobby();
          return true;
        }
      }

      const commandService = deps.commandService || { CMD_META };
      const meta = commandService.CMD_META || CMD_META;
      const keys = Object.keys(meta);
      // [LOG_ID: 20260730_1719] 1순위: key/label 완전/전두 일치, 2순위: desc 등 부분 매칭
      let cmdKey = keys.find((key) =>
        key.toLowerCase() === lowerQuery
        || (meta[key].label || '').toLowerCase() === lowerQuery
        || key.toLowerCase().startsWith(lowerQuery)
        || (meta[key].label || '').toLowerCase().startsWith(lowerQuery)
      );
      if (!cmdKey) {
        cmdKey = keys.find((key) =>
          key.toLowerCase().includes(lowerQuery)
          || (meta[key].label || '').toLowerCase().includes(lowerQuery)
          || (meta[key].desc || '').toLowerCase().includes(lowerQuery)
        );
      }

      if (cmdKey) {
        const commandMeta = meta[cmdKey];
        setHint(`명령어 정보: ${commandMeta.label}[${cmdKey}]\n설명: ${commandMeta.desc || ''}\n도움말: ${commandMeta.tip || ''}`);
        setDefaultPrompt();
        return true;
      }

      if (state.screen === 'news-list' && state.serviceData?.topicDoor) {
        setHint('뉴스 검색 기능은 준비 중입니다.');
        setDefaultPrompt();
        return true;
      }

      setHint(`[${query}] 에 대한 게시판, 메뉴 또는 명령어를 찾을 수 없습니다.`);
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'H' || cmd.startsWith('HELP') || cmd === '?') {
      const helpMatch = rawCmd.match(/^(HELP|H)\s+(.+)$/i);
      if (helpMatch) {
        await showHelp(helpMatch[2].trim());
      } else {
        await showHelp();
      }
      return true;
    }

    if (state.screen === 'help') {
      // [LOG_ID: 20260713_1230] 나우누리 GUIDE '명령어안내'식 분류 선택 — 0.전체 1~7.분류
      // [LOG_ID: 20260721_1800] 'SYS' 분류가 이 목록과 helpScreens.js의 HELP_TAB_KEYS 양쪽에서
      // 빠져 있어 H/HELP/CLS/HIST/SET/UNSET/ENV/CAP 등 실제 동작하는 명령들이 /help에 전혀
      // 보이지 않았다 — 두 곳 모두 'SYS'를 추가해 배선을 맞춘다.
      if (/^[0-7]$/.test(cmd)) {
        const helpTabKeys = ['NAV', 'POST', 'AUTH', 'MEMO', 'CHAT', 'UI', 'SYS'];
        state.helpTab = cmd === '0' ? 'all' : helpTabKeys[Number(cmd) - 1];
        await showHelp('', 1);
        return true;
      }
      if (cmd === 'F') {
        const nextPage = (state.page || 1) + 1;
        if (nextPage <= (state.helpTotalPages || 1)) {
          await showHelp('', nextPage);
        }
        return true;
      }
      if (cmd === 'B') {
        const prevPage = (state.page || 1) - 1;
        if (prevPage >= 1) {
          await showHelp('', prevPage);
        }
        return true;
      }
    }

    // [LOG_ID: 20260716_1600] 하이텔 (1)-6/8 전체 메뉴 안내 — F/B 페이징(help와 동일)에 더해,
    // 목록에 적힌 코드를 GO 없이 그대로 입력해도 이동한다(인덱스 화면의 존재 이유).
    if (state.screen === 'menu-index' && typeof showMenuIndex === 'function') {
      if (cmd === 'F') {
        const nextPage = (state.page || 1) + 1;
        if (nextPage <= (state.menuIndexTotalPages || 1)) {
          await showMenuIndex(nextPage);
        }
        return true;
      }
      if (cmd === 'B') {
        const prevPage = (state.page || 1) - 1;
        if (prevPage >= 1) {
          await showMenuIndex(prevPage);
        }
        return true;
      }
      // P/T(상위·초기화면)는 아래 공용 처리에 맡기고, 그 외 입력은 코드로 간주해 GO로 넘긴다.
      // 숫자 단독 입력(예: 1, 2)인 경우는 전체 목록의 다른 번호와 겹치므로 무시합니다.
      const keyword = String(rawCmd || '').trim();
      if (keyword && !['P', 'M', 'B', 'T', 'F', 'H'].includes(cmd) && !/^\d+$/.test(keyword)) {
        if (typeof executeGoCommand === 'function' && await executeGoCommand(`GO ${keyword}`)) {
          return true;
        }
      }
    }

    // [LOG_ID: 20260713_2100] GUIDE 이용약관/개인정보처리방침 뷰어 페이징 (help와 동일 패턴)
    if (state.screen === 'policy') {
      if (cmd === 'F') {
        const nextPage = (state.page || 1) + 1;
        if (nextPage <= (state.policyTotalPages || 1)) {
          await showPolicy(state.policyKind, nextPage);
        }
        return true;
      }
      if (cmd === 'B') {
        const prevPage = (state.page || 1) - 1;
        if (prevPage >= 1) {
          await showPolicy(state.policyKind, prevPage);
        }
        return true;
      }
    }

    if (cmd === '+') {
      toggleHintExpansion();
      return true;
    }

    if (await executeGoCommand(rawCmd)) {
      return true;
    }

    const whoMatch = cmd.match(/^(WHO|WH|PF)\s+(.+)$/);
    if (whoMatch) {
      // [LOG: 20260729_1624] PF/WHO [아이디]는 로그인한 사용자만 사용 가능.
      if (state.user?.isGuest) {
        setHint('회원 프로필 조회는 로그인 후 이용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      await showProfile(whoMatch[2].trim());
      return true;
    }

    const isWriteConflictScreen = ['post-list', 'memo-list', 'post-write', 'memo-write', 'login', 'password-reset', 'signup'].includes(state.screen);
    // [LOG_ID: 20260714_2100] 원전(NOW_MENU.DAT) 명령어표의 UID(총 접속자 ID 조회)/
    // USER ALL(전체 메뉴별 이용자 현황)을 추가 — 우리 접속자 목록 화면이 이미 사용자별
    // 위치(위치 컬럼)까지 보여주므로 기존 화면 그대로 재사용한다(신규 화면 불필요).
    if (cmd === 'USER' || cmd === 'USER ALL' || cmd === 'UID' || cmd === 'WHO' || cmd === 'WH' || (cmd === 'W' && !isWriteConflictScreen)) {
      await showActiveUsers();
      return true;
    }

    if (cmd === 'PF' || cmd === 'WHO' || cmd === 'WH') {
      // [LOG: 20260729_1624] 단독 PF/WHO는 로그인한 사용자에게만 허용 — 비로그인 시 로그인 안내.
      if (state.user?.isGuest) {
        setHint('회원 프로필 조회는 로그인 후 이용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      await showProfile(state.user?.userId || '');
      return true;
    }

    if (cmd === 'HI' || cmd === 'MYINFO') {
      if (state.user?.isGuest) {
        setHint('정보관리 및 프로필 편집은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      await showMyInfo();
      return true;
    }

    // [LOG_ID: 20260719_2300] "할 수 있다: 나우누리에서 인터넷까지" 대조 — 나우로 웹프리
    // 클라이언트의 ID수첩("아이디를 클릭 → 바로 쪽지/편지 보내기") 재현. 프로필 화면은
    // HISTORY_BACK_SCREENS(P/M/T/B만 지원)에 있어 여기서 W/ME/MEMO를 가로채지 않으면 아래
    // 전역 ME/MEMO 분기가 항상 받은편지함으로 보내버려, 프로필에서 본 상대에게 쪽지를 쓰려면
    // 아이디를 다시 손으로 입력해야 했다.
    if (state.screen === 'profile' && (cmd === 'W' || cmd === 'ME' || cmd === 'MEMO')) {
      if (state.user?.isGuest) {
        setHint('쪽지 기능은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      if (typeof showMemoWrite === 'function') {
        await showMemoWrite(state._profileUserId || '');
        return true;
      }
      return false;
    }

    // [LOG_ID: 20260713_1160] 전역 ME / MEMO / CMAIL 명령어 배선 추가 (나우누리 편지함 조회)
    // [LOG_ID: 20260714_1900] RMAIL(편지읽기)/MAIL(전자우편 진입) 추가 — 원전(NOW_MENU.DAT)의
    // "11.전자우편(MAIL) -1.편지읽기(RMAIL) -2.편지쓰기(WMAIL) -3.배달확인/취소(CMAIL)" 4개 명령
    // 중 RMAIL/MAIL만 배선이 빠져 있었다(사용자 지적).
    if (cmd === 'ME' || cmd === 'MEMO' || cmd === 'CMAIL' || cmd === 'RMAIL' || cmd === 'MAIL') {
      if (state.user?.isGuest) {
        setHint('쪽지함은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      if (typeof showMemoList === 'function') {
        // 처음 진입할 때 기본적으로 받은편지함(inbox)으로 설정되도록 초기화
        state._memoBox = 'inbox';
        await showMemoList();
        return true;
      }
      return false;
    }

    // [LOG_ID: 20260713_1160] 나우누리 편지쓰기(WMAIL) 명령어 배선 추가
    if (cmd === 'WMAIL') {
      if (state.user?.isGuest) {
        setHint('쪽지 기능은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      if (typeof showMemoWrite === 'function') {
        await showMemoWrite();
        return true;
      }
      return false;
    }

    // [LOG_ID: 20260714_2100] 원전 MSG 명령 — 메시지수신 상태 확인(ON/OFF로 변경), MSG R로
    // 최근 쪽지 확인. envVars.MSG='OFF'면 접속 시 새 쪽지 도착 알림(notifyUnreadMemos)을 끈다.
    const msgMatch = cmd.match(/^MSG(?:\s+(\S+))?$/);
    if (msgMatch) {
      const arg = (msgMatch[1] || '').toUpperCase();
      if (arg === 'R') {
        if (state.user?.isGuest) {
          setHint('쪽지함은 로그인 후 사용하실 수 있습니다.');
          setDefaultPrompt();
          return true;
        }
        state._memoBox = 'inbox';
        await showMemoList();
        return true;
      }
      if (arg === 'ON' || arg === 'OFF') {
        state.envVars = state.envVars || {};
        state.envVars.MSG = arg;
        if (settingsService) settingsService.saveEnvVars(state.envVars);
        setHint(`메시지 수신 알림이 ${arg === 'ON' ? '켜졌습니다' : '꺼졌습니다'}. (MSG R: 최근 쪽지 확인)`);
        setDefaultPrompt();
        return true;
      }
      const current = (state.envVars?.MSG || 'ON').toUpperCase();
      setHint(`메시지 수신 상태: ${current}\n사용법: MSG ON, MSG OFF, MSG R(최근 쪽지 확인)`);
      setDefaultPrompt();
      return true;
    }

    // [LOG_ID: 20260719_2200] 나우누리 원전 대화실 /BUDDY(접속 알림) 재현 — 실시간 푸시가 없어
    // "즉시 알림"까지는 못 가지만, UID/WHO 접속자 목록에서 버디를 강조 표시하는 조회형으로 스코프를
    // 좁혔다(buildActiveUsersAnsi에서 isBuddy 참조). 인자는 아이디 대소문자를 보존해야 하므로
    // 전부 대문자로 바뀐 cmd가 아니라 rawCmd에서 뽑는다.
    if (cmd === 'BUDDY' || cmd.startsWith('BUDDY ')) {
      const arg = String(rawCmd || '').replace(/^BUDDY\s*/i, '').trim();
      if (!arg) {
        const buddies = listBuddies();
        setHint(buddies.length
          ? `버디 목록: ${buddies.join(', ')}\n사용법: BUDDY [id](등록), BUDDY DEL [id](삭제)`
          : '등록된 버디가 없습니다.\n사용법: BUDDY [id]');
        setDefaultPrompt();
        return true;
      }
      const delMatch = arg.match(/^DEL\s+(.+)$/i);
      if (delMatch) {
        const targetId = delMatch[1].trim();
        const removed = removeBuddy(targetId);
        setHint(removed ? `[${targetId}]님을 버디 목록에서 삭제했습니다.` : `[${targetId}]님은 버디 목록에 없습니다.`);
        setDefaultPrompt();
        return true;
      }
      addBuddy(arg);
      setHint(`[${arg}]님을 버디로 등록했습니다. (UID/WHO 목록에서 ★로 표시됩니다)`);
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'CLS' || cmd === 'CLEAR') {
      if (typeof deps.renderScreenSequential === 'function') {
        await deps.renderScreenSequential('', { clear: true });
      }
      setHint('화면이 초기화되었습니다.');
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'HIST') {
      await showHistory();
      return true;
    }

    // [LOG_ID: 20260729_1747] Z (화면 재전송) 명령어 제거

    // [LOG_ID: 20260713_1140] 하이텔식 이용시간 확인(TIME) 커맨드 구현
    if (cmd === 'TIME') {
      const elapsedMs = Date.now() - (state._sessionStartTime || Date.now());
      const elapsedMin = Math.floor(elapsedMs / 60000);
      const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
      const now = new Date();
      const currentStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setHint(`[이용시간] 현재시각: ${currentStr} | 누적접속: ${elapsedMin}분 ${elapsedSec}초`);
      return true;
    }

    // [LOG_ID: 20260719_1600] 천리안 원전 6.4.2 재현 — BYE는 확인 없이 즉시 종료, X는 확인 후 종료로
    // 구분된다(원전: "X 명령을 사용하여 접속을 끝마칠 경우에는 정말로 접속을 종료할 것인지를
    // 물어오지만 BYE 명령을 사용하여 접속을 종료한다면 접속종료 여부를 묻지 않고 즉시 접속을
    // 종료하게 된다"). Q/EXIT/LOGOUT은 기존처럼 확인 절차를 유지한다.
    // [LOG: 20260729_1631] 확인 절차 제거 — BYE/Q/EXIT/X/LOGOUT 모두 즉시 종료.
    if (cmd === 'BYE' || cmd === 'Q' || cmd === 'EXIT' || cmd === 'X' || cmd === 'LOGOUT') {
      setHint('안녕히 가십시오.');
      await new Promise((r) => setTimeout(r, 400));
      if (!state.user?.isGuest) {
        await doLogout();
      }
      window.location.assign('/');
      return true;
    }

    // [LOG_ID: 20260718_1950] ANSI (ANSI 화면 제어코드 표현 설정) 명령어 구현
    if (cmd === 'ANSI' || cmd.startsWith('ANSI ')) {
      const parts = rawCmd.trim().split(/\s+/);
      const arg = (parts[1] || '').toUpperCase();
      if (!state.envVars) state.envVars = {};
      const current = state.envVars.ANSI || 'ON';
      let next = current === 'ON' ? 'OFF' : 'ON';
      if (arg === 'ON' || arg === 'OFF') {
        next = arg;
      }
      state.envVars.ANSI = next;
      if (deps.settingsService) {
        deps.settingsService.saveEnvVars(state.envVars);
      }
      setHint(`[ANSI 제어] 상태가 [${next}]으로 설정되었습니다.`);
      return true;
    }

    return false;
  };
}
