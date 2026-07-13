import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbar, renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';

export function createMemoScreens(deps) {
    const {
        ansiToHTML,
        apiFetch,
        applyCommandFooter,
        buildMemoListAnsi,
        buildMemoViewAnsi,
        cmdInput,
        esc,
        getSupportedFooterText,
        getMenuNodeByKey,
        screenEl,
        setHint,
        setLoading,
        setPrompt,
        setReady,
        state,
        updateURL
    } = deps;

    function focusCommandInput() {
        if (shouldAutoFocusCommandInput()) {
            cmdInput.focus();
        }
    }

    function renderMemoStatus(message) {
        clearMemoWriteFlow();
        const safeMessage = String(message || '쪽지 화면을 불러오지 못했습니다.').trim();
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        // [LOG_ID: 20260708_1030] 게스트 차단/오류 안내도 다른 화면과 동일한 정통 상단바를 갖춘다.
        // (기존엔 상단바 없는 .bbs-box만 표시되어 이 화면만 로고·시계가 사라진 것처럼 보였다.)
        renderRawHtmlScreenWithTopbar({
            leftLabel: 'MEMO',
            centerLabel: '쪽지함',
            bodyHtml: `<div class="ansi-line ansi-red">${esc(safeMessage)}</div>`,
            screenEl,
            isMobile
        });
        setHint(safeMessage);
        setPrompt('>>');
        // [LOG: 20260617_1005] Guest/direct memo status screens finish without applyCommandFooter.
        setReady?.(true);
        // [LOG_ID: 20260708_1215] applyCommandFooter를 거치지 않는 경로라 setLoading()이 켠
        // is-divider-pending을 여기서 직접 정리한다 — 안 하면 다음 화면까지 구분선이 고착된다.
        document.getElementById('terminal-footer')?.classList.remove('is-divider-pending');
        focusCommandInput();
    }

    function ensureMemoAccess() {
        if (!state.user?.isGuest) {
            return true;
        }

        // [LOG: 20260429_0021] Direct guest memo routes must fail closed before hitting auth-only APIs.
        state._memos = [];
        state._currentMemoId = null;
        state._memoTarget = '';
        renderMemoStatus('쪽지 기능은 로그인 후 이용하실 수 있습니다.');
        return false;
    }

    async function showMemoList(fromHistory = false) {
        state.screen = 'memo-list';
        clearMemoWriteFlow();
        state._memoDeleteConfirm = null;
        if (!ensureMemoAccess()) {
            return;
        }
        if (!state._memoBox) {
            state._memoBox = 'inbox';
        }
        if (!fromHistory) {
            updateURL();
        }
        setLoading('데이터를 송수신 중입니다..');

        try {
            const box = state._memoBox || 'inbox';
            const memos = await apiFetch(`/api/memos?box=${box}`);
            state._memos = memos || [];

            const ansiText = buildMemoListAnsi(state._memos, box);
            renderAnsiScreenWithTopbar({ ansiText, ansiToHTML, screenEl });

            await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
            focusCommandInput();
        } catch (e) {
            renderMemoStatus(`쪽지 목록을 불러오지 못했습니다. ${String(e?.message || '알 수 없는 오류입니다.')}`);
        }
    }

    async function showMemoView(memoId, fromHistory = false) {
        state.screen = 'memo-view';
        clearMemoWriteFlow();
        state._currentMemoId = memoId;
        if (!ensureMemoAccess()) {
            return;
        }
        if (!fromHistory) updateURL();
        setLoading('데이터를 송수신 중입니다..');

        try {
            const memo = await apiFetch(`/api/memos/${memoId}`);
            const hydratedMemo = { ...(memo || {}) };

            // [LOG: 20260429_0042] Direct /memo/:memoId restores need the fetched memo context
            // so memo-view commands keep working even when the list screen was never loaded first.
            // [LOG_ID: 20260713_1000] 내가 보낸 쪽지가 아닐 때만(남에게 받은 편지일 때만) 수신확인(읽음 처리) 처리
            if (hydratedMemo.senderUserId !== state.user?.userId && !hydratedMemo.isRead) {
                const markedMemo = await apiFetch(`/api/memos/${memoId}/read`, { method: 'POST' });
                Object.assign(hydratedMemo, markedMemo || {}, { isRead: true });
            }

            state._currentMemoId = hydratedMemo.id ?? memoId;
            const existingMemos = Array.isArray(state._memos) ? state._memos : [];
            const hydratedMemoId = String(state._currentMemoId || '');
            const existingMemoIndex = existingMemos.findIndex((entry) => String(entry?.id || '') === hydratedMemoId);

            if (existingMemoIndex >= 0) {
                state._memos[existingMemoIndex] = { ...existingMemos[existingMemoIndex], ...hydratedMemo };
            } else {
                state._memos = [hydratedMemo, ...existingMemos];
            }

            const ansiText = buildMemoViewAnsi(hydratedMemo, state.user?.userId);
            const rendered = renderAnsiScreenWithTopbar({ ansiText, ansiToHTML, screenEl });
            const deleteConfirm = state._memoDeleteConfirm;
            const deleteConfirmHtml = deleteConfirm && String(deleteConfirm.memoId || '') === String(state._currentMemoId || '')
                ? '<div class="ansi-line ansi-yellow">[안내] 이 쪽지를 삭제하시겠습니까? (y/n)</div>'
                : '';
            if (deleteConfirmHtml) {
                rendered.screenNode?.querySelector('.ansi-screen-body')?.insertAdjacentHTML('beforeend', deleteConfirmHtml);
            }

            await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
            if (deleteConfirmHtml) {
                setHint('삭제하려면 Y, 취소하려면 N을 입력하세요.');
                setPrompt('삭제 (y/n) >>');
            }
            focusCommandInput();
        } catch (e) {
            renderMemoStatus(`쪽지를 읽지 못했습니다. ${String(e?.message || '알 수 없는 오류입니다.')}`);
        }
    }

    function clearMemoWriteFlow() {
        if (state._terminalInputHandler === handleMemoRawInput) {
            state._terminalInputHandler = null;
        }
        state._memoWriteFlow = null;
    }

    function createMemoWriteFlow(targetUserId) {
        const target = String(targetUserId || '').trim();
        const transcript = [
            { prompt: '[안내]', value: '쪽지 보내기를 시작합니다.' }
        ];

        if (target) {
            transcript.push({ prompt: '받는 사람 >>', value: target });
            transcript.push({ prompt: '[안내]', value: '내용을 한 줄씩 입력하세요. /s 또는 SEND 전송, /q 취소' });
        } else {
            transcript.push({ prompt: '[안내]', value: '받는 사람 아이디를 입력하세요.' });
        }

        return {
            target,
            bodyLines: [],
            transcript,
            stage: target ? 'body' : 'target',
            sending: false
        };
    }

    function appendMemoWriteLine(prompt, value) {
        const flow = state._memoWriteFlow;
        if (!flow) {
            return;
        }
        flow.transcript.push({
            prompt: String(prompt || ''),
            value: String(value ?? '')
        });
    }

    function renderMemoWriteScreen() {
        const flow = state._memoWriteFlow;
        if (!flow) {
            return;
        }

        const transcriptHtml = flow.transcript
            .map((line) => {
                const prompt = String(line?.prompt || '');
                const value = String(line?.value ?? '');
                return `<div class="ansi-line"><span class="ansi-cyan">${esc(prompt)}</span>${value ? ` <span class="ansi-white">${esc(value)}</span>` : ''}</div>`;
            })
            .join('');

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        // [LOG_ID: 20260708_1030] 다른 화면과 동일한 정통 상단바로 렌더링한다.
        // (기존엔 "▣ 쪽지 보내기 ▣"라는 자체 제목 줄만 있고 로고 박스·실시간 시계가 없었다.)
        renderRawHtmlScreenWithTopbar({
            leftLabel: 'MEMO',
            centerLabel: '쪽지 보내기',
            bodyHtml: transcriptHtml,
            screenEl,
            isMobile
        });

        setHint('전송(/s 또는 SEND), 취소(/q, P, M, B)');
        setPrompt(flow.stage === 'target' ? '받는 사람 >>' : '내용 >>');
        setReady?.(true);
        focusCommandInput();
    }

    async function showMemoWrite(targetUserId = '') {
        state.screen = 'memo-write';
        state._memoTarget = String(targetUserId || '').trim();
        state._memoDeleteConfirm = null;
        if (!ensureMemoAccess()) {
            return;
        }
        updateURL(true);

        state._memoWriteFlow = createMemoWriteFlow(state._memoTarget);
        // [LOG: 20260509_1115] Memo write consumes raw terminal lines so body text is not treated as global commands.
        state._terminalInputHandler = handleMemoRawInput;
        renderMemoWriteScreen();
    }

    // [LOG_ID: 20260713_1040] Hitel 발송 옵션을 적용하는 서브밋 헬퍼 함수
    async function handleMemoSubmitWithOptions(choice) {
        if (!ensureMemoAccess()) {
            return false;
        }

        const flow = state._memoWriteFlow;
        const myId = state.user?.userId || 'guest';
        const targetUserId = choice === 2 
            ? myId 
            : String(flow?.target || state._memoTarget || '').trim();
            
        const content = Array.isArray(flow?.bodyLines) ? flow.bodyLines.join('\n').trim() : '';

        if (!targetUserId || !content) {
            appendMemoWriteLine('[안내]', '받는 사람과 내용을 모두 입력해 주세요.');
            renderMemoWriteScreen();
            return false;
        }

        try {
            if (flow) {
                flow.sending = true;
            }
            setHint('쪽지를 발송하는 중입니다..');
            const saveToSent = choice !== 1;

            await apiFetch('/api/memos', {
                method: 'POST',
                body: JSON.stringify({
                    recipientUserId: targetUserId,
                    title: `${content.substring(0, 20)}...`,
                    content,
                    saveToSent
                })
            });
            clearMemoWriteFlow();
            state._memoBox = choice === 2 ? 'inbox' : 'sent';
            await showMemoList();
            return true;
        } catch (e) {
            if (flow) {
                flow.sending = false;
                flow.stage = 'body';
            }
            appendMemoWriteLine('[안내]', `발송 실패: ${String(e?.message || '알 수 없는 오류입니다.')}`);
            renderMemoWriteScreen();
            return false;
        }
    }

    async function handleMemoSubmit() {
        return await handleMemoSubmitWithOptions(3);
    }

    async function cancelMemoWrite() {
        clearMemoWriteFlow();
        await showMemoList();
        return true;
    }

    // [LOG: 20260509_1115] Raw memo write prompt handler implements recipient and line-body PC통신 flow.
    async function handleMemoRawInput(raw) {
        if (state.screen !== 'memo-write' || !state._memoWriteFlow) {
            return false;
        }

        const flow = state._memoWriteFlow;
        if (flow.sending) {
            return true;
        }

        const line = String(raw ?? '');
        const trimmed = line.trim();
        const cmd = trimmed.toUpperCase();
        const isCancel = trimmed === '/q' || cmd === 'P' || cmd === 'M' || cmd === 'B';

        // [LOG_ID: 20260713_1040] Hitel 발송 옵션 가로채기
        if (flow.stage === 'send_cmd') {
            appendMemoWriteLine('발송 명령 >>', line);
            if (trimmed === '0') {
                renderMemoWriteScreen();
                return await cancelMemoWrite();
            }

            if (['1', '2', '3'].includes(trimmed)) {
                const choice = parseInt(trimmed, 10);
                await handleMemoSubmitWithOptions(choice);
                return true;
            }

            appendMemoWriteLine('[안내]', '잘못된 명령입니다. 1, 2, 3, 0 중 하나를 입력해 주세요.');
            setPrompt('발송 명령 (1-3, 0) >>');
            renderMemoWriteScreen();
            return true;
        }

        if (flow.stage === 'target') {
            if (isCancel) {
                appendMemoWriteLine('받는 사람 >>', line);
                renderMemoWriteScreen();
                return await cancelMemoWrite();
            }

            appendMemoWriteLine('받는 사람 >>', line);
            if (!trimmed) {
                appendMemoWriteLine('[안내]', '받는 사람 아이디를 입력하세요.');
                renderMemoWriteScreen();
                return true;
            }

            flow.target = trimmed;
            state._memoTarget = trimmed;
            flow.stage = 'body';
            appendMemoWriteLine('[안내]', '내용을 한 줄씩 입력하세요. /s 또는 SEND 전송, /q 취소');
            renderMemoWriteScreen();
            return true;
        }

        if (isCancel) {
            appendMemoWriteLine('내용 >>', line);
            renderMemoWriteScreen();
            return await cancelMemoWrite();
        }

        if (trimmed === '/s' || cmd === 'SEND') {
            appendMemoWriteLine('내용 >>', line);
            flow.stage = 'send_cmd';
            appendMemoWriteLine('[선택]', '명령(1:발송, 2:저장, 3:발송+저장, 0:취소)');
            setPrompt('발송 명령 (1-3, 0) >>');
            renderMemoWriteScreen();
            return true;
        }

        flow.bodyLines.push(line);
        appendMemoWriteLine('내용 >>', line);
        renderMemoWriteScreen();
        return true;
    }

    return {
        cancelMemoWrite,
        handleMemoRawInput,
        handleMemoSubmit,
        showMemoList,
        showMemoView,
        showMemoWrite
    };
}
