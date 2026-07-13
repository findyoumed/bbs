import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';
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
    screenEl,
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

  async function openChatRoomCreate() {
    state._chatRoomCreateStage = 'title';
    state._chatRoomDraft = {};
    setPrompt('새 대화방 제목을 입력하여 주십시오. (취소: /M) >>');
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

    const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);
    const rooms = Array.isArray(roomsData) ? roomsData : (roomsData?.rooms || []);
    state._chatRooms = rooms;

    const ansiResult = buildChatLobbyAnsi(users, rooms);
    
    // 표준 ANSI 상단바 화면으로 렌더링
    renderAnsiScreenWithTopbar({ 
      ansiText: ansiResult.text || ansiResult, 
      ansiToHTML, 
      screenEl 
    });

    await applyCommandFooter(getMenuNodeByKey('chat')?.footer, getCommandFooterText('chat'));
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
    if (screenEl?.parentElement) screenEl.parentElement.classList.remove('is-loading');
  }

  async function showChatRoom(roomId, fromHistory = false) {
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

    const joinedRoom = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ sessionKey: state._chatSessionKey })
    });

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
      const ansiResult = buildChatRoomAnsi(state._chatRoom, state._chatMessages, nick, myId);
      
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
      await syncChatMessages({ silent: true, throwOnError: false });
      await refreshRoom();
    }, 3000);
  }

  return {
    openChatRoomCreate,
    showChatLobby,
    showChatRoom
  };
}
