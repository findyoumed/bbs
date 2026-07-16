import { listGroups, setGroup, deleteGroup } from './memoGroups.js';

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
            // [LOG_ID: 20260719_1200] 하이텔 (10)-3 축하카드/그림엽서(vmail) 쓰기 — 카드 선택부터 시작.
            if (cmd === 'WC') {
                await showMemoWrite('', true);
                return true;
            }
            // [LOG_ID: 20260719_1400] 하이텔 (10)-6 단체편지 그룹지정·천리안 주소록(ADDRESS).
            // GRP(목록) / GRP+ 이름 id,id,...(저장) / GRP- 이름(삭제). 그룹명·id는 원본 대소문자를
            // 보존해야 하므로 정규화된 cmd가 아니라 input(원문)으로 파싱한다.
            const grpMatch = String(input || '').trim().match(/^GRP\s*([+-])?\s*(.*)$/i);
            if (grpMatch) {
                const op = grpMatch[1];
                const rest = grpMatch[2].trim();
                if (op === '+') {
                    const sp = rest.indexOf(' ');
                    const name = sp === -1 ? '' : rest.slice(0, sp).trim();
                    const members = sp === -1 ? '' : rest.slice(sp + 1).trim();
                    const saved = name && members ? setGroup(name, members) : null;
                    setHint(saved
                        ? `그룹 '${name}' 저장됨 (${saved.length}명: ${saved.join(', ')}). 쓰기에서 받는사람에 @${name} 로 씁니다.`
                        : '사용법: GRP+ 그룹명 아이디1,아이디2,...');
                    return true;
                }
                if (op === '-') {
                    setHint(rest && deleteGroup(rest)
                        ? `그룹 '${rest}' 삭제됨.`
                        : (rest ? `그룹 '${rest}'을(를) 찾을 수 없습니다.` : '사용법: GRP- 그룹명'));
                    return true;
                }
                const groups = listGroups();
                const names = Object.keys(groups);
                setHint(names.length
                    ? `저장된 그룹: ${names.map((n) => `@${n}(${groups[n].split(',').length})`).join(', ')} · GRP+ 이름 id,id 저장 / GRP- 이름 삭제`
                    : '저장된 그룹이 없습니다. GRP+ 가족 hong,kim,lee 처럼 만드세요.');
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
            // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — MB로 보관함을 열고,
            // K {번호}로 보관/보관해제한다(보관함 안에서는 해제로 동작).
            if (cmd === 'MB') {
                state._memoBox = 'archive';
                await showMemoList();
                return true;
            }
            const archiveMatch = cmd.match(/^K(?:\s+(\d+))?$/);
            if (archiveMatch) {
                const isArchiveBox = state._memoBox === 'archive';
                if (!archiveMatch[1]) {
                    setHint?.(isArchiveBox
                        ? '사용법: K {번호} — 보관을 해제해 원래 쪽지함으로 되돌립니다.'
                        : '사용법: K {번호} — 쪽지를 편지보관함으로 옮깁니다.');
                    return true;
                }
                const kIdx = parseInt(archiveMatch[1], 10);
                const target = state._memos?.[kIdx - 1];
                if (!target) {
                    setHint?.(`${kIdx}번 쪽지를 찾을 수 없습니다.`);
                    return true;
                }
                try {
                    await apiFetch(`/api/memos/${target.id}/archive`, {
                        method: 'POST',
                        body: JSON.stringify({ archived: !isArchiveBox })
                    });
                    await showMemoList();
                    setHint?.(isArchiveBox
                        ? `${kIdx}번 쪽지의 보관을 해제했습니다.`
                        : `${kIdx}번 쪽지를 편지보관함으로 옮겼습니다. (MB: 보관함)`);
                } catch (error) {
                    setHint?.(`보관 처리 실패: ${error.message}`);
                }
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
            // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함 — 읽는 중에 K로 보관/해제 토글.
            if (cmd === 'K') {
                const memo = state._memos?.find((m) => String(m?.id) === String(state._currentMemoId));
                if (!memo) {
                    setHint?.('보관할 쪽지를 찾지 못했습니다.');
                    return true;
                }
                const myId = state.user?.userId || '';
                const archived = memo.recipientUserId === myId
                    ? Boolean(memo.recipientArchived)
                    : Boolean(memo.senderArchived);
                try {
                    await apiFetch(`/api/memos/${memo.id}/archive`, {
                        method: 'POST',
                        body: JSON.stringify({ archived: !archived })
                    });
                    // 보관하면 원래 쪽지함에서 빠지므로 목록으로 돌아간다.
                    await showMemoList();
                    setHint?.(archived
                        ? '보관을 해제했습니다.'
                        : '편지보관함으로 옮겼습니다. (MB: 보관함)');
                } catch (error) {
                    setHint?.(`보관 처리 실패: ${error.message}`);
                }
                return true;
            }
            if (cmd === 'DD' || cmd === 'D') {
                return await beginMemoDeleteConfirm();
            }
            return false;
        }

        if (state.screen === 'memo-write') {
            // [LOG_ID: 20260714_2000] 클릭으로 들어온 내비게이션 명령(상단바 로고='T' 등)까지
            // handleMemoRawInput이 무조건 가로채 편지 본문 한 줄로 취급하던 버그 — 사용자 보고:
            // "/memo/write에서 로고를 클릭하면 화면에 T라고 나온다". 다른 원시 텍스트 입력 화면
            // (대화방/내정보 편집)과 동일하게 클릭 출처는 raw input보다 먼저 명령으로 처리한다.
            const isClickSource = context?.source === 'click';
            if (!isClickSource && typeof handleMemoRawInput === 'function') {
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
            if (typeof handleMemoRawInput === 'function') {
                return await handleMemoRawInput(input);
            }
            return false;
        }

        return false;
    };
}
