export function createMemoCommandHandler(deps) {
    const {
        apiFetch,
        showMain,
        showMemoList,
        showMemoView,
        showMemoWrite,
        handleMemoRawInput,
        handleMemoSubmit,
        setHint,
        setPrompt,
        state
    } = deps;

    function getCurrentMemoId() {
        return state._currentMemoId;
    }

    async function beginMemoDeleteConfirm() {
        const memoId = getCurrentMemoId();
        if (!memoId) {
            setHint?.('삭제할 쪽지를 찾지 못했습니다.');
            setPrompt?.('>>');
            return true;
        }

        // [LOG: 20260509_1115] Memo delete uses a terminal prompt state instead of browser confirm/alert.
        state._memoDeleteConfirm = { memoId };
        await showMemoView(memoId, true);
        setHint?.('삭제하려면 Y, 취소하려면 N을 입력하세요.');
        setPrompt?.('삭제 (y/n) >>');
        return true;
    }

    async function handleMemoDeleteConfirm(input) {
        const pending = state._memoDeleteConfirm;
        if (!pending) {
            return false;
        }

        const answer = String(input || '').trim().toUpperCase();
        if (answer === 'Y' || answer === 'YES') {
            setHint?.('쪽지를 삭제하는 중입니다...');
            await apiFetch(`/api/memos/${pending.memoId}`, { method: 'DELETE' });
            state._memoDeleteConfirm = null;
            await showMemoList();
            return true;
        }

        if (!answer || answer === 'N' || answer === 'NO' || answer === 'P' || answer === 'M' || answer === 'B') {
            const memoId = pending.memoId;
            state._memoDeleteConfirm = null;
            await showMemoView(memoId, true);
            setHint?.('삭제를 취소했습니다.');
            setPrompt?.('>>');
            return true;
        }

        await showMemoView(pending.memoId, true);
        setHint?.('Y 또는 N을 입력해 주세요.');
        setPrompt?.('삭제 (y/n) >>');
        return true;
    }

    return async function handleMemoCommand({ input, rawCmd, cmd, context }) {
        if (state.screen === 'memo-list') {
            if (cmd === 'T') {
                await showMain();
                return true;
            }
            if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
                await showMain();
                return true;
            }
            if (cmd === 'W') {
                await showMemoWrite();
                return true;
            }
            const idx = parseInt(cmd, 10);
            if (idx >= 1 && state._memos?.[idx - 1]) {
                await showMemoView(state._memos[idx - 1].id);
                return true;
            }
            return false;
        }

        if (state.screen === 'memo-view') {
            if (state._memoDeleteConfirm) {
                return await handleMemoDeleteConfirm(input || cmd);
            }
            if (cmd === 'L') {
                await showMemoList();
                return true;
            }
            if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
                await showMemoList();
                return true;
            }
            if (cmd === 'T') {
                await showMain();
                return true;
            }
            if (cmd === 'RE') {
                const memo = state._memos?.find((m) => String(m?.id) === String(state._currentMemoId));
                if (memo) await showMemoWrite(memo.senderUserId);
                return true;
            }
            if (cmd === 'DD' || cmd === 'D') {
                return await beginMemoDeleteConfirm();
            }
            return false;
        }

        if (state.screen === 'memo-write') {
            if (typeof handleMemoRawInput === 'function') {
                return await handleMemoRawInput(input);
            }
            if (cmd === 'SEND') {
                await handleMemoSubmit();
                return true;
            }
            if (cmd === 'T') {
                await showMain();
                return true;
            }
            if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
                await showMemoList();
                return true;
            }
            return false;
        }

        return false;
    };
}
