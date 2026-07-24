import { UI_TEXT } from './i18n.js';

/**
 * commandRouterPostView.js
 * [LOG: 20260426_2125] Evolution Mode: Integrated i18n and replaced unicode escapes.
 */

export function createPostViewCommandHandler(deps) {
  const {
    apiFetch,
    deletePost,
    recommendPost,
    restoreStateFromURL,
    setHint,
    setPrompt,
    showAdjacentPost,
    showMain,
    showPostList,
    showPostView,
    showPostWrite,
    showAttachmentList,
    downloadAttachment,
    renderScreenSequential,
    state
  } = deps;

  // [LOG_ID: 20260713_0930] LV 등급 별칭 — 서버 BoardRepositoryAccess.LEVEL_NAME_MAP과 동일하게 유지
  const LEVEL_LABELS = { 1: '일반회원', 2: '특별회원', 99: '운영자' };

  // [LOG_ID: 20260724_2100] 종전엔 deps.showConfirm(다이얼로그)이 "정말 삭제하시겠습니까?" 줄을
  // screenEl에 직접 append했는데(terminalDialog.js appendTranscript), 글보기 화면은 언제나
  // 24줄로 패딩된 정적 스냅샷이라 그 뒤에 이어 붙으면 짧은 글일수록 본문과 한참 떨어진 화면
  // 맨 아래에 질문만 동떨어져 보였다(사용자 보고: "d로 삭제할때 ui가 이상해" — 스크린샷 실측:
  // "안녕하세요" 한 줄 본문과 "정말 삭제하시겠습니까?" 사이에 빈 줄이 15줄 넘게 벌어짐).
  // post-list의 삭제 확인(commandRouterBrowse.js beginDeleteConfirm)은 애초에 이 문제가 없다 —
  // screenEl은 그대로 두고 setHint/setPrompt만 바꿔 질문을 힌트/프롬프트 줄에만 띄운다. 같은
  // 방식으로 통일한다.
  function beginPostDeleteConfirm(post) {
    state._postDeleteConfirmStage = {
      boardId: state.board?.id,
      postId: post.localId ?? post.id,
      page: state.page,
      menuPath: state.boardMenuPath,
      menuTitle: state.boardMenuTitle,
      searchParams: { ...(state.searchParams || {}) }
    };
    setHint(`${UI_TEXT.POST_DELETE_TARGET}: ${post.title || (post.localId ?? post.id)}`);
    setPrompt(`${UI_TEXT.POST_DELETE_CONFIRM} (Y/N) [N] >>`);
  }

  return async function handlePostViewCommand({ cmd, context }) {
    if (state.screen !== 'post-view' && state.screen !== 'attachment-list') {
      return false;
    }

    if (state.screen === 'post-view' && state._postDeleteConfirmStage) {
      const deleteStage = state._postDeleteConfirmStage;
      state._postDeleteConfirmStage = null;
      const normalizedInput = String(cmd || '').trim().toUpperCase();
      if (normalizedInput === 'Y' || normalizedInput === 'YES') {
        try {
          await deletePost(deleteStage.boardId, deleteStage.postId);
          await showPostList(deleteStage.boardId, deleteStage.page, {
            menuPath: deleteStage.menuPath,
            menuTitle: deleteStage.menuTitle,
            searchParams: { ...(deleteStage.searchParams || {}) }
          });
          deps.showToast?.(UI_TEXT.POST_DELETE_SUCCESS, 2000, 'success');
        } catch (error) {
          setHint(`${UI_TEXT.ERROR}: ${error.message}`);
          setPrompt('선택 >>');
        }
      } else {
        setHint('삭제를 취소했습니다.');
        setPrompt('선택 >>');
      }
      return true;
    }

    if (state.screen === 'attachment-list') {
      // [LOG_ID: 20260713_1030] 화일 전송 프로토콜 선택 분기 가로채기
      if (state._downloadStage === 'protocol' && state._pendingDownload) {
        const choice = String(cmd || '').trim();
        if (choice === '0') {
          state._downloadStage = null;
          state._pendingDownload = null;
          setHint('화일 전송이 취소되었습니다.');
          setPrompt('선택 >>');
          return true;
        }

        if (['1', '2', '3'].includes(choice)) {
          const protocolName = choice === '1' ? 'Kermit' : choice === '2' ? 'Zmodem' : 'Super Kermit';
          state._downloadStage = 'transferring';

          const targetCols = typeof window !== 'undefined' && window.innerWidth < 768 ? 44 : 80;

          // Hitel 원전 화일 전송 대화 상자 연출 빌더
          // [LOG_ID: 20260715_1200] '█'/'░'는 커스텀 픽셀 폰트에 글리프가 없어 색상 폰트로
          // 폴백되며 무지개색 노이즈로 깨졌다(투표 그래프와 동일 원인). 실측 확인된
          // '■'/'□'(폭 2칸)로 교체 — 폭이 2배가 되므로 barLength를 절반으로 줄여 원래의
          // 시각적 길이(표시폭)를 유지한다.
          const drawTransferBox = (file, percent) => {
            const barLength = Math.max(5, Math.floor((targetCols - 30) / 2));
            const filledLength = Math.floor((barLength * percent) / 100);
            const emptyLength = barLength - filledLength;
            const bar = '■'.repeat(filledLength) + '□'.repeat(emptyLength);

            // 80칸 기준 TUI 전송 박스
            const padName = String(file.fileName).substring(0, 25).padEnd(25);
            const padProto = String(protocolName).padEnd(25);
            const padSize = String(Math.round(file.fileSize / 1024) + ' KB').padEnd(25);
            const padPct = String(percent + ' %').padEnd(25);

            return `\n\n\n` +
              `      ┌──────────────────────────────────────────────┐\n` +
              `      │         [ 화 일  전 송  프 로 토 콜 ]        │\n` +
              `      ├──────────────────────────────────────────────┤\n` +
              `      │  파일명    : ${padName} │\n` +
              `      │  프로토콜  : ${padProto} │\n` +
              `      │  파일 크기 : ${padSize} │\n` +
              `      │  전송 진행 : ${padPct} │\n` +
              `      │  [${bar}] │\n` +
              `      └──────────────────────────────────────────────┘\n`;
          };

          // [LOG_ID: 20260722_3300] 하이텔 책(p.128) "DN 번호1, 번호2..." / "DN 번호1-번호2"
          // 다중/범위 다운로드 지원 — commandRouterBrowse.js의 DN 파서가 채운
          // state._downloadQueue(남은 글 번호 목록)를 한 번 선택한 프로토콜로 순서대로 소진한다.
          const runTransferAnimation = async () => {
            let currentFile = state._pendingDownload;
            let lastPostId = currentFile.postId;
            let transferredCount = 0;

            while (currentFile) {
              if (typeof renderScreenSequential === 'function') {
                for (let pct = 0; pct <= 100; pct += 25) {
                  await renderScreenSequential(drawTransferBox(currentFile, pct), { clear: true });
                  await new Promise(r => setTimeout(r, 200));
                }
              }

              try {
                await downloadAttachment(currentFile.boardId, currentFile.postId, currentFile.fileId, currentFile.fileName);
                transferredCount += 1;
                const remaining = state._downloadQueue?.queue?.length || 0;
                setHint(remaining > 0
                  ? `화일 전송 완료: ${currentFile.fileName} (남은 ${remaining}건)`
                  : `화일 전송 완료: ${currentFile.fileName}`);
              } catch (err) {
                setHint(`화일 전송 실패: ${err.message}`);
              }

              lastPostId = currentFile.postId;
              currentFile = null;

              while (state._downloadQueue?.queue?.length) {
                const nextPostId = state._downloadQueue.queue.shift();
                let attachments = [];
                try {
                  attachments = await apiFetch(`/api/boards/${state._downloadQueue.boardId}/posts/${nextPostId}/attachments`);
                } catch (err) {
                  attachments = [];
                }
                const nextFile = Array.isArray(attachments) && attachments.length > 0 ? attachments[0] : null;
                if (nextFile) {
                  currentFile = {
                    boardId: state._downloadQueue.boardId,
                    postId: nextPostId,
                    fileId: nextFile.id,
                    fileName: nextFile.originalFilename || nextFile.filename,
                    fileSize: nextFile.fileSize
                  };
                  break;
                }
                // 첨부파일이 없는 글은 건너뛰고 큐의 다음 글로 계속 진행한다.
              }
            }

            state._downloadQueue = null;
            state._downloadStage = null;
            state._pendingDownload = null;
            setPrompt('선택 >>');

            // [LOG_ID: 20260713_1120] 자료실 목록 화면(post-list)에서 다운로드가 완료된 경우 목록 화면으로 복원
            if (state._originScreenForDownload === 'post-list') {
              state._originScreenForDownload = null;
              if (typeof showPostList === 'function') {
                await showPostList(state.board.id, state.page, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
              }
            } else if (typeof showAttachmentList === 'function') {
              await showAttachmentList(state.board.id, lastPostId);
            }
          };

          runTransferAnimation();
          return true;
        }

        setHint('잘못된 선택입니다. (1.Kermit  2.Zmodem  3.Super Kermit  0.취소)');
        setPrompt('선택 (1-3, 0) >>');
        return true;
      }

      if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
        await showPostView(state.board.id, state.post.localId ?? state.post.id);
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      const idx = parseInt(cmd, 10);
      if (idx >= 1 && state._attachments?.[idx - 1]) {
        const file = state._attachments[idx - 1];
        // [LOG_ID: 20260713_1030] 파일 다운로드 즉시 실행 대신 프로토콜 선택 단계 개시
        state._pendingDownload = {
          boardId: state.board.id,
          postId: state.post.localId ?? state.post.id,
          fileId: file.id,
          fileName: file.originalFilename || file.filename,
          fileSize: file.fileSize
        };
        state._downloadStage = 'protocol';
        setHint('* 화일 전송 프로토콜을 선택하십시오.\n1.Kermit  2.Zmodem  3.Super Kermit  0.취소');
        setPrompt('선택 (1-3, 0) >>');
        return true;
      }
      return false;
    }

    // [LOG_ID: 20260724_1610] 본문 내 상하 페이징(F/B/엔터) 가로채기
    const postPageNo = Number(state.postPageNo || 1);
    const postPageCount = Number(state.postPageCount || 1);

    if (cmd === 'F') {
      if (postPageNo < postPageCount) {
        await showPostView(state.board.id, state.post.localId ?? state.post.id, false, postPageNo + 1);
        return true;
      } else {
        setHint('마지막 페이지입니다.');
        return true;
      }
    }

    // [LOG_ID: 20260724_1935] 위 주석("F/B/엔터 가로채기")과 달리 B는 실제로 구현된 적이
    // 없어, 페이지 중간(2쪽 이상)에서 B를 눌러도 이전 페이지로 못 가고 그대로 아래 L281의
    // window.history.back() 폴백까지 흘러갔다 — 딥링크로 들어와 브라우저 히스토리 스택이
    // 얕은 경우 "상위메뉴"(초기화면)까지 튕겨 나가는 버그로 실측 재현됨(사용자 보고:
    // "이전 페이지 누르니까 상위메뉴로 가는데"). F와 대칭으로 본문 내 이전 페이지 이동을
    // 여기서 직접 처리하고, 이미 1쪽이면(본문상 더 갈 곳이 없으면) 아래 목록 이동 폴백으로
    // 넘어가도록 return하지 않는다.
    if (cmd === 'B' && postPageNo > 1) {
      await showPostView(state.board.id, state.post.localId ?? state.post.id, false, postPageNo - 1);
      return true;
    }

    // 엔터 입력 시 아직 본문 다음 페이지가 남아 있으면 다음 페이지로 우선 이동
    if (cmd === '') {
      if (postPageNo < postPageCount) {
        await showPostView(state.board.id, state.post.localId ?? state.post.id, false, postPageNo + 1);
        return true;
      }
    }

    // [LOG_ID: 20260711_1340] PR 연속읽기 — olddos-bbs(hanulso) 원작 명령 복원.
    // 모드 중 빈 엔터는 다음 글로 이동, 마지막 글이면 모드를 마친다.
    // A/N(인접 글 이동)과 빈 엔터 외의 명령을 입력하면 모드가 풀린다.
    const continuousRead = state._continuousRead
      && String(state._continuousRead.boardId) === String(state.board?.id);
    if (continuousRead && cmd === '') {
      if (state._continuousRead.queue && state._continuousRead.queue.length > 0) {
        const nextId = state._continuousRead.queue.shift();
        await showPostView(state.board.id, nextId);
        if (state._continuousRead.queue.length > 0) {
          setHint(`연속읽기(남은글 ${state._continuousRead.queue.length}건): [엔터] 다음 글 · 다른 명령 입력 시 종료`);
        } else {
          setHint('연속읽기: [엔터] 다음 글(마지막) · 다른 명령 입력 시 종료');
        }
        return true;
      }

      if (await showAdjacentPost(1)) {
        setHint('연속읽기: [엔터] 다음 글 · 다른 명령 입력 시 종료');
      } else {
        state._continuousRead = null;
        setHint('마지막 글입니다. 연속읽기를 마칩니다.');
        setPrompt('선택 >>');
      }
      return true;
    }
    if (cmd === 'PR') {
      state._continuousRead = { boardId: state.board.id };
      setHint('연속읽기: [엔터] 다음 글부터 이어서 보여줍니다.');
      return true;
    }
    if (state._continuousRead && cmd !== '' && cmd !== 'A' && cmd !== 'N') {
      state._continuousRead = null;
    }

    if (cmd === 'T') {
      await showMain();
      return true;
    }

    const ltMatch = cmd.match(/^LT\s+(.+)$/);
    if (ltMatch) {
      await showPostList(state.board.id, 1, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: { lt: ltMatch[1].trim() }
      });
      return true;
    }

    const liMatch = cmd.match(/^LI\s+(.+)$/);
    if (liMatch) {
      await showPostList(state.board.id, 1, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: { li: liMatch[1].trim() }
      });
      return true;
    }

    if (cmd === 'LT' || cmd === 'LI') {
      state._pendingSearch = {
        type: cmd.toLowerCase(),
        boardId: state.board.id,
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle
      };
      setHint(cmd === 'LT' ? UI_TEXT.SEARCH_TITLE_PROMPT : UI_TEXT.SEARCH_AUTHOR_PROMPT);
      setPrompt(cmd === 'LT' ? UI_TEXT.SEARCH_KEYWORD : UI_TEXT.SEARCH_AUTHOR_ID);
      return true;
    }

    // [LOG_ID: 20260724_1935] window.history.back()은 딥링크로 들어와 히스토리 스택이 얕을 때
    // 목록이 아니라 초기화면까지 튕겨 나가는 등 결과를 예측할 수 없다 — P/M과 똑같이 상태 기반
    // showPostList로 목록에 확실히 도달하도록 통일한다(20260724_1754 로그의 원래 의도).
    if (cmd === 'B' || cmd === 'P' || cmd === 'M') {
      await showPostList(state.board.id, state.page, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: state.searchParams
      });
      return true;
    }

    if (cmd === 'L') {
      await showPostList(state.board.id, 1, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: {}
      });
      return true;
    }

    // [LOG_ID: 20260722_3400] 하이텔 책(길라잡이 p.92) 실측: "1047번 글을 읽다가 'A' 명령을
    // 내리면 1048번 글(화면 윗부분에 있는 글, 즉 더 높은 번호)로 이동한다. 'N'은 'A'의 반대."
    // 즉 A=더 높은 번호(최신 방향)/N=더 낮은 번호(과거 방향)인데, 게시판 글보기는 지금까지
    // 정반대(A=다음글/더 낮은 번호, N=이전글/더 높은 번호)로 구현돼 있었다. 뉴스 기사 보기
    // (commandRouterService.js)는 이미 책과 같은 방향으로 구현돼 있어(사용자 기존 사양),
    // 게시판 쪽만 책·뉴스 규칙에 맞춰 방향을 뒤집는다(공용 인프라는 별도 검토 사항으로 유지).
    if (cmd === 'A' || cmd === ']') {
      if (await showAdjacentPost(-1)) {
        return true;
      }
    }
    if (cmd === 'N' || cmd === '[') {
      if (await showAdjacentPost(1)) {
        return true;
      }
    }

    if (cmd === 'RE' || cmd === 'R') {
      // [LOG: 20260429_0239] Keep reply auth parity in one place so guest users
      // get the same login-required hint as direct /board/.../write restores.
      showPostWrite('reply', state.post);
      return true;
    }

    // [LOG: 20260429_0328] Detail-view auth-guarded commands must fail closed
    // so guest E/D inputs reuse the same login-required hint path as R/V.
    const isGuestUser = !state.user || state.user.isGuest;

    if (cmd === 'ED' || cmd === 'E' || cmd === 'EDIT') {
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      const canEdit = state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId);
      if (canEdit) {
        showPostWrite('edit', state.post);
      } else {
        setHint(UI_TEXT.POST_EDIT_MY_ONLY);
      }
      return true;
    }

    if (cmd === 'OK' || cmd === 'V') {
      // [LOG: 20260429_0229] `V` is documented as login-required, so guest users
      // must stay on the current post and see the same login hint as other guarded flows.
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      await recommendPost(state.board.id, state.post.localId ?? state.post.id);
      await showPostView(state.board.id, state.post.localId ?? state.post.id);
      return true;
    }

    if (cmd === 'DD' || cmd === 'D') {
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      const canDelete = state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId);
      if (canDelete) {
        beginPostDeleteConfirm(state.post);
      } else {
        setHint(UI_TEXT.POST_DELETE_MY_ONLY);
      }
      return true;
    }

    if (cmd === 'U') {
      await showAttachmentList(state.board.id, state.post.localId ?? state.post.id);
      return true;
    }

    // [LOG_ID: 20260713_0930] LV [등급] — 글 작성자의 회원 등급 변경 (olddos-bbs 원작 명령 복원).
    // 운영자 전용, 게시글 보기 상태에서만. 서버도 ensureAdmin으로 이중 방어한다.
    const lvMatch = cmd.match(/^LV(?:\s+(\d+))?$/);
    if (lvMatch) {
      if (!state.user?.isAdmin) {
        setHint('LV는 운영자만 사용할 수 있는 명령입니다.');
        return true;
      }
      const authorId = String(state.post?.authorUserId || state.post?.userId || '').trim();
      if (!authorId) {
        setHint('이 글의 작성자 정보를 확인할 수 없습니다.');
        return true;
      }
      if (!lvMatch[1]) {
        setHint(`사용법: LV {등급} — ${authorId}님의 등급을 변경합니다. (1:일반회원, 2:특별회원, 99:운영자)`);
        return true;
      }
      const nextLevel = Number(lvMatch[1]);
      try {
        const updated = await apiFetch(`/api/members/${encodeURIComponent(authorId)}/level`, {
          method: 'POST',
          body: JSON.stringify({ level: nextLevel, nickNameHint: state.post?.nickName || state.post?.author || authorId })
        });
        const label = LEVEL_LABELS[updated?.level ?? nextLevel] || `레벨 ${nextLevel}`;
        deps.showToast?.(`${authorId}님의 등급을 ${label}(으)로 변경했습니다.`, 2500, 'success');
        setHint(`${authorId} → ${label}`);
      } catch (error) {
        setHint(`${UI_TEXT.ERROR}: ${error.message}`);
      }
      return true;
    }

    return false;
  };
}
