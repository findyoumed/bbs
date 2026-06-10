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
        state,
        updateURL
    } = deps;

    function shouldAutoFocusCommandInput() {
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }

    function focusCommandInput() {
        if (shouldAutoFocusCommandInput()) {
            cmdInput.focus();
        }
    }

    function renderMemoStatus(message) {
        clearMemoWriteFlow();
        const safeMessage = String(message || '쪽지 화면을 불러오지 못했습니다.').trim();
        screenEl.innerHTML = `<div class="bbs-box"><div class="bbs-error">${esc(safeMessage)}</div></div>`;
        setHint(safeMessage);
        setPrompt('>>');
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
        if (!fromHistory) {
            updateURL();
        }
        setLoading('데이터를 송수신 중입니다..');

        try {
            const memos = await apiFetch('/api/memos');
            state._memos = memos || [];

            const ansiText = buildMemoListAnsi(state._memos);
            const rendered = ansiToHTML(ansiText);
            screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}</div>`;

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
            if (!hydratedMemo.isRead) {
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

            const ansiText = buildMemoViewAnsi(hydratedMemo);
            const rendered = ansiToHTML(ansiText);
            const deleteConfirm = state._memoDeleteConfirm;
            const deleteConfirmHtml = deleteConfirm && String(deleteConfirm.memoId || '') === String(state._currentMemoId || '')
                ? '<div class="ansi-line ansi-yellow">[안내] 이 쪽지를 삭제하시겠습니까? (y/n)</div>'
                : '';
            screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}${deleteConfirmHtml}</div>`;

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

        screenEl.innerHTML = `
      <div class="ansi-screen memo-write-screen">
        <div class="ansi-line ansi-yellow">▣ 쪽지 보내기 ▣</div>
        ${transcriptHtml}
      </div>`;

        setHint('전송(/s 또는 SEND), 취소(/q, P, M, B)');
        setPrompt(flow.stage === 'target' ? '받는 사람 >>' : '내용 >>');
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

    async function handleMemoSubmit() {
        if (!ensureMemoAccess()) {
            return false;
        }

        const flow = state._memoWriteFlow;
        const targetUserId = String(flow?.target || state._memoTarget || '').trim();
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
            await apiFetch('/api/memos', {
                method: 'POST',
                body: JSON.stringify({
                    recipientUserId: targetUserId,
                    title: `${content.substring(0, 20)}...`,
                    content
                })
            });
            clearMemoWriteFlow();
            await showMemoList();
            return true;
        } catch (e) {
            if (flow) {
                flow.sending = false;
            }
            appendMemoWriteLine('[안내]', `발송 실패: ${String(e?.message || '알 수 없는 오류입니다.')}`);
            renderMemoWriteScreen();
            return false;
        }
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
            renderMemoWriteScreen();
            await handleMemoSubmit();
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
