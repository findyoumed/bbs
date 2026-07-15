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

  // [LOG_ID: 20260718_1800] 대화방 퇴장 공통 처리 — 폴링 중단 + 서버에 leave 통지.
  // leave 통지가 있어야 방장 세션 퇴장 시 서버가 방을 자동 종료할 수 있다(원본 규칙).
  // 종전엔 /Q 계열만 leave를 호출하고 /T·/M·로고 클릭은 폴링만 끄고 나가, 방장이 그 경로로
  // 나가면 방이 안 닫혔다. 모든 퇴장 경로가 이 헬퍼를 쓴다.
  async function leaveCurrentRoom() {
    if (state._chatPollTimer) clearInterval(state._chatPollTimer);
    if (state._chatRoomId) {
      try {
        await apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/leave`, {
          method: 'POST',
          body: JSON.stringify({ sessionKey: state._chatSessionKey })
        });
      } catch (error) {
        // 퇴장 통지 실패는 화면 이동을 막지 않는다.
      }
    }
  }

  // [LOG_ID: 20260718_1600] 비공개방 입장 공통 처리(olddos-bbs 원본: 방번호 입력 → 비번 프롬프트 → 접속).
  // 내가 개설자면 비번 없이 바로 들어가고, 아니면 비번 단계로 넘긴다.
  async function enterRoom(room) {
    if (!room) return;
    const myId = String(state.user?.userId || '').trim();
    const ownerId = String(room.owner || room.ownerId || '').trim();
    if (room.requiresPassword && myId && ownerId && myId !== ownerId) {
      state._chatRoomJoinStage = { no: room.no };
      setPrompt('비밀번호 >>');
      setHint('비공개 대화방입니다. 비밀번호를 입력해 주십시오. (취소: /M)');
      return;
    }
    await showChatRoom(room.no);
  }

  return async function handleChatCommand({ input, rawCmd, cmd, context }) {
    if (state.screen === 'chat-lobby') {
      // [LOG_ID: 20260718_1600] 비공개방 비밀번호 입력 단계 — 틀리면 서버 403을 잡아 재입력을 유도한다.
      if (state._chatRoomJoinStage) {
        const pw = String(input || '').trim();
        if (cmd === '/M') {
          state._chatRoomJoinStage = null;
          setHint('입장을 취소했습니다.');
          setPrompt('선택 >>');
          return true;
        }
        if (!pw) {
          setHint('비밀번호를 입력해 주십시오. (취소: /M)');
          return true;
        }
        const targetNo = state._chatRoomJoinStage.no;
        state._chatRoomJoinStage = null;
        try {
          await showChatRoom(targetNo, false, pw);
        } catch (error) {
          await showChatLobby();
          setHint('비밀번호가 올바르지 않습니다. 다시 시도해 주십시오.');
        }
        return true;
      }

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
          // [LOG_ID: 20260718_1600] olddos-bbs 원본 개설 흐름 참고(주제→환영→공개/비공개→비번→최대인원):
          // 서버(ChatRoomRepository)는 visibility='private'+password(4자↑)로 비공개방을 이미 지원하는데,
          // 클라이언트 개설 흐름에 이 단계가 없어 UI로는 비공개방을 만들 수 없었다. 단계를 추가한다.
          state._chatRoomCreateStage = 'visibility';
          setPrompt('대화방 종류 (1.공개  2.비공개) [기본: 1] >>');
          return true;
        }

        if (state._chatRoomCreateStage === 'visibility') {
          const choice = textInput.trim() || '1';
          if (choice !== '1' && choice !== '2') {
            setHint('1(공개) 또는 2(비공개)를 입력해 주십시오. (취소: /M)');
            return true;
          }
          if (choice === '2') {
            state._chatRoomDraft.visibility = 'private';
            state._chatRoomCreateStage = 'password';
            setPrompt('대화방 비밀번호(4자 이상) >>');
            return true;
          }
          state._chatRoomDraft.visibility = 'public';
          state._chatRoomCreateStage = 'maxUser';
          setPrompt('최대 인원(1~99) [기본: 10] >>');
          return true;
        }

        if (state._chatRoomCreateStage === 'password') {
          const pw = textInput.trim();
          if (pw.length < 4) {
            setHint('비밀번호는 4자 이상이어야 합니다. (취소: /M)');
            return true;
          }
          state._chatRoomDraft.password = pw;
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
          // [LOG_ID: 20260718_1600] 개설 직후 입장에 쓸 비밀번호를 잡아둔다 — 서버는 비공개방
          // 입장 시 개설자에게도 비밀번호를 요구하므로(join 403), 개설자가 바로 못 들어가고
          // TOP으로 튕기던 문제(브라우저 실측)를 막는다.
          const createdPassword = String(state._chatRoomDraft.password || '');

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
              await showChatRoom(room.no, false, createdPassword);
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

      // [LOG_ID: 20260713_1000] J [방번호] / JOIN [방번호] / /J [방번호] 명령어 배선 추가
      const jMatch = cmd.match(/^(?:\/?J|JOIN)\s+(\d+)$/i);
      if (jMatch) {
        const roomNo = parseInt(jMatch[1], 10);
        const room = state._chatRooms?.find((r) => r.no === roomNo);
        if (room) {
          await enterRoom(room);
        } else {
          setHint(`해당 방번호(#${roomNo})의 방이 존재하지 않습니다.`);
        }
        return true;
      }

      const selectedRoom = parseInt(cmd, 10);
      if (selectedRoom >= 1 && state._chatRooms?.[selectedRoom - 1]) {
        await enterRoom(state._chatRooms[selectedRoom - 1]);
        return true;
      }

      // [LOG_ID: 20260714_2200] 원전 대기실 명령 LT title(제목으로 대화방 찾기) 재현
      const ltMatch = cmd.match(/^LT\s+(.+)$/i);
      if (ltMatch) {
        const keyword = ltMatch[1].trim().toLowerCase();
        const matches = (state._chatRooms || []).filter((r) =>
          String(r.title || r.name || '').toLowerCase().includes(keyword));
        if (matches.length === 1) {
          await enterRoom(matches[0]);
        } else if (matches.length > 1) {
          setHint(`검색 결과: ${matches.map((r) => `#${r.no} ${r.title || r.name}`).join(', ')}`);
        } else {
          setHint(`"${ltMatch[1].trim()}"이(가) 포함된 대화방을 찾을 수 없습니다.`);
        }
        return true;
      }
      return false;
    }

    if (state.screen === 'chat-room') {
      // [LOG: 20260707_1224] 상단바 로고 등 클릭으로 들어온 'T'는 메시지가 아니라 초기화면 이동 의도다.
      // (기존에는 "T"라는 메시지가 대화방에 전송되는 결함이 있었다. /T와 동일하게 처리한다.)
      if (context?.source === 'click' && cmd === 'T') {
        await leaveCurrentRoom();
        await showMain();
        return true;
      }

      // [LOG: 20260411_2345] 대화방 내 명령어는 반드시 '/'로 시작해야 함
      // [LOG_ID: 20260713_1160] 대화방 귓속말(/TO, /EAR, /속, /SAY, /WHISPER 및 슬래시 없는 say, whisper) 구현
      const toMatch = input.match(/^(?:\/)?(TO|EAR|속|SAY|WHISPER)\s+(\S+)\s+(.+)$/i);
      if (toMatch) {
        if (state.user?.isGuest) {
          setHint('귓속말은 로그인 후 사용하실 수 있습니다.');
          setPrompt('선택 >>');
          return true;
        }
        const recipient = toMatch[2].trim();
        const messageContent = toMatch[3].trim();

        apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: `[TO:${recipient}] ${messageContent}`
          })
        })
        .then(() => {
          setHint(`[귓속말] ${recipient}님께 메시지를 보냈습니다.`);
        })
        .catch((err) => {
          setHint(`귓속말 전송 실패: ${err.message}`);
        });
        setPrompt('선택 >>');
        return true;
      }

      if (input.startsWith('/')) {

        const slashCmd = cmd.substring(1); // '/' 제외한 명령

        if (slashCmd === 'Q' || slashCmd === 'QUIT' || slashCmd === 'OUT' || slashCmd === 'EXIT' || slashCmd === 'BYE' || slashCmd === 'X') {
          await leaveCurrentRoom();
          await showChatLobby();
          return true;
        }

        if (slashCmd === 'T' || slashCmd === 'TOP' || slashCmd === 'M') {
          await leaveCurrentRoom();
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

        // [LOG_ID: 20260714_2200] 원전(NOW_MENU.DAT) 대화실 명령어표 잔여분 재현.
        if (slashCmd === 'UID') {
          const ids = (state._chatRoom?.participants || []).map((p) => p.userId).filter(Boolean);
          setHint(ids.length ? `현재 방 참여자 ID: ${ids.join(', ')}` : '참여자 정보를 확인할 수 없습니다.');
          return true;
        }

        if (slashCmd === 'USER') {
          try {
            const users = await apiFetch('/api/system/active-users');
            const ids = (Array.isArray(users) ? users : []).map((u) => u.userId).filter(Boolean);
            setHint(ids.length ? `현재 전체 접속자 ID: ${ids.join(', ')} (총 ${ids.length}명)` : '접속자 정보를 확인할 수 없습니다.');
          } catch (e) {
            setHint('접속자 목록 조회에 실패했습니다.');
          }
          return true;
        }

        const whoMatch = slashCmd.match(/^(FI|WHO|WH|PF)\s+(.+)$/i);
        if (whoMatch) {
          const cmdName = whoMatch[1].toUpperCase();
          const targetId = whoMatch[2].trim();
          if (!targetId) {
            setHint(`사용법: /${cmdName} id`);
            return true;
          }
          try {
            const users = await apiFetch('/api/system/active-users');
            const found = (Array.isArray(users) ? users : []).find((u) => u.userId === targetId);
            setHint(found
              ? `[${targetId}] 위치: ${found.path || '알 수 없음'} (${found.nickName || ''})`
              : `[${targetId}]님의 접속 정보를 찾을 수 없습니다.`);
          } catch (e) {
            setHint('조회에 실패했습니다.');
          }
          return true;
        }

        if (slashCmd.startsWith('LT ')) {
          const query = rawCmd.substring(4).trim().toLowerCase();
          if (!query) {
            setHint('사용법: /LT 단어');
            return true;
          }
          try {
            const rooms = await apiFetch('/api/chat/rooms');
            const matched = (Array.isArray(rooms) ? rooms : []).filter(r => r.title.toLowerCase().includes(query));
            if (matched.length > 0) {
              const listStr = matched.map(r => `#${r.no} ${r.title} (${r.userCount}/${r.maxUser})`).join(', ');
              setHint(`검색된 대화방: ${listStr}`);
            } else {
              setHint('검색된 대화방이 없습니다.');
            }
          } catch (e) {
            setHint('대화방 검색에 실패했습니다.');
          }
          return true;
        }

        if (slashCmd.startsWith('EX ')) {
          const targetId = rawCmd.substring(4).trim();
          if (!targetId) {
            setHint('사용법: /EX id');
            return true;
          }
          if (!state._chatMutedUserIds) state._chatMutedUserIds = new Set();
          if (state._chatMutedUserIds.has(targetId)) {
            state._chatMutedUserIds.delete(targetId);
            setHint(`[${targetId}]님의 메시지 수신거부를 해제했습니다.`);
          } else {
            state._chatMutedUserIds.add(targetId);
            setHint(`[${targetId}]님의 메시지를 수신거부합니다.`);
          }
          const nick = state.user?.nickName || '나';
          const visibleMessages = (state._chatMessages || []).filter((m) => !state._chatMutedUserIds.has(m.userId));
          const ansiResult = buildChatRoomAnsi(state._chatRoom, visibleMessages, nick, state.user?.userId);
          renderAnsiScreenWithTopbar({ ansiText: ansiResult?.text || ansiResult, ansiToHTML, screenEl });
          return true;
        }

        // 방 개설자 전용 - 강퇴 (실제 권한 검증은 서버에서 최종 수행)
        if (slashCmd.startsWith('OUT ')) {
          const targetId = rawCmd.substring(5).trim();
          if (!targetId) {
            setHint('사용법: /OUT id');
            return true;
          }
          if (state._chatRoom?.owner !== state.user?.userId) {
            setHint('방 개설자만 강퇴할 수 있습니다.');
            return true;
          }
          try {
            await apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/kick`, {
              method: 'POST',
              body: JSON.stringify({ targetUserId: targetId })
            });
            setHint(`[${targetId}]님을 강퇴했습니다.`);
          } catch (e) {
            setHint(`강퇴 실패: ${e.message}`);
          }
          return true;
        }

        // 방 개설자 전용 - 제목/정원 변경
        const editMatch = rawCmd.match(/^\/E\s+(TITLE|USER)\s+(.+)$/i);
        if (editMatch) {
          if (state._chatRoom?.owner !== state.user?.userId) {
            setHint('방 개설자만 설정을 변경할 수 있습니다.');
            return true;
          }
          const field = editMatch[1].toUpperCase();
          const value = editMatch[2].trim();
          try {
            const payload = field === 'TITLE' ? { title: value } : { maxUser: parseInt(value, 10) };
            const updated = await apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/settings`, {
              method: 'POST',
              body: JSON.stringify(payload)
            });
            state._chatRoom = { ...state._chatRoom, ...updated };
            setHint(field === 'TITLE' ? `방 제목이 [${value}](으)로 변경되었습니다.` : `참여 제한 인원이 ${value}명으로 변경되었습니다.`);
          } catch (e) {
            setHint(`설정 변경 실패: ${e.message}`);
          }
          return true;
        }

        // 비공개방 초대 - 쪽지로 방번호/비밀번호 안내
        if (slashCmd.startsWith('IN ')) {
          const targetId = rawCmd.substring(4).trim();
          if (!targetId) {
            setHint('사용법: /IN id');
            return true;
          }
          try {
            const room = state._chatRoom || {};
            const roomLabel = room.name || room.title || '대화실';
            // [LOG_ID: 20260714_2200] 방 비밀번호는 공개 API 응답에 포함되지 않는다(보안상 의도적) —
            // 비공개방이면 개설자에게 직접 문의하도록 안내한다.
            const inviteText = room.requiresPassword
              ? `[대화실 초대] "${roomLabel}" 방에 초대합니다. (방번호: ${room.no}, 비밀번호는 개설자에게 문의하세요)`
              : `[대화실 초대] "${roomLabel}" 방에 초대합니다. (방번호: ${room.no})`;
            await apiFetch('/api/memos', {
              method: 'POST',
              body: JSON.stringify({ recipientUserId: targetId, title: '[대화실 초대]', content: inviteText })
            });
            setHint(`[${targetId}]님께 초대 쪽지를 보냈습니다.`);
          } catch (e) {
            setHint(`초대 실패: ${e.message}`);
          }
          return true;
        }

        // 신고 - 건의하기 게시판에 등록
        if (slashCmd === 'JUDGE') {
          try {
            const room = state._chatRoom || {};
            await apiFetch('/api/boards/tosysop/posts', {
              method: 'POST',
              body: JSON.stringify({
                title: `[대화실 신고] ${room.name || room.title || ''} (방번호 ${room.no || '?'})`,
                content: `신고자: ${state.user?.userId}\n방번호: ${room.no}\n신고 시각: ${new Date().toLocaleString()}\n\n(신고 사유를 관리자에게 직접 알려주세요.)`
              })
            });
            setHint('신고가 접수되었습니다. (건의하기 게시판)');
          } catch (e) {
            setHint(`신고 접수 실패: ${e.message}`);
          }
          return true;
        }

        // 지나간 대화 다시보기(재출력) - /Z, /Z 숫자(최근 N개만)
        const zMatch = slashCmd.match(/^Z(?:\s+(\d+))?$/i);
        if (zMatch) {
          const n = zMatch[1] ? parseInt(zMatch[1], 10) : null;
          const all = state._chatMessages || [];
          const visible = n ? all.slice(-n) : all;
          const nick = state.user?.nickName || '나';
          const ansiResult = buildChatRoomAnsi(state._chatRoom, visible, nick, state.user?.userId);
          renderAnsiScreenWithTopbar({ ansiText: ansiResult?.text || ansiResult, ansiToHTML, screenEl });
          return true;
        }

        // /P, /GO - 대화실에서 이동 명령(/T, /M은 위에서 이미 처리)
        if (slashCmd === 'P') {
          await leaveCurrentRoom();
          await showChatLobby();
          return true;
        }
        if (slashCmd === 'GO' || slashCmd.startsWith('GO ')) {
          await leaveCurrentRoom();
          await showMain();
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
        // [LOG_ID: 20260714_2200] /EX(수신거부) 뮤트 목록은 낙관적 갱신 렌더에도 적용한다.
        const muted = state._chatMutedUserIds;
        const visibleMessages = muted && muted.size
          ? (state._chatMessages || []).filter((m) => !muted.has(m.userId))
          : (state._chatMessages || []);
        const ansiResult = buildChatRoomAnsi(state._chatRoom, visibleMessages, nick);
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
