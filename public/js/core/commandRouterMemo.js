import { listGroups, setGroup, deleteGroup } from './memoGroups.js';

export function createMemoCommandHandler(deps) {
    const {
        apiFetch,
        showMain,
        showMemoList,
        showMemoView,
        showMemoViewPage,
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
        setPrompt?.('삭제 (Y/n) >>');
        return true;
    }

    // [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) — 하이텔 책(그림 7.12)·천리안 책(NOMAN,
    // p.165) 둘 다 "부재 시작일 → 부재 종료일 → 부재 사유" 3단계 등록 흐름이었다. 날짜는
    // 이 사이트의 다른 생년월일 입력(바이오리듬 등)과 동일한 8자리(YYYYMMDD) 표기로 통일한다.
    function parseAbsentDate(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        if (digits.length !== 8) return null;
        const year = Number(digits.slice(0, 4));
        const month = Number(digits.slice(4, 6));
        const day = Number(digits.slice(6, 8));
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        return date;
    }

    async function beginAbsentFlow() {
        setHint?.('부재통지 상태를 확인하는 중입니다..');
        try {
            const current = await apiFetch('/api/members/absent');
            if (current?.absentReason) {
                state._absentStage = 'confirm-clear';
                const until = current.absentEnd
                    ? new Date(current.absentEnd).toLocaleDateString('ko-KR')
                    : '수동 해제 전까지';
                setHint?.(`이미 부재중입니다: "${current.absentReason}" (복귀예정: ${until}). 해제하시겠습니까?`);
                setPrompt?.('부재통지 해제 (Y/n) >>');
            } else {
                state._absentStage = 'start';
                state._absentDraft = {};
                setHint?.('부재 시작일을 입력하십시오. (예: 20260725, 빈 엔터=즉시 시작, 취소: /Q)');
                setPrompt?.('부재 시작일 >>');
            }
        } catch (err) {
            setHint?.(`부재통지 상태 조회 실패: ${err.message}`);
            setPrompt?.('선택 >>');
        }
        return true;
    }

    async function handleAbsentFlowInput(input) {
        const raw = String(input || '').trim();
        const stage = state._absentStage;

        if (stage === 'confirm-clear') {
            const answer = raw.toUpperCase();
            state._absentStage = null;
            if (answer === 'Y' || answer === 'YES') {
                setHint?.('부재통지를 해제하는 중입니다..');
                try {
                    await apiFetch('/api/members/absent', { method: 'POST', body: JSON.stringify({ reason: '' }) });
                    setHint?.('부재통지가 해제되었습니다.');
                } catch (err) {
                    setHint?.(`부재통지 해제 실패: ${err.message}`);
                }
            } else {
                setHint?.('부재통지를 유지합니다.');
            }
            setPrompt?.('선택 >>');
            await showMemoList();
            return true;
        }

        if (raw === '/q' || raw.toUpperCase() === 'Q') {
            state._absentStage = null;
            state._absentDraft = null;
            setHint?.('부재통지 설정을 취소했습니다.');
            setPrompt?.('선택 >>');
            return true;
        }

        if (stage === 'start') {
            const startDate = raw ? parseAbsentDate(raw) : new Date();
            if (!startDate) {
                setHint?.('날짜 형식이 올바르지 않습니다. 예: 20260725');
                setPrompt?.('부재 시작일 >>');
                return true;
            }
            state._absentDraft = { start: startDate.toISOString() };
            state._absentStage = 'end';
            setHint?.('부재 종료일을 입력하십시오. (예: 20260801, 빈 엔터=수동 해제 전까지)');
            setPrompt?.('부재 종료일 >>');
            return true;
        }

        if (stage === 'end') {
            let endDate = null;
            if (raw) {
                endDate = parseAbsentDate(raw);
                if (!endDate) {
                    setHint?.('날짜 형식이 올바르지 않습니다. 예: 20260801');
                    setPrompt?.('부재 종료일 >>');
                    return true;
                }
            }
            state._absentDraft.end = endDate ? endDate.toISOString() : null;
            state._absentStage = 'reason';
            setHint?.('부재 사유를 입력하십시오. (한글 20자 이내)');
            setPrompt?.('부재 사유 >>');
            return true;
        }

        if (stage === 'reason') {
            const reason = raw.slice(0, 20);
            if (!reason) {
                setHint?.('부재 사유를 입력해 주세요.');
                setPrompt?.('부재 사유 >>');
                return true;
            }
            setHint?.('부재통지를 등록하는 중입니다..');
            try {
                await apiFetch('/api/members/absent', {
                    method: 'POST',
                    body: JSON.stringify({ start: state._absentDraft.start, end: state._absentDraft.end, reason })
                });
                setHint?.(`부재통지가 등록되었습니다: "${reason}"`);
            } catch (err) {
                setHint?.(`부재통지 등록 실패: ${err.message}`);
            }
            state._absentStage = null;
            state._absentDraft = null;
            setPrompt?.('선택 >>');
            await showMemoList();
            return true;
        }

        return false;
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
            // [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) 단계별 입력 가로채기 — 하이텔·천리안
            // 두 책 모두 확인된 "시작일 → 종료일 → 사유" 3단계 흐름(beginAbsentFlow/handleAbsentFlowInput).
            if (state._absentStage) {
                return await handleAbsentFlowInput(input);
            }

            // [LOG_ID: 20260722_3700] 나우누리 책("PC통신에서 인터넷까지" p.114) 실측: "DD 3-9"
            // (범위) / "DD 1,3,4,6,7,8"(나열) 명령으로 목록에서 편지를 한번에 여러 통 지울 수
            // 있다고 명시하고, 바로 옆에서 "한 번 삭제한 편지는 되살릴 수 없으므로... 정말 지울
            // 것인지 한 번 더 생각해보고 지우도록 합시다"라고 경고한다 — 그래서 기존 단건 삭제
            // (beginMemoDeleteConfirm)와 동일하게 Y/N 확인 단계를 둔다.
            if (state._memoBulkDeleteConfirm) {
                const answer = String(input || '').trim().toUpperCase();
                if (answer === 'Y' || answer === 'YES') {
                    const ids = state._memoBulkDeleteConfirm.ids;
                    state._memoBulkDeleteConfirm = null;
                    setHint?.('쪽지를 삭제하는 중입니다..');
                    for (const id of ids) {
                        try {
                            await apiFetch(`/api/memos/${id}`, { method: 'DELETE' });
                        } catch (error) {
                            // 개별 실패는 건너뛰고 나머지를 계속 지운다.
                        }
                    }
                    await showMemoList();
                    setHint?.(`${ids.length}통의 쪽지를 삭제했습니다.`);
                } else {
                    state._memoBulkDeleteConfirm = null;
                    await showMemoList();
                    setHint?.('삭제를 취소했습니다.');
                }
                setPrompt?.('선택 >>');
                return true;
            }

            const ddMatch = cmd.match(/^DD(?:\s+([\d,\s-]+))?$/);
            if (ddMatch) {
                const spec = String(ddMatch[1] || '').trim();
                if (!spec) {
                    setHint?.('사용법: DD {번호} — 쪽지 삭제. 여러 통은 DD 3,5 또는 범위 DD 1-4');
                    return true;
                }

                let targets = [];
                const rangeMatch = spec.match(/^(\d+)\s*-\s*(\d+)$/);
                if (rangeMatch) {
                    const low = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
                    const high = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
                    for (let i = low; i <= high; i += 1) {
                        const memo = state._memos?.[i - 1];
                        if (memo) targets.push(memo);
                    }
                } else if (spec.includes(',')) {
                    const tokens = spec.split(',').map((token) => token.trim()).filter(Boolean);
                    targets = tokens
                        .map((token) => state._memos?.[parseInt(token, 10) - 1])
                        .filter(Boolean);
                } else {
                    const memo = state._memos?.[parseInt(spec, 10) - 1];
                    if (memo) targets = [memo];
                }

                if (!targets.length) {
                    setHint?.('존재하지 않는 번호입니다.');
                    return true;
                }

                state._memoBulkDeleteConfirm = { ids: targets.map((memo) => memo.id) };
                setHint?.(`${targets.length}통의 쪽지를 삭제하시겠습니까? 한 번 삭제하면 되살릴 수 없습니다.`);
                setPrompt?.('삭제 (y/n) >>');
                return true;
            }

            if (cmd === 'ABSENT' || cmd === '부재') {
                return await beginAbsentFlow();
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
            // [LOG_ID: 20260801_1010] 쪽지 보관 명령어 단축키를 K에서 KEEP으로 변경
            const archiveMatch = cmd.match(/^KEEP(?:\s+(\d+))?$/);
            if (archiveMatch) {
                const isArchiveBox = state._memoBox === 'archive';
                if (!archiveMatch[1]) {
                    setHint?.(isArchiveBox
                        ? '사용법: KEEP {번호} — 보관을 해제해 원래 쪽지함으로 되돌립니다.'
                        : '사용법: KEEP {번호} — 쪽지를 편지보관함으로 옮깁니다.');
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
            // [LOG_ID: 20260726_0010] 본문 페이징 추가(buildMemoViewAnsi) — F는 이미 "쪽지 전달"에
            // 쓰이고 있어 다른 페이징 화면과 달리 F를 다음쪽에 못 쓴다. 빈 엔터만 다음쪽으로,
            // B는 게시글 보기와 동일하게 이전쪽(1쪽에서는 기존처럼 목록)으로 처리한다.
            const memoPageNo = Number(state.memoViewPageNo || 1);
            const memoPageCount = Number(state.memoViewPageCount || 1);
            if (cmd === '' && memoPageNo < memoPageCount) {
                await showMemoViewPage(memoPageNo + 1);
                return true;
            }
            if (cmd === 'B' && memoPageNo > 1) {
                await showMemoViewPage(memoPageNo - 1);
                return true;
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
            // [LOG_ID: 20260801_1010] 단축키 K를 KEEP으로 변경
            if (cmd === 'KEEP') {
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
            // [LOG_ID: 20260722_3500] 하이텔 책(길라잡이 p.109) "이동 명령어 'A'(화면에서 위에 있는
            // 편지, 나중에 도착한 편지)나 'N'(아래에 있는 편지, 전에 도착한 편지)를 통해 다음 편지나
            // 전 편지를 읽을 수도 있다" — 목록으로 돌아가지 않고 편지 사이를 바로 이동하는 기능이
            // 아예 없었다. state._memos는 최신순(내림차순)이므로 A는 배열 앞쪽(더 최근), N은 뒤쪽
            // (더 오래됨)으로 이동한다(게시판 글보기 A/N 방향 수정과 동일한 규칙).
            if (cmd === 'A' || cmd === 'N') {
                const memos = Array.isArray(state._memos) ? state._memos : [];
                const idx = memos.findIndex((m) => String(m?.id) === String(state._currentMemoId));
                const targetIdx = idx >= 0 ? (cmd === 'A' ? idx - 1 : idx + 1) : -1;
                const target = targetIdx >= 0 ? memos[targetIdx] : null;
                if (target) {
                    await showMemoView(target.id);
                } else {
                    setHint?.(cmd === 'A' ? '더 최근에 받은 편지가 없습니다.' : '더 이전에 받은 편지가 없습니다.');
                }
                return true;
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
                // [LOG_ID: 20260731_1150] handleMemoRawInput은 화면이 'memo-write'가 아니거나
                // state._memoWriteFlow가 없으면(예: 게스트 차단으로 ensureMemoAccess가 실패해
                // createMemoWriteFlow가 아예 호출되지 않은 경우) false를 반환한다 — 그런데 종전엔
                // 그 false를 그대로 handleMemoCommand의 반환값으로 삼아 여기서 즉시 return해
                // 버려서, 아래 SEND/T/P/M/B 분기가 전혀 실행되지 않았다(실측 재현: GO WMAIL로
                // 게스트가 편지쓰기에 진입 → "쪽지 기능은 로그인 후..." 안내 + "T를 입력하면
                // 초기화면으로 이동합니다" 힌트가 뜨지만 실제로 T를 쳐도 무반응). false일 때만
                // 아래로 폴스루한다 — _memoWriteFlow가 있을 때는 이 함수가 절대 false를 반환하지
                // 않으므로(가드 실패 케이스가 유일한 false 경로) 정상 편지쓰기 흐름은 그대로다.
                const handled = await handleMemoRawInput(input);
                if (handled !== false) {
                    return handled;
                }
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
