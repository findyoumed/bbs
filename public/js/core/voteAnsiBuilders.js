// [LOG: 20260622_2301] voteAnsiBuilders 구현 — 설문조사 ANSI 빌더
export function createVoteAnsiBuilders(deps) {
  const {
    ansiColor,
    ANSI_RESET,
    ANSI_BOLD,
    fitCell,
    buildTopHeader,
    ansiHLine,
    wrapAnsiText,
    displayWidth
  } = deps.ansiBuilderUtils;

  // 1. 투표 목록 ANSI 빌더
  // [LOG_ID: 20260715_1000] 20260714_1200에 여론광장(ACRO)이 오락실 하위에서 최상위로
  // 옮겨졌는데(오락실 중복 제거), 이 화면들의 헤더/푸터 문구는 그대로 "오락실"로 남아있었다
  // (사용자 지적: "GAME"이 좌상단에 뜨고 "[M] 초기화면"가 보임 — 실제로는 이미 최상위라
  // M/P가 초기화면으로 이동하도록 코드는 고쳐졌지만 문구가 안 따라갔던 것).
  // [LOG_ID: 20260715_1900] 모바일(44칸)에서 5컬럼 헤더가 그대로 나가 실측 오버플로우됐다
  // (사용자 요청 "모바일화면에서도 ui가 올바른지 확인해줘"로 발견). buildPostListAnsi의
  // "컬럼 드롭" 관례(ansiBoardBuilders.js)를 그대로 적용 — 참여인원 컬럼을 드롭하고
  // 참여여부는 1칸 배지로 압축.
  function buildVoteListAnsi(votes, page = 1, totalPages = 1) {
    const header = buildTopHeader({ leftLabel: 'ACRO', centerLabel: '설문조사 목록' }, `(${page}/${totalPages})`);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    let content = '';
    if (isMobile) {
      const ID_W = 3, TITLE_W = 32, STATE_W = 4, VOTED_W = 1;
      const headerBody = `${fitCell('번호', ID_W, 'right')} ${fitCell('설문조사 주제', TITLE_W)} ${fitCell('상태', STATE_W)} ${fitCell('V', VOTED_W)}`;
      content += ` ${ansiColor(11)}${fitCell(headerBody, targetCols - 1)}${ANSI_RESET}\n`;
      content += ansiHLine(targetCols, 8) + '\n';

      if (votes.length === 0) {
        content += '\n'.repeat(4);
        const emptyMsg = '등록된 설문조사가 없습니다.';
        const indent = Math.max(1, Math.floor((targetCols - displayWidth(emptyMsg)) / 2));
        content += ' '.repeat(indent) + emptyMsg + '\n';
        content += '\n'.repeat(5);
      } else {
        for (const vote of votes) {
          const idText = fitCell(String(vote.id), ID_W, 'right');
          const titleText = fitCell(vote.title, TITLE_W);
          const stateText = fitCell(vote.isActive ? '진행' : '종료', STATE_W);
          const votedText = fitCell(vote.userVotedOption !== null ? 'V' : '·', VOTED_W);
          const color = vote.isActive ? ansiColor(15) : ansiColor(8);
          const body = `${idText} ${titleText} ${stateText} ${votedText}`;
          content += color + fitCell(body, targetCols) + ANSI_RESET + '\n';
        }
        const paddingRows = 12 - votes.length;
        if (paddingRows > 0) content += '\n'.repeat(paddingRows);
      }
      content += ansiHLine(targetCols, 8) + '\n';
      return header + content;
    }

    content += ` ${ansiColor(11)}번호  설문조사 주제                                    상태  참여여부  참여인원${ANSI_RESET}\n`;
    content += ansiHLine(80, 8) + '\n';

    if (votes.length === 0) {
      content += '\n'.repeat(4);
      content += ' '.repeat(26) + '등록된 설문조사가 없습니다.\n';
      content += '\n'.repeat(5);
    } else {
      for (const vote of votes) {
        const idText = fitCell(String(vote.id), 4, 'right');
        const titleText = fitCell(vote.title, 48, 'left');
        const stateText = vote.isActive ? '진행중' : '종료됨';
        const votedText = vote.userVotedOption !== null ? ' [V] ' : ' [ ] ';
        const totalText = fitCell(`${vote.totalVotes || 0}명`, 8, 'right');

        const color = vote.isActive ? ansiColor(15) : ansiColor(8);
        content += `${color}${idText}  ${titleText}  ${stateText}  ${votedText}  ${totalText}${ANSI_RESET}\n`;
      }

      const paddingRows = 12 - votes.length;
      if (paddingRows > 0) {
        content += '\n'.repeat(paddingRows);
      }
    }

    content += ansiHLine(80, 8) + '\n';

    return header + content;
  }

  // 2. 투표 상세 및 결과 ANSI 빌더
  // [LOG_ID: 20260715_1900] 제목 줄(80칸 기준 조립이라 30자 제목이면 60칸)과 그래프 바
  // 줄(라벨26+바30+퍼센트 = 60여칸)이 모바일 44칸에서 실측 오버플로우됐다. 제목은
  // wrapAnsiText로 감싸고(데스크톱 80칸은 no-op), createdBy는 방어적으로 클램프, 옵션
  // 줄은 모바일에서 라벨/그래프를 2줄로 분리하고 막대 길이를 절반(8칸)으로 줄인다.
  function buildVoteDetailAnsi(vote) {
    const header = buildTopHeader({ leftLabel: 'ACRO', centerLabel: '설문 상세 결과' });
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    let content = '';
    const titleLines = wrapAnsiText(`설문 주제: ${ANSI_BOLD}${vote.title}`, targetCols - 1);
    for (const line of titleLines) {
      content += ` ${ansiColor(11)}${line}${ANSI_RESET}\n`;
    }
    const createdByMax = isMobile ? 10 : 20;
    const createdByText = displayWidth(vote.createdBy) > createdByMax
      ? fitCell(vote.createdBy, createdByMax, 'left')
      : vote.createdBy;
    content += ` ${ansiColor(14)}작성자  : ${createdByText}  |  상태: ${vote.isActive ? '진행중' : '종료됨'}${ANSI_RESET}\n`;
    content += ansiHLine(targetCols, 8) + '\n\n';

    // [LOG_ID: 20260715_1130] '█'(U+2588)/'░'(U+2591)는 커스텀 픽셀 폰트(BbsPrimaryFont 등)에
    // 글리프가 없어 시스템 색상 폰트로 폴백되면서 무지개색 노이즈로 깨져 보였다(사용자 보고).
    // 이미 XT 접속화면 등에서 정상 렌더링이 실측 확인된 '■'/'□'(U+25A0/25A1, 폭 2칸 광폭
    // 문자)로 교체 — 폭이 2배가 되므로 칸 수를 절반(15칸)으로 줄여 시각적 길이를 유지한다.
    const maxGraphWidth = isMobile ? 8 : 15; // [■■■□□□] 길이(광폭 문자라 실제 표시폭은 2배)

    for (let i = 0; i < vote.options.length; i++) {
      const option = vote.options[i];
      const count = vote.counts[i] || 0;
      const pct = vote.totalVotes > 0 ? Math.round((count / vote.totalVotes) * 100) : 0;

      // 그래프 바 조립
      const filledCount = Math.round((pct / 100) * maxGraphWidth);
      const emptyCount = maxGraphWidth - filledCount;
      const bar = '■'.repeat(filledCount) + '□'.repeat(emptyCount);

      let color = ansiColor(15);
      if (vote.userVotedOption === i) {
        color = ansiColor(10); // 본인이 참여한 항목은 초록색 하이라이트
      }

      if (isMobile) {
        const optionLabel = fitCell(` [${i + 1}] ${option}`, targetCols - 1, 'left');
        content += `${color}${optionLabel}${ANSI_RESET}\n`;
        content += `${color}   [${bar}] ${pct.toString().padStart(3, ' ')}% (${count}표)${ANSI_RESET}\n`;
      } else {
        const optionLabel = ` [${i + 1}] ${option}`;
        const optionText = fitCell(optionLabel, 26, 'left');
        content += `${color}${optionText} [${bar}] ${pct.toString().padStart(3, ' ')}% (${count}표)${ANSI_RESET}\n`;
      }
    }

    content += '\n';
    content += ansiHLine(targetCols, 8) + '\n';

    if (vote.isActive && vote.userVotedOption === null) {
      for (const line of wrapAnsiText('아직 투표하지 않으셨습니다. 번호를 입력하여 투표해 주세요.', targetCols - 1)) {
        content += ` ${ansiColor(11)}${line}${ANSI_RESET}\n`;
      }
    } else if (vote.userVotedOption !== null) {
      for (const line of wrapAnsiText(`회원님은 [${vote.userVotedOption + 1}]번에 이미 참여하셨습니다.`, targetCols - 1)) {
        content += ` ${ansiColor(10)}${line}${ANSI_RESET}\n`;
      }
    } else {
      content += ` ${ansiColor(8)}이 설문은 종료되었습니다.${ANSI_RESET}\n`;
    }

    return header + content;
  }

  // 3. 투표 생성 화면 ANSI 빌더
  // [LOG_ID: 20260715_1900] 모든 안내 문구가 80칸 기준으로도 여유 있어 wrapAnsiText로
  // 감싸기만 하면 됨 — 데스크톱은 targetCols=80이라 사실상 no-op(기존 출력 그대로),
  // 모바일(44칸)에서만 자동 줄바꿈된다. isMobile 분기 자체가 필요 없다.
  function buildVoteCreateAnsi() {
    const header = buildTopHeader({ leftLabel: 'ACRO', centerLabel: '신규 설문조사 등록' });
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    let content = '';
    for (const line of wrapAnsiText('새로운 설문조사를 개설합니다.', targetCols - 2)) {
      content += ` ${ansiColor(11)}${line}${ANSI_RESET}\n`;
    }
    content += ansiHLine(targetCols, 8) + '\n\n';
    for (const line of wrapAnsiText('1. 설문 제목 (예: BBS에서 가장 재미있는 게임은?)', targetCols - 2)) {
      content += ` ${ansiColor(15)}${line}${ANSI_RESET}\n`;
    }
    for (const line of wrapAnsiText('2. 선택지 목록 (쉼표로 구분, 예: 삼국지, 도스게임, 바이오리듬)', targetCols - 2)) {
      content += ` ${ansiColor(15)}${line}${ANSI_RESET}\n`;
    }
    content += '\n'.repeat(8);
    content += ansiHLine(targetCols, 8) + '\n';
    for (const line of wrapAnsiText('화면 아래의 안내에 따라 순서대로 입력하고 Enter를 누르세요.', targetCols - 2)) {
      content += ` ${ansiColor(14)}${line}${ANSI_RESET}\n`;
    }
    return header + content;
  }

  return {
    buildVoteListAnsi,
    buildVoteDetailAnsi,
    buildVoteCreateAnsi
  };
}
