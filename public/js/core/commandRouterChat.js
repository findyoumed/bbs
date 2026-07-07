import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createChatCommandHandler(deps) {
  const {
    ansiToHTML,
    apiFetch,
    buildChatRoomAnsi,
    cmdInput,
    openChatRoomCreate,
    restoreStateFromURL,
    screenEl,
    setHint,
    setPrompt,
    showChatLobby,
    showChatRoom,
    showMain,
    state
  } = deps;

  return async function handleChatCommand({ input, rawCmd, cmd, context }) {
    if (state.screen === 'chat-lobby') {
      if (state._chatRoomCreateStage) {
        const textInput = String(input || '');
        if (cmd === '/M') {
          state._chatRoomCreateStage = null;
          state._chatRoomDraft = null;
          await restoreStateFromURL();
          return true;
        }

        if (state._chatRoomCreateStage === 'title') {
          if (!textInput.trim()) {
            setHint('대화방 제목을 입력하여 주십시오. (취소: /M)');
            return true;
          }
          state._chatRoomDraft.title = textInput.trim();
          state._chatRoomCreateStage = 'greeting';
          setPrompt('환영 메시지 입력 [기본: 환영합니다] >>');
          return true;
        }

        if (state._chatRoomCreateStage === 'greeting') {
          state._chatRoomDraft.greeting = textInput.trim() || '환영합니다';
          state._chatRoomCreateStage = 'maxUser';
          setPrompt('최대 인원(1~99) [기본: 10] >>');
          return true;
        }

        if (state._chatRoomCreateStage === 'maxUser') {
          const parsedMaxUser = Number.parseInt(textInput.trim() || '10', 10);
          const maxUser = Number.isFinite(parsedMaxUser)
            ? Math.max(1, Math.min(99, parsedMaxUser))
            : 10;
          state._chatRoomDraft.maxUser = maxUser;
          state._chatRoomCreateStage = null;

          try {
            const room = await apiFetch('/api/chat/rooms', {
              method: 'POST',
              body: JSON.stringify(state._chatRoomDraft)
            });
            if (!room) {
              setHint('대화방 개설에 실패했습니다.');
              await restoreStateFromURL();
              return true;
            }
            await showChatLobby();
            if (room.no) {
              await showChatRoom(room.no);
            }
          } catch (error) {
            setHint('대화방 개설 중 오류가 발생했습니다.');
            await restoreStateFromURL();
          }
          return true;
        }
      }

      if (cmd === 'T' || cmd === 'P' || cmd === 'M' || cmd === 'B') {
        await showMain();
        return true;
      }
      if (cmd === 'O') {
        await openChatRoomCreate();
        return true;
      }

      const selectedRoom = parseInt(cmd, 10);
      if (selectedRoom >= 1 && state._chatRooms?.[selectedRoom - 1]) {
        await showChatRoom(state._chatRooms[selectedRoom - 1].no);
        return true;
      }
      return false;
    }

    if (state.screen === 'chat-room') {
      // [LOG: 20260707_1224] 상단바 로고 등 클릭으로 들어온 'T'는 메시지가 아니라 초기화면 이동 의도다.
      // (기존에는 "T"라는 메시지가 대화방에 전송되는 결함이 있었다. /T와 동일하게 처리한다.)
      if (context?.source === 'click' && cmd === 'T') {
        if (state._chatPollTimer) clearInterval(state._chatPollTimer);
        await showMain();
        return true;
      }

      // [LOG: 20260411_2345] 대화방 내 명령어는 반드시 '/'로 시작해야 함
      if (input.startsWith('/')) {
        const slashCmd = cmd.substring(1); // '/' 제외한 명령

        if (slashCmd === 'Q' || slashCmd === 'QUIT' || slashCmd === 'OUT' || slashCmd === 'EXIT' || slashCmd === 'BYE' || slashCmd === 'X') {
          if (state._chatPollTimer) clearInterval(state._chatPollTimer);
          if (state._chatRoomId) {
            await apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/leave`, {
              method: 'POST',
              body: JSON.stringify({ sessionKey: state._chatSessionKey })
            });
          }
          await showChatLobby();
          return true;
        }

        if (slashCmd === 'T' || slashCmd === 'TOP' || slashCmd === 'M') {
          if (state._chatPollTimer) clearInterval(state._chatPollTimer);
          await showMain();
          return true;
        }

        if (slashCmd === 'ST' || slashCmd === 'STATUS') {
          try {
            const usersData = await apiFetch(`/api/chat/active-users`);
            const names = (Array.isArray(usersData) ? usersData : []).map(u => u.nickName || u.userId).join(', ');
            setHint(`현재 접속자: ${names || '없음'}`);
          } catch (e) {
            setHint('접속자 정보를 가져오지 못했습니다.');
          }
          return true;
        }

        if (slashCmd.startsWith('AL ')) {
          const newNick = rawCmd.substring(4).trim();
          if (newNick) {
            state.user.nickName = newNick;
            setHint(`대화명이 [${newNick}]으로 변경되었습니다.`);
          }
          return true;
        }

        // [LOG: 20260507_1500] Unknown chat slash commands are ignored without footer noise.
        setHint('');
        return true;
      }

      // '/'로 시작하지 않는 모든 입력은 일반 메시지로 전송
      if (input) {
        // [LOG: 20260429_0005] 일반 채팅 메시지는 명령 정규화 결과가 아니라
        // 사용자가 입력한 원문을 그대로 보내야 Playwright/실제 UI와 일치한다.
        const messageText = String(input || '').trim();

        // [LOG: 20260411_2330] 메시지 전송 후 즉시 화면 갱신 (Optimistic UI)
        try {
          await apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: messageText, sessionKey: state._chatSessionKey })
          });
          // 성공 시 로컬 목록에 즉시 추가
          state._chatMessages = state._chatMessages || [];
          state._chatMessages.push({
            userId: state.user?.userId || 'me',
            nickName: state.user?.nickName || '나',
            content: messageText,
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          console.error('메시지 전송 실패:', e.message);
        }

        const nick = state.user?.nickName || '나';
        const ansiResult = buildChatRoomAnsi(state._chatRoom, state._chatMessages || [], nick);
        // [LOG: 20260707_1424] 낙관적 갱신도 표준 상단바 렌더러를 사용한다.
        // 기존의 screenEl.innerHTML 직접 조립은 상단바 없이 그려져 메시지 전송 직후 로고/시계가 사라졌다.
        renderAnsiScreenWithTopbar({ ansiText: ansiResult?.text || ansiResult, ansiToHTML, screenEl });
        if (shouldAutoFocusCommandInput()) {
          cmdInput.focus();
        }
        return true;
      }
    }

    return false;
  };
}
