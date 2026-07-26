/**
 * [LOG_ID: 20260719_1600] 토론의 광장(CONF) ANSI 빌더 — 회의실 목록/안건 목록/안건 보기.
 * 하이텔 (12)여론광장-1.토론의 광장 재현.
 */
export function createConfAnsiBuilders(deps) {
  const { ANSI_RESET, ansiColor, ansiHLine, buildPageLabel, buildTopHeader, fitCell, formatLongDate, wrapAnsiText, displayWidth } =
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
  // [LOG_ID: 20260726_2300] 안건 본문(content)은 서버에서 최대 4000자까지 저장되는데
  // (ConfRepositoryMemory/Supabase.js), 이 함수는 페이징 없이 wrapAnsiText로 접은 줄을
  // 전부 그대로 이어붙이기만 했다 — ansiEngine.js가 25행 고정 격자(ROWS=25)라 그 이후 줄은
  // HTML로 렌더되기도 전에 조용히 버려진다(게시글 보기가 이미 페이징으로 해결한 것과 동일한
  // 버그 클래스). 실측: 2270자(4000자 상한의 절반 조금 넘음, 극단적 사례가 아닌 평범한 안건
  // 분량)짜리 본문 하나로 129줄이 나와, 25행을 넘는 나머지(전체의 약 80%)가 통째로 사라짐을
  // 확인 — 사용자에게는 안건 내용이 도중에 뚝 끊긴 것처럼 보인다. buildPostViewAnsi(게시글
  // 보기)와 동일한 방식으로 가용 본문 줄 수를 계산해 페이지 단위로 나눈다.
  function buildConfAgendaViewAnsi(agenda, requestedPageNo = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const labelWidth = isMobile ? 6 : 8;
    const valueWidth = targetCols - labelWidth - 3;
    const row = (label, value) => ansiColor(14) + fitCell(label, labelWidth) + ' : ' + ansiColor(15) + fitCell(String(value), valueWidth) + ANSI_RESET;
    // [LOG_ID: 20260726_0330] 안건 제목은 최대 80자(ConfRepository*.js)까지 저장되는데
    // row()의 fitCell은 한 줄로 자르기만 해 긴 제목이 말줄임표 없이 그냥 잘려 보였다(게시글
    // 상세보기의 60자 제목과 동일한 버그 클래스 — 실측 재현: 80자 한글 제목이 15자쯤에서
    // 끊김). 발의자/재청/발의일은 원래도 짧은 값이라 fitCell 그대로 두고, 제목만
    // wrapAnsiText로 여러 줄로 접는다.
    // [LOG_ID: 20260726_0730] "발의자는 원래도 짧다"는 위 가정이 틀렸다 — authorName은
    // 회원 닉네임(최대 20자, 표시폭 40칸, authRoutes.js `nickName: {maxLength:20}`)이라
    // 모바일 예산(valueWidth=35)을 넘는 실제 값이 존재한다(실측 재현: 20자 닉네임이 17자쯤에서
    // 끊김 — 프로필 화면과 같은 버그가 여기도 있었다). 제목과 동일하게 wrap 처리한다.
    const rowWrapped = (label, value) => {
      const labelText = fitCell(label, labelWidth);
      const indent = ' '.repeat(labelWidth + 3);
      return wrapAnsiText(String(value), valueWidth).map((line, i) => (
        ansiColor(14) + (i === 0 ? `${labelText} : ` : indent) + ansiColor(15) + line + ANSI_RESET
      ));
    };

    const titleLines = rowWrapped('안건', `${agenda.no}. ${agenda.title || ''}`);
    const authorLines = rowWrapped('발의자', agenda.authorName || agenda.author || '손님');
    const contentLines = [];
    String(agenda.content || '').split('\n').forEach((ln) => {
      wrapAnsiText(ln, targetCols).forEach((w) => contentLines.push(w));
    });

    // ansiEngine.js의 고정 격자(ROWS=25)를 넘지 않도록 안전 여유를 둔 캔버스 크기(다른
    // 페이징 화면들과 동일하게 25보다 살짝 작은 값을 쓴다 — post-view는 24, help/policy는 23).
    const totalLines = 24;
    const topHeaderLines = 4; // frame() = buildTopHeader() 반환 줄 수
    // 제목/발의자 줄(가변) + 재청/발의일(고정 2줄) + 구분선(1줄)
    const headerLineCount = titleLines.length + authorLines.length + 2 + 1;
    const baseLines = Math.max(3, totalLines - topHeaderLines - headerLineCount);

    const pages = [];
    let currentLineIdx = 0;
    const totalBodyLines = Math.max(1, contentLines.length);
    while (currentLineIdx < totalBodyLines) {
      const isLastPage = (totalBodyLines - currentLineIdx) <= baseLines;
      const allowedLines = isLastPage ? Math.max(3, baseLines) : baseLines;
      const chunk = contentLines.slice(currentLineIdx, currentLineIdx + allowedLines);
      pages.push(chunk);
      currentLineIdx += chunk.length;
    }

    const pageCount = pages.length;
    const currentPage = Math.min(Math.max(Number.parseInt(requestedPageNo, 10) || 1, 1), pageCount);
    const visibleBodyLines = pages[currentPage - 1] || [];
    const pageLabel = buildPageLabel(currentPage, pageCount);

    const parts = [buildTopHeader({ leftLabel: 'FORUM', centerLabel: '안건 보기' }, pageLabel, targetCols)];
    parts.push(...titleLines);
    parts.push(...authorLines);
    parts.push(row('재청', `${agenda.secondCount || 0}명${agenda.seconded ? ' (나 재청함)' : ''}`));
    parts.push(row('발의일', formatLongDate(agenda.createdAt) || agenda.createdAt || ''));
    parts.push(ansiHLine(targetCols, 8));
    visibleBodyLines.forEach((line) => {
      parts.push(ansiColor(15) + line + ANSI_RESET);
    });

    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < totalLines) {
      joinedLines.push(ANSI_RESET);
    }

    return {
      text: joinedLines.slice(0, totalLines).join('\n'),
      pageNo: currentPage,
      pageCount
    };
  }

  return { buildConfRoomListAnsi, buildConfAgendaListAnsi, buildConfAgendaViewAnsi };
}
