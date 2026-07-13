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
            setHint?.('쪽지를 삭제하는 중입니다..');
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
            // [LOG_ID: 20260713_1050] 부재 메시지 설정 입력 가로채기
            if (state._absentStage === 'setting') {
                const msg = String(input || '').trim();
                setHint?.('부재 등록을 처리 중입니다..');
                apiFetch('/api/members/absent', {
                    method: 'POST',
                    body: JSON.stringify({ absentMsg: msg })
                })
                .then(() => {
                    if (msg) {
                        setHint?.(`부재 등록되었습니다: "${msg}"`);
                    } else {
                        setHint?.('부재 등록이 해제되었습니다.');
                    }
                    setPrompt?.('선택 >>');
                    state._absentStage = null;
                    showMemoList();
                })
                .catch((err) => {
                    setHint?.(`부재 등록 실패: ${err.message}`);
                    setPrompt?.('선택 >>');
                    state._absentStage = null;
                    showMemoList();
                });
                return true;
            }

            if (cmd === 'ABSENT' || cmd === '부재') {
                state._absentStage = 'setting';
                setHint?.('부재 중 메시지를 입력하십시오. (최대 50자, 해제는 빈 엔터)');
                setPrompt?.('부재 메시지 >>');
                return true;
            }

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
            // [LOG_ID: 20260713_1000] 보낸쪽지함/받는쪽지함 토글 처리
            if (cmd === 'S') {
                state._memoBox = 'sent';
                await showMemoList();
                return true;
            }
            if (cmd === 'I') {
                state._memoBox = 'inbox';
                await showMemoList();
                return true;
            }
            // [LOG_ID: 20260713_1230] 나우누리 CMAIL '배달 확인/취소' — 보낸쪽지함에서
            // CM [번호]로 상대가 아직 읽지 않은 편지의 발송을 취소(삭제)한다. (원전 p.NOW_MENU CMAIL)
            const cmMatch = cmd.match(/^CM(?:\s+(\d+))?$/);
            if (cmMatch) {
                if (state._memoBox !== 'sent') {
                    setHint?.('발송 취소(CM)는 보낸쪽지함에서만 사용할 수 있습니다. (S: 보낸쪽지함)');
                    return true;
                }
                if (!cmMatch[1]) {
                    setHint?.('사용법: CM {번호} — 않읽음 상태인 보낸 쪽지의 발송을 취소합니다.');
                    return true;
                }
                const cmIdx = parseInt(cmMatch[1], 10);
                const target = state._memos?.[cmIdx - 1];
                if (!target) {
                    setHint?.(`${cmIdx}번 쪽지를 찾을 수 없습니다.`);
                    return true;
                }
                if (target.isRead) {
                    setHint?.('이미 수신확인된 쪽지는 발송을 취소할 수 없습니다.');
                    return true;
                }
                try {
                    await apiFetch(`/api/memos/${target.id}`, { method: 'DELETE' });
                    await showMemoList();
                    setHint?.(`${cmIdx}번 쪽지의 발송을 취소했습니다. (수신자: ${target.recipientUserId || '?'})`);
                } catch (error) {
                    setHint?.(`발송 취소 실패: ${error.message}`);
                }
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
            // [LOG_ID: 20260713_1100] 쪽지 전달(FW / F) 기능 추가
            if (cmd === 'FW' || cmd === 'F') {
                const memo = state._memos?.find((m) => String(m?.id) === String(state._currentMemoId));
                if (memo) {
                    state._forwardMemoContent = `---------- 전달된 쪽지 ----------\n보낸이: ${memo.senderUserId}\n날짜: ${new Date(memo.createdAt).toLocaleString()}\n\n${memo.content}`;
                    await showMemoWrite();
                }
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
