import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { isBuddy } from './chatBuddies.js';

// [LOG_ID: 20260719_2200] "할 수 있다: PC통신에서 인터넷까지" 대조 — 천리안 원전 대화실
// 표현명령어(/V로 목록, 예: 웃다/박수/인사) 재현. 서버 데이터 없이 고정 문구만 조합하는
// 자족적 콘텐츠라 GAME 메뉴의 혈액형/궁합/토정비결과 같은 리스크 없는 패턴이다.
const EMOTE_ACTIONS = {
  '미소': '웃습니다',
  '박수': '박수를 칩니다',
  '인사': '인사를 합니다',
  '윙크': '윙크를 합니다',
  '한숨': '한숨을 쉽니다',
  '눈물': '눈물을 흘립니다',
  '춤': '춤을 춥니다',
  '만세': '만세를 부릅니다'
};

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
    // [LOG_ID: 20260722_3600] 귓속말 토글 상태는 방을 나가면 함께 해제한다(다음 방까지 이어지면 안 됨).
    state._chatWhisperTarget = null;
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
          const trimmedTitle = textInput.trim();
          if (!trimmedTitle) {
            setHint('대화방 제목을 입력하여 주십시오. (취소: /M)');
            return true;
          }
          // [LOG_ID: 20260727_1215] 서버(chatServiceRoutes.js POST /api/chat/rooms)는 제목을
          // 100자로 제한하는데 여기엔 안내가 없었다 — myinfo 닉네임 사전검증(20260721_2200)과
          // 같은 패턴으로, 왕복 없이 바로 안내한다.
          if (trimmedTitle.length > 100) {
            setHint('대화방 제목은 100자 이하여야 합니다. (취소: /M)');
            return true;
          }
          state._chatRoomDraft.title = trimmedTitle;
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
              setHint('대화방 개설에 실패했습니다. 제목부터 다시 시도해 주십시오. (취소: /M)');
              state._chatRoomCreateStage = 'title';
              setPrompt('새 대화방 제목을 입력하여 주십시오. (취소: /M) >>');
              return true;
            }
            await showChatLobby();
            if (room.no) {
              await showChatRoom(room.no, false, createdPassword);
            }
          } catch (error) {
            // [LOG_ID: 20260727_1215] 종전엔 서버가 돌려준 구체적 사유(예: "제목은 100자 이하여야
            // 합니다")를 버리고 뭉뚱그린 안내만 띄운 뒤 restoreStateFromURL()로 대화실 로비로
            // 돌려보냈다 — 그 재렌더가 이 hint를 곧바로 로비 기본 힌트로 덮어써 사용자는 실패
            // 사유를 볼 틈도 없이 그냥 튕겨나갔고, 제목/환영메시지/공개여부 등 여러 단계를 거쳐
            // 입력한 초안도 다시 이어갈 방법 없이 사실상 사라졌다(실측 재현: 100자 넘는 제목 →
            // 5단계 입력 후 로비로 조용히 복귀). 구체적 오류를 그대로 보여주고, 제목 단계로 되돌려
            // 처음부터 다시 입력을 받되 화면 전환(restoreStateFromURL) 없이 같은 화면에서 이어가게 한다.
            setHint(`대화방 개설 실패: ${error.message || '알 수 없는 오류'} (취소: /M)`);
            state._chatRoomCreateStage = 'title';
            setPrompt('새 대화방 제목을 입력하여 주십시오. (취소: /M) >>');
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

      // [LOG_ID: 20260719_1010] 클래식 대화방 생성 명령어 (/create, /c, /open 및 슬래시 없는 버전) 구현
      const createMatch = cmd.match(/^(?:\/)?(CREATE|C|OPEN)(?:\s+(.+))?$/i);
      if (createMatch) {
        const title = createMatch[2] ? createMatch[2].trim() : '';
        await openChatRoomCreate(title);
        return true;
      }

      // [LOG_ID: 20260713_1000] J [방번호] / JOIN [방번호] / /J [방번호] 명령어 배선 추가
      // [LOG_ID: 20260731_1435] state._chatRooms 캐시 미존재 시에도 { no: roomNo } 폴백으로 직접 입장을 시도한다.
      const jMatch = cmd.match(/^(?:\/?J|JOIN)\s+(\d+)$/i);
      if (jMatch) {
        const roomNo = parseInt(jMatch[1], 10);
        const room = state._chatRooms?.find((r) => r.no === roomNo);
        await enterRoom(room || { no: roomNo });
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
      // [LOG_ID: 20260721_1830] 이 우회를 T 하나에만 두고 있었는데, 정작 대화방 풋터
      // (commandFooterText.js의 'chat' 카테고리: P, T, GO, O:방만들기, ST:상황판, H)가 클릭하라고
      // 보여주는 다른 토큰들은 전부 슬래시 없는 채로 들어와 아래 "/"로 시작해야만 인식하는
      // 명령 블록에 안 걸리고, 그대로 채팅 메시지("P", "O", "ST" 등)로 전송되고 있었다
      // (appEvents.js의 executeCommandFromClick이 클릭 컨텍스트를 안 넘기던 버그와 겹쳐 있었음 —
      // 그 버그는 별도로 고쳤지만, 그것만으로는 여기서 슬래시 요구 때문에 여전히 안 풀렸다).
      // 클릭으로 들어온 나머지 이동/조회 명령도 같은 방식으로 슬래시 없이 처리한다. GO는
      // "/GO 인자"에서 인자를 그냥 버리는 기존 동작(위 슬래시 블록)과 동일하게 맞춘다.
      // EAR(귓속말)처럼 인자(대상+메시지)가 반드시 필요한 명령은 클릭 한 번으로 완성할 수
      // 없어 풋터에서 아예 뺐다(아래 commandFooterText.js 수정) — 타이핑으로는 그대로 동작한다.
      if (context?.source === 'click') {
        if (cmd === 'T' || cmd === 'M') {
          await leaveCurrentRoom();
          await showMain();
          return true;
        }
        if (cmd === 'P') {
          await leaveCurrentRoom();
          await showChatLobby();
          return true;
        }
        if (cmd === 'GO') {
          await leaveCurrentRoom();
          await showMain();
          return true;
        }
        if (cmd === 'O') {
          await leaveCurrentRoom();
          await openChatRoomCreate();
          return true;
        }
        if (cmd === 'ST') {
          // [LOG_ID: 20260721_2350] "실제로 확인해줘" 요청으로 라이브 테스트하다 발견: 존재하지 않는
          // /api/chat/active-users를 호출하고 있어(서버에 그 경로가 없음, SPA 폴백 HTML이 200으로
          // 돌아와 apiFetch가 JSON 파싱에 실패) ST는 항상 "접속자 정보를 가져오지 못했습니다"만
          // 떴다 — 즉 실서비스에서 완전히 죽어 있었다. /W·/WHO(대화방 참여자 조회)가 이미 같은
          // 정보를 클라이언트에 캐시된 state._chatRoom.participants로 정확히 보여주고 있어(별도
          // API 호출 불필요), 그 방식을 그대로 재사용한다.
          const list = (state._chatRoom?.participants || []).map((p) => p.nickName || p.userId).filter(Boolean);
          setHint(list.length ? `현재 접속자: ${list.join(', ')}` : '참여자 정보를 확인할 수 없습니다.');
          return true;
        }
      }

      // [LOG: 20260411_2345] 대화방 내 명령어는 반드시 '/'로 시작해야 함
      // [LOG_ID: 20260722_3600] 하이텔 책(길라잡이 p.101) 실측: "/TO userid"(메시지 없이 아이디만)는
      // 해제할 때까지 내가 하는 모든 말이 그 사람에게만 보이는 "귓속말 설정/해제" 토글이고,
      // "/TO userid msg"(메시지 포함)는 그 한마디만 보내는 별개의 명령이다. 기존 구현은 메시지가
      // 항상 필수였던 "귓속말 한마디"만 있었고, 토글형 귓속말 설정 자체가 없었다.
      const toToggleMatch = input.match(/^(?:\/)?(TO|EAR|속|SAY|WHISPER)\s+(\S+)\s*$/i);
      if (toToggleMatch) {
        if (state.user?.isGuest) {
          setHint('귓속말은 로그인 후 사용하실 수 있습니다.');
          setPrompt('선택 >>');
          return true;
        }
        const targetId = toToggleMatch[2].trim();
        if (state._chatWhisperTarget && state._chatWhisperTarget.toLowerCase() === targetId.toLowerCase()) {
          state._chatWhisperTarget = null;
          setHint('귓속말을 해제했습니다. 이제부터 하는 말은 모두에게 보입니다.');
        } else {
          state._chatWhisperTarget = targetId;
          setHint(`[${targetId}]님과 귓속말을 시작합니다. 해제하려면 다시 "/TO ${targetId}"를 입력하세요.`);
        }
        setPrompt('선택 >>');
        return true;
      }

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
          // [LOG_ID: 20260721_2350] 위 클릭 컨텍스트 ST와 동일한 사유로 수정 — 존재하지 않는
          // /api/chat/active-users 대신 /W·/WHO와 동일하게 state._chatRoom.participants를 쓴다.
          const list = (state._chatRoom?.participants || []).map((p) => p.nickName || p.userId).filter(Boolean);
          setHint(list.length ? `현재 접속자: ${list.join(', ')}` : '참여자 정보를 확인할 수 없습니다.');
          return true;
        }

        if (slashCmd.startsWith('AL ')) {
          const newNick = rawCmd.substring(4).trim();
          if (newNick) {
            state.user.nickName = newNick;
            // [LOG: 20260716_1910] 대화방 대화명(/AL) 변경 시 힌트바 노출 제외 요구사항 반영
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
            // [LOG_ID: 20260719_2200] BUDDY로 등록한 아이디는 ★ 표시로 강조한다.
            const ids = (Array.isArray(users) ? users : [])
              .map((u) => u.userId)
              .filter(Boolean)
              .map((id) => (isBuddy(id) ? `★${id}` : id));
            setHint(ids.length ? `현재 전체 접속자 ID: ${ids.join(', ')} (총 ${ids.length}명)` : '접속자 정보를 확인할 수 없습니다.');
          } catch (e) {
            setHint('접속자 목록 조회에 실패했습니다.');
          }
          return true;
        }

        // [LOG_ID: 20260719_1010] 대화방 내 참여자 목록 조회 (/W, /WHO) 구현
        if (slashCmd === 'W' || slashCmd === 'WHO') {
          const list = (state._chatRoom?.participants || []).map((p) => `${p.nickName || p.userId}(${p.userId})`).filter(Boolean);
          setHint(list.length ? `대화방 참여자: ${list.join(', ')}` : '참여자 정보를 확인할 수 없습니다.');
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
            // [LOG: 20260802_1800] /WHO·/FI·/WH·/PF id 검색 시 사용자가 대소문자 혼용 입력을 해도
            // 찾을 수 있도록 targetId를 소문자로 정규화한 뒤 비교한다.
            // 서버는 active-users에 항상 소문자 userId를 반환(ActivityRepository.touch → toLowerCase)하므로
            // 클라이언트 비교값도 소문자로 맞춰야 일치한다.
            // 형제 명령 /EX id(라인 ~469)는 이미 targetKey = targetId.toLowerCase()로 처리하고 있으나,
            // /WHO 계열만 정규화가 빠져 '/WHO Alice'처럼 입력하면 'alice'를 찾지 못하는 버그가 있었다.
            const normalizedTargetId = targetId.toLowerCase();
            const found = (Array.isArray(users) ? users : []).find((u) => u.userId === normalizedTargetId);
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
          // [LOG_ID: 20260728_1420] rawCmd.substring 대신 정규화된 slashCmd를 사용해 한글 별칭(/차단) 오프셋 자름 방지
          const targetId = slashCmd.substring(3).trim();
          if (!targetId) {
            setHint('사용법: /EX id');
            return true;
          }
          if (!state._chatMutedUserIds) state._chatMutedUserIds = new Set();
          // [LOG_ID: 20260801_0950] /EX 수신거부 목록의 대소문자 구분 없는 비교를 위해 targetId를 소문자로 변환하여 저장
          const targetKey = targetId.toLowerCase();
          if (state._chatMutedUserIds.has(targetKey)) {
            state._chatMutedUserIds.delete(targetKey);
            setHint(`[${targetId}]님의 메시지 수신거부를 해제했습니다.`);
          } else {
            state._chatMutedUserIds.add(targetKey);
            setHint(`[${targetId}]님의 메시지를 수신거부합니다.`);
          }
          const nick = state.user?.nickName || '나';
          // [LOG_ID: 20260801_0950] 수신거부 대조 시에도 userId와 nickName을 모두 소문자로 변환하여 비교한다.
          const visibleMessages = (state._chatMessages || []).filter((m) => {
            const mUser = String(m.userId || '').toLowerCase();
            const mNick = String(m.nickName || '').toLowerCase();
            return !state._chatMutedUserIds.has(mUser) && !state._chatMutedUserIds.has(mNick);
          });
          const ansiResult = buildChatRoomAnsi(state._chatRoom, visibleMessages, nick, state.user?.userId);
          renderAnsiScreenWithTopbar({ ansiText: ansiResult?.text || ansiResult, ansiToHTML, screenEl });
          return true;
        }

        // 방 개설자 전용 - 강퇴 (실제 권한 검증은 서버에서 최종 수행)
        if (slashCmd.startsWith('OUT ')) {
          // [LOG_ID: 20260728_1420] rawCmd.substring 대신 정규화된 slashCmd를 사용해 한글 별칭(/내보내기) 오프셋 자름 방지
          const targetId = slashCmd.substring(4).trim();
          if (!targetId) {
            setHint('사용법: /OUT id');
            return true;
          }
          const currentOwner = String(state._chatRoom?.owner || state._chatRoom?.ownerId || '').trim();
          const currentUserId = String(state.user?.userId || '').trim();
          if (!currentOwner || currentOwner !== currentUserId) {
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
        const editMatch = cmd.match(/^\/E\s+(TITLE|USER)\s+(.+)$/i);
        if (editMatch) {
          const currentOwner = String(state._chatRoom?.owner || state._chatRoom?.ownerId || '').trim();
          const currentUserId = String(state.user?.userId || '').trim();
          if (!currentOwner || currentOwner !== currentUserId) {
            setHint('방 개설자만 설정을 변경할 수 있습니다.');
            return true;
          }
          const field = editMatch[1].toUpperCase();
          const value = editMatch[2].trim();
          // [LOG_ID: 20260727_1256] 개설(/M 흐름) 제목 입력엔 100자 사전검증(20260727_1215)이
          // 있는데 설정변경(/E TITLE)엔 없어 왕복 없이 바로 알려줄 기회가 없었다. 동일하게 맞춘다.
          if (field === 'TITLE' && value.length > 100) {
            setHint('대화방 제목은 100자 이하여야 합니다.');
            return true;
          }
          try {
            const payload = field === 'TITLE' ? { title: value } : { maxUser: parseInt(value, 10) };
            const updated = await apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/settings`, {
              method: 'POST',
              body: JSON.stringify(payload)
            });
            state._chatRoom = { ...state._chatRoom, ...updated };
            // [LOG_ID: 20260727_1256] 입력값(value)을 그대로 에코하면, 서버가 실제로 저장한 값과
            // 다를 수 있을 때(과거 60자 조용한 절삭 등) 사용자에게 거짓 확인을 보여주게 된다 —
            // 실제 저장된 값(updated.title)을 보여줘 화면과 데이터가 항상 일치하게 한다.
            setHint(field === 'TITLE' ? `방 제목이 [${updated?.title ?? value}](으)로 변경되었습니다.` : `참여 제한 인원이 ${value}명으로 변경되었습니다.`);
          } catch (e) {
            setHint(`설정 변경 실패: ${e.message}`);
          }
          return true;
        }

        // 비공개방 초대 - 쪽지로 방번호/비밀번호 안내
        if (slashCmd.startsWith('IN ')) {
          // [LOG_ID: 20260728_1420] rawCmd.substring 대신 정규화된 slashCmd를 사용해 한글 별칭(/초대) 오프셋 자름 방지
          const targetId = slashCmd.substring(3).trim();
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

        // [LOG_ID: 20260719_2200] 표현명령어(이모트) 목록 안내
        if (slashCmd === 'V' || slashCmd === 'EMOTE') {
          const list = Object.keys(EMOTE_ACTIONS).map((keyword) => `/${keyword}`).join(', ');
          setHint(`사용 가능한 표현명령어: ${list}`);
          return true;
        }

        // [LOG_ID: 20260719_2200] 표현명령어(이모트) 실행 — 일반 메시지 전송과 동일한 API를
        // 재사용하되, 내용만 "OOO님이 웃습니다" 형태의 3인칭 문구로 대체한다.
        if (EMOTE_ACTIONS[slashCmd]) {
          const nick = state.user?.nickName || '나';
          const emoteText = `☆ ${nick}님이 ${EMOTE_ACTIONS[slashCmd]} ☆`;
          apiFetch(`/api/chat/rooms/${encodeURIComponent(state._chatRoomId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: emoteText, sessionKey: state._chatSessionKey })
          })
          .then(() => {
            state._chatMessages = state._chatMessages || [];
            state._chatMessages.push({
              userId: state.user?.userId || 'me',
              nickName: nick,
              content: emoteText,
              createdAt: new Date().toISOString()
            });
            // [LOG_ID: 20260801_0950] 표현명령어 전송 후 렌더링 시에도 대소문자 구분 없는 userId/nickName 모두 수신거부 대조 적용
            const muted = state._chatMutedUserIds;
            const visibleMessages = muted && muted.size
              ? (state._chatMessages || []).filter((m) => {
                  const mUser = String(m.userId || '').toLowerCase();
                  const mNick = String(m.nickName || '').toLowerCase();
                  return !muted.has(mUser) && !muted.has(mNick);
                })
              : (state._chatMessages || []);
            const ansiResult = buildChatRoomAnsi(state._chatRoom, visibleMessages, nick, state.user?.userId);
            renderAnsiScreenWithTopbar({ ansiText: ansiResult?.text || ansiResult, ansiToHTML, screenEl });
          })
          .catch((err) => {
            setHint(`전송 실패: ${err.message}`);
          });
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
        // [LOG_ID: 20260719_2200] SET TAG로 등록한 덧말(태그라인)을 매 메시지 끝에 자동 첨부한다
        // (새롬 데이타맨 프로 "덧말" 개념 — 원본은 로컬 클라이언트 UI 기능이라 그대로 이식할 대상이
        // 없지만, 결과물인 "메시지마다 짧은 문구가 자동으로 붙는다"는 기존 SET envVar로 재현 가능).
        const typedText = String(input || '').trim();
        const tag = String(state.envVars?.TAG || '').trim();
        const taggedText = tag ? `${typedText} (${tag})` : typedText;
        // [LOG_ID: 20260722_3600] /TO 토글로 귓속말 모드 중이면 평범한 입력도 전부
        // "[TO:대상]" 형식으로 자동 전송한다(해제 전까지 계속 적용, 원전 스펙).
        const whisperTarget = state._chatWhisperTarget;
        const messageText = whisperTarget ? `[TO:${whisperTarget}] ${taggedText}` : taggedText;

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
        // [LOG_ID: 20260801_0950] 일반 메시지 전송 후 낙관적 갱신 시에도 대소문자 구분 없는 userId/nickName 모두 수신거부 대조 적용
        const muted = state._chatMutedUserIds;
        const visibleMessages = muted && muted.size
          ? (state._chatMessages || []).filter((m) => {
              const mUser = String(m.userId || '').toLowerCase();
              const mNick = String(m.nickName || '').toLowerCase();
              return !muted.has(mUser) && !muted.has(mNick);
            })
          : (state._chatMessages || []);
        // [LOG_ID: 20260722_3600] myId를 넘겨야 "[TO:...]" 귓속말 필터가 내가 보낸 메시지를
        // 정확히 통과시킨다 — 누락 시 귓속말 모드에서 보낸 메시지가 낙관적 갱신에서 사라진다.
        const ansiResult = buildChatRoomAnsi(state._chatRoom, visibleMessages, nick, state.user?.userId);
        // [LOG: 20260707_1424] 낙관적 갱신도 표준 상단바 렌더러를 사용한다.
        // 기존의 screenEl.innerHTML 직접 조립은 상단바 없이 그려져 메시지 전송 직후 로고/시계가 사라졌다.
        renderAnsiScreenWithTopbar({ ansiText: ansiResult?.text || ansiResult, ansiToHTML, screenEl });
        if (whisperTarget) {
          setHint(`(귓속말 중: [${whisperTarget}]님에게만 보입니다. 해제: /TO ${whisperTarget})`);
        }
        if (shouldAutoFocusCommandInput()) {
          cmdInput.focus();
        }
        return true;
      }
    }

    return false;
  };
}
