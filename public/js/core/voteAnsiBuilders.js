// [LOG: 20260622_2301] voteAnsiBuilders 구현 — 설문조사 ANSI 빌더
export function createVoteAnsiBuilders(deps) {
  const {
    ansiColor,
    ANSI_RESET,
    ANSI_BOLD,
    fitCell,
    buildTopHeader,
    ansiHLine
  } = deps.ansiBuilderUtils;

  // 1. 투표 목록 ANSI 빌더
  function buildVoteListAnsi(votes, page = 1, totalPages = 1) {
    const header = buildTopHeader(['오락실', '설문조사 목록'], `(${page}/${totalPages})`);

    let content = '';
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
    content += ` ${ansiColor(14)}[번호] 보기 | [W] 설문등록 | [P] 이전 | [M] 오락실메뉴 | [T] 대문${ANSI_RESET}\n`;

    return header + content;
  }

  // 2. 투표 상세 및 결과 ANSI 빌더
  function buildVoteDetailAnsi(vote) {
    const header = buildTopHeader(['오락실', '설문 상세 결과']);

    let content = '';
    content += ` ${ansiColor(11)}설문 주제: ${ANSI_BOLD}${vote.title}${ANSI_RESET}\n`;
    content += ` ${ansiColor(14)}작성자  : ${vote.createdBy}  |  상태: ${vote.isActive ? '진행중' : '종료됨'}${ANSI_RESET}\n`;
    content += ansiHLine(80, 8) + '\n\n';

    const maxGraphWidth = 30; // [██████░░░░░] 길이

    for (let i = 0; i < vote.options.length; i++) {
      const option = vote.options[i];
      const count = vote.counts[i] || 0;
      const pct = vote.totalVotes > 0 ? Math.round((count / vote.totalVotes) * 100) : 0;

      // 그래프 바 조립
      const filledCount = Math.round((pct / 100) * maxGraphWidth);
      const emptyCount = maxGraphWidth - filledCount;
      const bar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);

      const optionLabel = ` [${i + 1}] ${option}`;
      const optionText = fitCell(optionLabel, 26, 'left');

      let color = ansiColor(15);
      if (vote.userVotedOption === i) {
        color = ansiColor(10); // 본인이 참여한 항목은 초록색 하이라이트
      }

      content += `${color}${optionText} [${bar}] ${pct.toString().padStart(3, ' ')}% (${count}표)${ANSI_RESET}\n`;
    }

    content += '\n';
    content += ansiHLine(80, 8) + '\n';

    if (vote.isActive && vote.userVotedOption === null) {
      content += ` ${ansiColor(11)}아직 투표하지 않으셨습니다. 번호를 입력하여 투표해 주세요.${ANSI_RESET}\n`;
      content += ` ${ansiColor(14)}[번호] 투표하기 | [B] 목록으로 | [M] 오락실메뉴 | [T] 대문${ANSI_RESET}\n`;
    } else {
      if (vote.userVotedOption !== null) {
        content += ` ${ansiColor(10)}회원님은 [${vote.userVotedOption + 1}]번에 이미 참여하셨습니다.${ANSI_RESET}\n`;
      } else {
        content += ` ${ansiColor(8)}이 설문은 종료되었습니다.${ANSI_RESET}\n`;
      }
      content += ` ${ansiColor(14)}[B] 목록으로 | [M] 오락실메뉴 | [T] 대문${ANSI_RESET}\n`;
    }

    return header + content;
  }

  // 3. 투표 생성 화면 ANSI 빌더
  function buildVoteCreateAnsi() {
    const header = buildTopHeader(['오락실', '신규 설문조사 등록']);
    let content = '';
    content += ` ${ansiColor(11)}새로운 설문조사를 개설합니다.${ANSI_RESET}\n`;
    content += ansiHLine(80, 8) + '\n\n';
    content += ` ${ansiColor(15)}1. 설문 제목 (예: BBS에서 가장 재미있는 게임은?)${ANSI_RESET}\n`;
    content += ` ${ansiColor(15)}2. 선택지 목록 (쉼표로 구분, 예: 삼국지, 도스게임, 바이오리듬)${ANSI_RESET}\n`;
    content += '\n'.repeat(8);
    content += ansiHLine(80, 8) + '\n';
    content += ` ${ansiColor(14)}화면 아래의 안내에 따라 순서대로 입력하고 Enter를 누르세요. [B] 취소${ANSI_RESET}\n`;
    return header + content;
  }

  return {
    buildVoteListAnsi,
    buildVoteDetailAnsi,
    buildVoteCreateAnsi
  };
}
