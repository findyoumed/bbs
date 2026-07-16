import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

/**
 * [LOG_ID: 20260719_1600] 토론의 광장(CONF) 스크린 — 회의실 목록 / 안건 목록 / 안건 보기 +
 * 회의실 개설·안건 발의 입력 플로우. 하이텔 (12)여론광장-1.토론의 광장 재현.
 */
export function createConfScreens(deps) {
  const {
    apiFetch,
    ansiToHTML,
    applyCommandFooter,
    buildConfRoomListAnsi,
    buildConfAgendaListAnsi,
    buildConfAgendaViewAnsi,
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

  function shouldAutoFocusCommandInput() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function pushHistory() {
    state.history.push({
      screen: state.screen,
      board: state.board,
      boardMenuPath: state.boardMenuPath,
      boardMenuTitle: state.boardMenuTitle,
      serviceData: JSON.parse(JSON.stringify(state.serviceData || {})),
      page: state.page
    });
  }

  async function render(ansiText, footerCategory, prompt) {
    await renderAnsiScreenWithTopbarSequential({
      ansiText, ansiToHTML, screenEl, renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(getMenuNodeByKey('conf')?.footer, getCommandFooterText(footerCategory));
        if (prompt && typeof setPrompt === 'function') setPrompt(prompt);
      }
    });
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  // 1. 회의실 목록
  async function showConfRooms(fromHistory = false) {
    state.screen = 'conf-rooms';
    state.serviceData = { kind: 'conf' };
    if (!fromHistory) { updateURL(); pushHistory(); }
    try {
      const rooms = await apiFetch('/api/conf/rooms?closed=1');
      await render(buildConfRoomListAnsi(rooms || []), 'confRooms', '회의실 번호 입력 >> ');
    } catch (e) {
      setHint('회의실 목록을 가져오지 못했습니다: ' + e.message);
    }
  }

  async function fetchRoomMeta(roomNo) {
    try {
      const rooms = await apiFetch('/api/conf/rooms?closed=1');
      return (rooms || []).find((r) => Number(r.no) === Number(roomNo)) || { no: roomNo, title: `회의실 ${roomNo}` };
    } catch (_) {
      return { no: roomNo, title: `회의실 ${roomNo}` };
    }
  }

  // 2. 안건 목록
  async function showConfAgendas(roomNo, fromHistory = false) {
    const no = Number(roomNo);
    state.screen = 'conf-agendas';
    state.serviceData = { kind: 'conf', roomNo: no };
    if (!fromHistory) { updateURL(); pushHistory(); }
    try {
      const [room, agendas] = await Promise.all([fetchRoomMeta(no), apiFetch(`/api/conf/rooms/${no}/agendas`)]);
      state.serviceData.roomTitle = room.title;
      state.serviceData.roomOpen = room.isOpen !== false;
      // 목록에 표시된 안건 순번(no) → 실제 id 매핑 (라우터가 번호 입력을 id로 변환)
      const map = {};
      (agendas || []).forEach((a) => { map[a.no] = a.id; });
      state.serviceData.agendaIdByNo = map;
      await render(buildConfAgendaListAnsi(room, agendas || []), 'confAgendas', '안건 번호 입력 >> ');
    } catch (e) {
      setHint('안건 목록을 가져오지 못했습니다: ' + e.message);
      await showConfRooms(true);
    }
  }

  // 3. 안건 보기
  async function showConfAgenda(agendaId, fromHistory = false) {
    const id = Number(agendaId);
    const roomNo = state.serviceData?.roomNo;
    state.screen = 'conf-agenda';
    state.serviceData = { kind: 'conf', roomNo, agendaId: id };
    if (!fromHistory) { updateURL(); pushHistory(); }
    try {
      const agenda = await apiFetch(`/api/conf/agendas/${id}`);
      state.serviceData.roomNo = agenda.roomNo;
      await render(buildConfAgendaViewAnsi(agenda), 'confAgenda', 'R:재청  P:목록 >> ');
    } catch (e) {
      setHint('안건을 가져오지 못했습니다: ' + e.message);
      if (roomNo) await showConfAgendas(roomNo, true);
      else await showConfRooms(true);
    }
  }

  // 4. 회의실 개설 플로우 (제목 1줄)
  async function showConfRoomCreate(fromHistory = false) {
    state.screen = 'conf-room-create';
    state.serviceData = { kind: 'conf', action: 'room-create' };
    if (!fromHistory) { updateURL(); pushHistory(); }
    await render(buildConfRoomListAnsi([]), 'confRoomCreate', '회의실 제목 입력 >> ');
    setHint('개설할 회의실(토론 주제)의 제목을 입력하세요. (취소: P)');
  }

  async function submitConfRoom(title) {
    try {
      const room = await apiFetch('/api/conf/rooms', { method: 'POST', body: JSON.stringify({ title }) });
      setHint(`회의실 #${room.no} 이(가) 개설되었습니다.`);
      await showConfAgendas(room.no, true);
    } catch (e) {
      setHint('회의실 개설 실패: ' + e.message);
    }
  }

  // 5. 안건 발의 플로우 (제목 → 본문 여러 줄, /s 등록)
  async function showConfAgendaNew(roomNo, fromHistory = false) {
    const no = Number(roomNo);
    state.screen = 'conf-agenda-new';
    state.serviceData = { kind: 'conf', action: 'agenda-new', roomNo: no };
    state.confAgendaStep = 0;
    state.confAgendaData = { title: '', contentLines: [] };
    if (!fromHistory) { updateURL(); pushHistory(); }
    const room = await fetchRoomMeta(no);
    await render(buildConfAgendaListAnsi(room, []), 'confAgendaNew', '안건 제목 입력 >> ');
    setHint('발의할 안건의 제목을 입력하세요. (취소: P)');
  }

  async function submitConfAgenda(roomNo, title, content) {
    try {
      const agenda = await apiFetch(`/api/conf/rooms/${roomNo}/agendas`, {
        method: 'POST',
        body: JSON.stringify({ title, content })
      });
      setHint(`안건 #${agenda.no} 이(가) 발의되었습니다.`);
      await showConfAgenda(agenda.id, true);
    } catch (e) {
      setHint('안건 발의 실패: ' + e.message);
    }
  }

  // 6. 재청
  async function secondConfAgenda(agendaId) {
    try {
      const agenda = await apiFetch(`/api/conf/agendas/${agendaId}/second`, { method: 'POST', body: '{}' });
      setHint(`재청하였습니다. 현재 재청 ${agenda.secondCount}명.`);
      await showConfAgenda(agendaId, true);
    } catch (e) {
      setHint('재청 실패: ' + e.message);
    }
  }

  // 7. 회의실 닫기 (개설자/관리자)
  async function closeConfRoom(roomNo) {
    try {
      await apiFetch(`/api/conf/rooms/${roomNo}/close`, { method: 'POST', body: '{}' });
      setHint(`회의실 #${roomNo} 을(를) 닫았습니다.`);
      await showConfAgendas(roomNo, true);
    } catch (e) {
      setHint('회의실 닫기 실패: ' + e.message);
    }
  }

  return {
    showConfRooms,
    showConfAgendas,
    showConfAgenda,
    showConfRoomCreate,
    submitConfRoom,
    showConfAgendaNew,
    submitConfAgenda,
    secondConfAgenda,
    closeConfRoom
  };
}
