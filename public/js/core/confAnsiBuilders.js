/**
 * [LOG_ID: 20260719_1600] 토론의 광장(CONF) ANSI 빌더 — 회의실 목록/안건 목록/안건 보기.
 * 하이텔 (12)여론광장-1.토론의 광장 재현.
 */
export function createConfAnsiBuilders(deps) {
  const { ANSI_RESET, ansiColor, ansiHLine, buildTopHeader, fitCell, formatLongDate, wrapAnsiText, displayWidth } =
    deps.ansiBuilderUtils;

  function frame(centerLabel, targetCols) {
    // [LOG_ID: 20260718_2300] go 코드를 "conf"에서 "forum"으로 정정(사용자 지적).
    return buildTopHeader({ leftLabel: 'FORUM', centerLabel }, '', targetCols);
  }

  // 1. 회의실 목록: 번호 / 개설자 / 안건 / 상태 / 제목
  function buildConfRoomListAnsi(rooms) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const COL = isMobile
      ? { no: 4, owner: 0, agenda: 0, state: 6 }
      : { no: 4, owner: 12, agenda: 5, state: 6 };
    const fixed = COL.no + 1 + (COL.owner ? COL.owner + 1 : 0) + (COL.agenda ? COL.agenda + 1 : 0) + COL.state + 1;
    const titleWidth = targetCols - fixed;

    let header = fitCell('번호', COL.no, 'right') + ' ';
    if (COL.owner) header += fitCell('개설자', COL.owner) + ' ';
    if (COL.agenda) header += fitCell('안건', COL.agenda, 'right') + ' ';
    header += fitCell('상태', COL.state) + ' ' + fitCell('회의실 제목', titleWidth);

    const parts = [frame('토론의 광장 (FORUM)', targetCols), '', ansiColor(14) + header + ANSI_RESET, ansiHLine(targetCols, 8)];
    if (!rooms || !rooms.length) {
      // [LOG_ID: 20260718_2310] 모바일(44칸)에서 안내 문구가 폭을 넘어 잘려 보이던 것을
      // wrapAnsiText로 줄바꿈(사용자 지적: "글이 가로폭을 벗어나고 있어").
      wrapAnsiText('   열린 회의실이 없습니다. O를 눌러 회의실을 여세요.', targetCols)
        .forEach((w) => parts.push(ansiColor(8) + w + ANSI_RESET));
    } else {
      rooms.slice(0, 12).forEach((room) => {
        let line = ansiColor(15) + fitCell(String(room.no), COL.no, 'right') + ' ';
        if (COL.owner) line += ansiColor(11) + fitCell(room.ownerName || room.owner || '손님', COL.owner) + ' ';
        if (COL.agenda) line += ansiColor(8) + fitCell(String(room.agendaCount || 0), COL.agenda, 'right') + ' ';
        line += ansiColor(room.isOpen ? 10 : 8) + fitCell(room.isOpen ? '열림' : '닫힘', COL.state) + ' ';
        line += ansiColor(15) + fitCell(room.title || '회의실', titleWidth) + ANSI_RESET;
        parts.push(line);
      });
    }
    return parts.join('\n');
  }

  // 2. 안건 목록: 번호 / 발의자 / 재청 / 제목
  function buildConfAgendaListAnsi(room, agendas) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const COL = isMobile ? { no: 4, author: 0, second: 5 } : { no: 4, author: 12, second: 5 };
    const fixed = COL.no + 1 + (COL.author ? COL.author + 1 : 0) + COL.second + 1;
    const titleWidth = targetCols - fixed;

    let header = fitCell('번호', COL.no, 'right') + ' ';
    if (COL.author) header += fitCell('발의자', COL.author) + ' ';
    header += fitCell('재청', COL.second, 'right') + ' ' + fitCell('안건 제목', titleWidth);

    const roomTitle = String(room?.title || '회의실');
    const parts = [
      frame(`회의실: ${roomTitle}${room && room.isOpen === false ? ' [닫힘]' : ''}`, targetCols),
      '', ansiColor(14) + header + ANSI_RESET, ansiHLine(targetCols, 8)
    ];
    if (!agendas || !agendas.length) {
      // [LOG_ID: 20260718_2310] 회의실 목록과 동일한 오버플로우 문제 — 안건 목록 빈 상태 문구도 wrap.
      wrapAnsiText('   발의된 안건이 없습니다. N을 눌러 안건을 발의하세요.', targetCols)
        .forEach((w) => parts.push(ansiColor(8) + w + ANSI_RESET));
    } else {
      agendas.slice(0, 12).forEach((a) => {
        let line = ansiColor(15) + fitCell(String(a.no), COL.no, 'right') + ' ';
        if (COL.author) line += ansiColor(11) + fitCell(a.authorName || a.author || '손님', COL.author) + ' ';
        line += ansiColor(9) + fitCell(String(a.secondCount || 0), COL.second, 'right') + ' ';
        line += ansiColor(15) + fitCell(a.title || '안건', titleWidth) + ANSI_RESET;
        parts.push(line);
      });
    }
    return parts.join('\n');
  }

  // 3. 안건 보기: 제목/발의자/재청수/본문
  function buildConfAgendaViewAnsi(agenda) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const labelWidth = isMobile ? 6 : 8;
    const valueWidth = targetCols - labelWidth - 3;
    const row = (label, value) => ansiColor(14) + fitCell(label, labelWidth) + ' : ' + ansiColor(15) + fitCell(String(value), valueWidth) + ANSI_RESET;

    const parts = [frame('안건 보기', targetCols)];
    parts.push(row('안건', `${agenda.no}. ${agenda.title || ''}`));
    parts.push(row('발의자', agenda.authorName || agenda.author || '손님'));
    parts.push(row('재청', `${agenda.secondCount || 0}명${agenda.seconded ? ' (나 재청함)' : ''}`));
    parts.push(row('발의일', formatLongDate(agenda.createdAt) || agenda.createdAt || ''));
    parts.push(ansiHLine(targetCols, 8));
    String(agenda.content || '').split('\n').forEach((ln) => {
      wrapAnsiText(ln, targetCols).forEach((w) => parts.push(ansiColor(15) + w + ANSI_RESET));
    });
    return parts.join('\n');
  }

  return { buildConfRoomListAnsi, buildConfAgendaListAnsi, buildConfAgendaViewAnsi };
}
