// [LOG_ID: 20260719_1600] commandRouterConf — 토론의 광장(CONF) 입력 처리 라우터.
export function createConfCommandHandler(deps) {
  const {
    showMain,
    showBoardSelect,
    showConfRooms,
    showConfAgendas,
    showConfAgenda,
    showConfAgendaPage,
    showConfRoomCreate,
    submitConfRoom,
    showConfAgendaNew,
    submitConfAgenda,
    secondConfAgenda,
    closeConfRoom,
    setHint,
    setPrompt,
    state
  } = deps;

  return async function handleConfCommand({ s, cmd, rawCmd, context }) {
    const isGuest = !context || context.isGuest;

    // 회의실 목록
    if (s === 'conf-rooms') {
      if (cmd === 'T') { await showMain(); return true; }
      // [LOG_ID: 20260722_2100] 사용자 리포트("다른 메뉴에서도 이렇게 P를 눌렀는데 최상단으로
      // 이동하는 것 있어?")로 발견 — 메뉴 구조상 토론의 광장(forum/conf-rooms)은 여론광장
      // (agora) 밑의 자식 항목인데(하이텔 원전 "(12)여론광장-1.토론의 광장"), P/M이 그 실제
      // 상위(여론광장 메뉴)를 건너뛰고 곧장 초기화면으로 가버렸다 — /policy와 같은 패턴.
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('agora'); return true; }
      if (cmd === 'O') {
        if (isGuest) { setHint('회의실 개설은 로그인 후에 가능합니다.'); return true; }
        await showConfRoomCreate();
        return true;
      }
      const roomNo = Number(rawCmd);
      if (!isNaN(roomNo) && roomNo > 0) { await showConfAgendas(roomNo); return true; }
      return false;
    }

    // 안건 목록
    if (s === 'conf-agendas') {
      if (cmd === 'T') { await showMain(); return true; }
      if (cmd === 'B' || cmd === 'P' || cmd === 'M') { await showConfRooms(); return true; }
      const roomNo = state.serviceData?.roomNo;
      if (cmd === 'N') {
        if (isGuest) { setHint('안건 발의는 로그인 후에 가능합니다.'); return true; }
        if (state.serviceData?.roomOpen === false) { setHint('닫힌 회의실에는 안건을 발의할 수 없습니다.'); return true; }
        await showConfAgendaNew(roomNo);
        return true;
      }
      if (cmd === 'C') {
        if (isGuest) { setHint('회의실 닫기는 개설자만 가능합니다.'); return true; }
        await closeConfRoom(roomNo);
        return true;
      }
      const agendaId = Number(rawCmd);
      // 목록에서는 안건 "번호"(room 내 순번)가 아니라 실제 id가 필요하므로, 안건 클릭/번호 입력은
      // 목록 렌더 시 매핑된 id를 통해서만 진입한다. 여기서는 순번→id 매핑을 위해 serviceData 사용.
      if (!isNaN(agendaId) && agendaId > 0) {
        const id = resolveAgendaId(state, agendaId);
        if (id) { await showConfAgenda(id); return true; }
        setHint('해당 번호의 안건이 없습니다.');
        return true;
      }
      return false;
    }

    // 안건 보기
    if (s === 'conf-agenda') {
      if (cmd === 'T') { await showMain(); return true; }
      // [LOG_ID: 20260726_2300] 본문이 길어 페이징이 생기면서(buildConfAgendaViewAnsi) 게시글
      // 보기와 동일하게 F/엔터(다음쪽)·B(이전쪽, 단 첫 쪽에서는 기존처럼 목록으로)를 처리한다.
      const pageNo = Number(state.confAgendaPageNo || 1);
      const pageCount = Number(state.confAgendaPageCount || 1);
      if ((cmd === 'F' || cmd === '') && pageNo < pageCount) {
        await showConfAgendaPage(pageNo + 1);
        return true;
      }
      if (cmd === 'B' && pageNo > 1) {
        await showConfAgendaPage(pageNo - 1);
        return true;
      }
      if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
        const roomNo = state.serviceData?.roomNo;
        if (roomNo) await showConfAgendas(roomNo, false);
        else await showConfRooms();
        return true;
      }
      if (cmd === 'R') {
        if (isGuest) { setHint('재청은 로그인 후에 가능합니다.'); return true; }
        await secondConfAgenda(state.serviceData?.agendaId);
        return true;
      }
      return false;
    }

    // 회의실 개설 입력 (제목 1줄)
    if (s === 'conf-room-create') {
      if (cmd === 'P' || cmd === 'M' || cmd === 'B') { await showConfRooms(); return true; }
      const title = String(rawCmd || '').trim();
      if (!title) { setHint('회의실 제목을 입력해 주세요.'); return true; }
      await submitConfRoom(title);
      return true;
    }

    // 안건 발의 입력 (제목 → 본문 여러 줄, /s 등록)
    if (s === 'conf-agenda-new') {
      const raw = String(rawCmd || '');
      const trimmed = raw.trim();
      if (state.confAgendaStep === 0) {
        if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
          await showConfAgendas(state.serviceData?.roomNo);
          return true;
        }
        if (!trimmed) { setHint('안건 제목을 입력해 주세요.'); return true; }
        state.confAgendaData.title = trimmed;
        state.confAgendaStep = 1;
        setPrompt('안건 내용 입력 (/s 등록, /c 취소) >> ');
        setHint('안건 본문을 여러 줄로 입력하고 /s 로 발의하세요.');
        return true;
      }
      if (state.confAgendaStep === 1) {
        // [LOG_ID: 20260721_1830] 이 화면의 풋터(commandFooterText.js confAgendaNew)는 항상
        // "P:취소"를 보여주는데, 정작 여기(본문 입력 단계)는 /c 만 취소로 인식해 P를 치면
        // 본문 줄로 그대로 들어가 버렸다(사용자 지적: "다른 화면도 명령어 감사해줘" 조사로
        // 발견). 다른 화면들의 글쓰기 취소 관례(P/M/B/T)와 맞춰, 여기서도 동일하게 취소로
        // 받아들인다 — 기존 /c도 그대로 유지(하위 호환).
        if (trimmed === '/c' || cmd === 'P' || cmd === 'M' || cmd === 'B' || cmd === 'T') {
          await showConfAgendas(state.serviceData?.roomNo);
          return true;
        }
        if (trimmed === '/s') {
          const content = state.confAgendaData.contentLines.join('\n').trim();
          if (!content) { setHint('안건 내용을 한 줄 이상 입력해 주세요.'); return true; }
          await submitConfAgenda(state.serviceData?.roomNo, state.confAgendaData.title, content);
          return true;
        }
        state.confAgendaData.contentLines.push(raw);
        setHint(`${state.confAgendaData.contentLines.length}줄 입력됨. 계속 입력하거나 /s 로 발의.`);
        return true;
      }
      return false;
    }

    return false;
  };

  // 목록 화면에서 순번(1-based)으로 표시된 안건을 실제 id로 변환.
  // 목록 렌더는 안건을 순서대로 표시하므로, serviceData.agendaIndex 매핑을 사용한다.
  function resolveAgendaId(st, ordinal) {
    const map = st.serviceData?.agendaIdByNo;
    if (map && map[ordinal]) return map[ordinal];
    return null;
  }
}
