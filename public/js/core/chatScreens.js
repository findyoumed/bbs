import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createChatScreens(deps) {
  const {
    ansiToHTML,
    apiFetch,
    applyCommandFooter,
    buildChatLobbyAnsi,
    buildChatRoomAnsi,
    cmdInput,
    getCommandFooterText,
    getMenuNodeByKey,
    renderScreenSequential,
    screenEl,
    setHint,
    setPrompt,
    state,
    updateURL
  } = deps;

  // [LOG: 20260429_0531] Fail closed when stale serviceData cannot be serialized,
  // so chat entry does not crash on leftover circular restore state.
  function snapshotServiceDataForHistory() {
    try {
      return JSON.parse(JSON.stringify(state.serviceData || {}));
    } catch (error) {
      console.error('채팅 히스토리 serviceData 스냅샷 실패:', error.message);
      return null;
    }
  }

  function pushHistory() {
    state.history.push({
      screen: state.screen,
      serviceData: snapshotServiceDataForHistory(),
      page: state.page
    });
  }

  async function openChatRoomCreate(initialTitle = '') {
    state._chatRoomDraft = {};
    if (initialTitle) {
      state._chatRoomDraft.title = initialTitle;
      state._chatRoomCreateStage = 'greeting';
      setPrompt('새 대화방 환영 메세지를 입력하여 주십시오. (취소: /M) >>');
    } else {
      state._chatRoomCreateStage = 'title';
      setPrompt('새 대화방 제목을 입력하여 주십시오. (취소: /M) >>');
    }
  }

  async function showChatLobby(fromHistory = false) {
    state.screen = 'chat-lobby';
    if (!fromHistory) {
      updateURL();
      pushHistory();
    }
    
    // 로딩 표시 (통일된 스타일)
    if (screenEl?.parentElement) screenEl.parentElement.classList.add('is-loading');

    const [usersData, roomsData] = await Promise.all([
      apiFetch('/api/system/active-users'),
      apiFetch('/api/chat/rooms')
    ]);

    // [LOG: 20260801_2000] ESC 취소 후 stale fetch가 이전 화면을 덮어씌우는 경쟁 조건 가드
    // is-loading 클래스는 여기서 직접 추가했으므로 조기 반환 시 직접 제거해야 한다.
    if (state.screen !== 'chat-lobby') {
      if (screenEl?.parentElement) screenEl.parentElement.classList.remove('is-loading');
      return;
    }

    const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);
    const rooms = Array.isArray(roomsData) ? roomsData : (roomsData?.rooms || []);
    state._chatRooms = rooms;

    const ansiResult = buildChatLobbyAnsi(users, rooms);

    // [LOG_ID: 20260713_2000] 화면 진입(1회성 렌더)이라 위→아래 순차 스트리밍 대상.
    // (반면 아래 refreshRoom()의 폴링 재렌더는 매 tick 스트리밍하면 어색해 그대로 둔다.)
    await renderAnsiScreenWithTopbarSequential({
      ansiText: ansiResult.text || ansiResult,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        // [LOG_ID: 20260718_1700] 로비 힌트바에 개설(O:방만들기)이 안 보이던 문제. 원인: txt 애셋
        // (cmd_chat_footer.txt="번호/명령(H,P,T,GO,HI,Z,X)", O 없음)이 chatLobby 카테고리를
        // 덮어썼다. 애셋 대신 카테고리를 직접 써서 로그인 사용자에게 방만들기(O)가 노출되게 한다
        // (O는 login 전용이라 게스트에겐 여전히 숨는다). 방 안 화면(line 146)은 명령 집합이 달라
        // 계속 txt 애셋을 쓴다.
        await applyCommandFooter('', getCommandFooterText('chatLobby'));
      }
    });

    if (shouldAutoFocusCommandInput()) cmdInput.focus();
    if (screenEl?.parentElement) screenEl.parentElement.classList.remove('is-loading');
  }

  async function showChatRoom(roomId, fromHistory = false, password = '') {
    state.screen = 'chat-room';
    state._chatRoomId = roomId;
    if (!fromHistory) {
      updateURL();
      pushHistory();
    }
    state._chatMessages = [];

    if (!state._chatSessionKey) {
      state._chatSessionKey = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // [LOG_ID: 20260718_1600] 비공개방 입장 시 비밀번호를 join에 실어 보낸다(olddos-bbs 원본 참고).
    // 서버는 password가 틀리면 403을 낸다 — 호출부(commandRouterChat)가 잡아 재입력을 유도한다.
    const joinBody = { sessionKey: state._chatSessionKey };
    if (password) joinBody.password = password;
    // [LOG: 20260801_2220] join API 완료/중단 후 화면 경쟁 조건 가드 — ESC로 취소된 경우 서버에
    // leave를 전송해 유령 참여자(TTL 최대 6시간)를 즉시 정리한다.
    // Case A: join 중 ESC → apiFetch가 cancelled 오류로 throw, state.screen 이미 이전 화면으로 복원됨.
    // Case B: join 완료 후 ESC → apiFetch 정상 반환, state.screen 이미 이전 화면으로 복원됨.
    let joinedRoom;
    let joinAborted = false;
    try {
      joinedRoom = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        body: JSON.stringify(joinBody)
      });
    } catch (joinError) {
      if (state.screen !== 'chat-room') {
        // ESC가 join 중 발생 — 아래의 통합 가드에서 정리한다.
        joinAborted = true;
      } else {
        // 실제 오류(비밀번호 오류, 정원 초과 등) — 호출자에게 전파한다.
        throw joinError;
      }
    }
    if (joinAborted || state.screen !== 'chat-room') {
      // 서버가 이미 join을 처리했을 수 있으므로 leave로 즉시 정리한다.
      try {
        await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/leave`, {
          method: 'POST',
          body: JSON.stringify({ sessionKey: state._chatSessionKey })
        });
      } catch (e) {
        // leave 실패는 non-critical — 서버가 join을 처리하지 않았을 수도 있음.
      }
      state._chatRoomId = null;
      return;
    }

    const room = (state._chatRooms || []).find((entry) => String(entry.id) === String(roomId) || String(entry.no) === String(roomId))
      || { id: roomId, no: roomId, title: '대화실' };
    state._chatRoom = { ...room, ...(joinedRoom || {}) };

    // [LOG: 20260428_2339] Real chat room restore/poll must hydrate server messages,
    // otherwise reloads and second viewers only see optimistic local state.
    async function syncChatMessages(options = {}) {
      const { silent = false, throwOnError = true } = options;

      try {
        const messages = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, { silent });
        state._chatMessages = Array.isArray(messages) ? messages : [];
        return state._chatMessages;
      } catch (error) {
        console.error('채팅 메시지 동기화 실패:', error.message);
        if (throwOnError) {
          throw error;
        }
        return state._chatMessages;
      }
    }

    async function refreshRoom() {
      if (state.screen !== 'chat-room') return;
      const nick = state.user?.nickName || '나';
      // [LOG_ID: 20260713_1020] buildChatRoomAnsi에 내 userId 추가 전달
      const myId = state.user?.userId || '';
      // [LOG_ID: 20260714_2200] 원전 /EX id(수신거부) 재현 — 뮤트한 상대의 메시지는
      // 폴링 재렌더 때마다 계속 걸러져야 하므로 여기서 필터링한다.
      const muted = state._chatMutedUserIds;
      const visibleMessages = muted && muted.size
        ? state._chatMessages.filter((m) => !muted.has(m.userId))
        : state._chatMessages;
      const ansiResult = buildChatRoomAnsi(state._chatRoom, visibleMessages, nick, myId);
      
      renderAnsiScreenWithTopbar({ 
        ansiText: ansiResult.text || ansiResult, 
        ansiToHTML, 
        screenEl 
      });
      
      await applyCommandFooter(getMenuNodeByKey('chat')?.footer, getCommandFooterText('chat'));
      if (shouldAutoFocusCommandInput()) cmdInput.focus();
    }

    await syncChatMessages();
    await refreshRoom();

    if (state._chatPollTimer) clearInterval(state._chatPollTimer);
    state._chatPollTimer = setInterval(async () => {
      if (state.screen !== 'chat-room') {
        clearInterval(state._chatPollTimer);
        return;
      }
      // [LOG_ID: 20260718_1800] 방장이 나가면 서버가 방을 삭제한다 — 남은 참여자의 폴링은
      // messages 조회에서 404를 받는다. 이를 감지해 "방장이 나가 대화방이 종료되었습니다"
      // 안내와 함께 대기실로 내보낸다(olddos 원본: 방장 퇴장 시 방 자동 종료).
      try {
        await syncChatMessages({ silent: true, throwOnError: true });
      } catch (error) {
        if (/찾을 수 없|not found|404/i.test(String(error?.message || ''))) {
          clearInterval(state._chatPollTimer);
          state._chatRoomId = null;
          await showChatLobby();
          setHint('방장이 나가 대화방이 종료되었습니다.');
          return;
        }
        // 그 외 일시적 오류는 무시하고 폴링을 계속한다.
      }
      await refreshRoom();
    }, 3000);
  }

  return {
    openChatRoomCreate,
    showChatLobby,
    showChatRoom
  };
}
