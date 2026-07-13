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

  return async function handlePostViewCommand({ cmd, context }) {
    if (state.screen !== 'post-view' && state.screen !== 'attachment-list') {
      return false;
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
          
          const file = state._pendingDownload;
          const targetCols = typeof window !== 'undefined' && window.innerWidth < 768 ? 44 : 80;

          // Hitel 원전 화일 전송 대화 상자 연출 빌더
          const drawTransferBox = (percent) => {
            const barLength = Math.max(10, targetCols - 30);
            const filledLength = Math.floor((barLength * percent) / 100);
            const emptyLength = barLength - filledLength;
            const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
            
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

          const runTransferAnimation = async () => {
            if (typeof renderScreenSequential === 'function') {
              for (let pct = 0; pct <= 100; pct += 25) {
                await renderScreenSequential(drawTransferBox(pct), { clear: true });
                await new Promise(r => setTimeout(r, 200));
              }
            }

            try {
              await downloadAttachment(file.boardId, file.postId, file.fileId, file.fileName);
              setHint(`화일 전송 완료: ${file.fileName}`);
            } catch (err) {
              setHint(`화일 전송 실패: ${err.message}`);
            }

            state._downloadStage = null;
            state._pendingDownload = null;
            setPrompt('선택 >>');
            
            if (typeof showAttachmentList === 'function') {
              await showAttachmentList(file.postId);
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
        await showPostView(state.board.id, state.post.id);
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
          postId: state.post.id,
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

    if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
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

    if (cmd === 'A' || cmd === ']') {
      if (await showAdjacentPost(1)) {
        return true;
      }
    }
    if (cmd === 'N' || cmd === '[') {
      if (await showAdjacentPost(-1)) {
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
      await recommendPost(state.board.id, state.post.id);
      await showPostView(state.board.id, state.post.id);
      return true;
    }

    if (cmd === 'DD' || cmd === 'D') {
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      const canDelete = state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId);
      if (canDelete) {
        const confirmed = await deps.showConfirm(UI_TEXT.POST_DELETE_CONFIRM);
        if (confirmed) {
          try {
            await deletePost(state.board.id, state.post.id);
            await showPostList(state.board.id, state.page, {
              menuPath: state.boardMenuPath,
              menuTitle: state.boardMenuTitle,
              searchParams: { ...(state.searchParams || {}) }
            });
            deps.showToast?.(UI_TEXT.POST_DELETE_SUCCESS, 2000, 'success');
          } catch (error) {
            setHint(`${UI_TEXT.ERROR}: ${error.message}`);
          }
        }
      } else {
        setHint(UI_TEXT.POST_DELETE_MY_ONLY);
      }
      return true;
    }

    if (cmd === 'U') {
      await showAttachmentList(state.board.id, state.post.id);
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
