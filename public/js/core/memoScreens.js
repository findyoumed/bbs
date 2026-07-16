import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbarSequential, renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
// [LOG_ID: 20260719_1200] 하이텔 (10)-3 축하카드(vmail)·천리안 그림엽서 — 카드 아트.
import { MEMO_CARDS, MEMO_CARD_KEYS } from './memoCardAssets.js';
// [LOG_ID: 20260719_1400] 하이텔 (10)-6 단체편지 그룹·천리안 주소록 — @그룹명 → 멤버 펼침.
import { expandRecipients } from './memoGroups.js';

// [LOG_ID: 20260713_1620] 하이텔 원전(길라잡이 p.105) 편지 종류 8종 — 비밀/답장요망/지연
// 3개 속성의 조합. 서버 스키마 변경 없이 제목 앞 대괄호 태그로 인코딩한다.
const LETTER_TYPES = {
  1: { label: '일반편지', secret: false, replyRequired: false, delayed: false },
  2: { label: '비밀편지', secret: true, replyRequired: false, delayed: false },
  3: { label: '답장요망', secret: false, replyRequired: true, delayed: false },
  4: { label: '지연편지', secret: false, replyRequired: false, delayed: true },
  5: { label: '비밀+답장요망', secret: true, replyRequired: true, delayed: false },
  6: { label: '비밀+지연', secret: true, replyRequired: false, delayed: true },
  7: { label: '답장요망+지연', secret: false, replyRequired: true, delayed: true },
  8: { label: '비밀+답장요망+지연', secret: true, replyRequired: true, delayed: true }
};

function buildMemoTitleTag(letterType, delayMinutes) {
  const meta = LETTER_TYPES[letterType];
  if (!meta || letterType === 1) {
    return '';
  }
  const parts = [];
  if (meta.secret) parts.push('비밀');
  if (meta.replyRequired) parts.push('답장요망');
  if (meta.delayed) parts.push(`지연:${Math.max(1, Number(delayMinutes) || 0)}분`);
  return parts.length ? `[${parts.join('·')}] ` : '';
}

// [LOG_ID: 20260713_1620] 지연편지 태그를 파싱해 아직 지연 시간이 지나지 않은 항목인지 판정.
// 받은쪽지함에서만 숨기고(원전: 지정 시각까지 수신 보류), 보낸쪽지함/발신자 본인 시야는 항상 노출한다.
function isDelayedMemoPending(memo) {
  const match = String(memo?.title || '').match(/지연:(\d+)분/);
  if (!match) {
    return false;
  }
  const delayMs = Number(match[1]) * 60 * 1000;
  const createdMs = Date.parse(memo?.createdAt || '');
  if (Number.isNaN(createdMs)) {
    return false;
  }
  return (Date.now() - createdMs) < delayMs;
}

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
        renderScreenSequential,
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
            // [LOG_ID: 20260713_1620] 받은쪽지함에서만 지연편지의 지연 시간이 지나지 않은 항목을 숨긴다.
            state._memos = box === 'inbox' ? (memos || []).filter((m) => !isDelayedMemoPending(m)) : (memos || []);

            // [LOG_ID: 20260716_1800] 보관함(archive)은 받은/보낸 쪽지가 섞여 있어 "상대방"을
            // 쪽지마다 판단해야 하므로 내 아이디를 함께 넘긴다.
            const ansiText = buildMemoListAnsi(state._memos, box, state.user?.userId || '');
            await renderAnsiScreenWithTopbarSequential({
                ansiText,
                ansiToHTML,
                screenEl,
                renderScreenSequential,
                afterBodyRender: async () => {
                    await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
                }
            });
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
            const deleteConfirm = state._memoDeleteConfirm;
            const deleteConfirmHtml = deleteConfirm && String(deleteConfirm.memoId || '') === String(state._currentMemoId || '')
                ? '<div class="ansi-line ansi-yellow">[안내] 이 쪽지를 삭제하시겠습니까? (y/n)</div>'
                : '';
            await renderAnsiScreenWithTopbarSequential({
                ansiText,
                ansiToHTML,
                screenEl,
                renderScreenSequential,
                afterBodyRender: async () => {
                    if (deleteConfirmHtml) {
                        screenEl?.querySelector('.ansi-screen-body')?.insertAdjacentHTML('beforeend', deleteConfirmHtml);
                    }
                    await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
                    if (deleteConfirmHtml) {
                        setHint('삭제하려면 Y, 취소하려면 N을 입력하세요.');
                        setPrompt('삭제 (y/n) >>');
                    }
                }
            });
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

    function createMemoWriteFlow(targetUserId, cardMode = false) {
        const target = String(targetUserId || '').trim();
        const transcript = [
            { prompt: '[안내]', value: cardMode ? '축하카드 보내기를 시작합니다.' : '쪽지 보내기를 시작합니다.' }
        ];

        // [LOG_ID: 20260719_1200] 축하카드(vmail) 모드: 카드 디자인 선택부터 시작한다.
        if (cardMode) {
            transcript.push({ prompt: '[카드 선택]', value: '' });
            MEMO_CARD_KEYS.forEach((key, i) => {
                transcript.push({ prompt: `  ${i + 1}.`, value: MEMO_CARDS[key].label });
            });
            return {
                target,
                bodyLines: [],
                transcript,
                stage: 'card_select',
                cardMode: true,
                cardKey: '',
                sending: false
            };
        }

        if (target) {
            transcript.push({ prompt: '받는 사람 >>', value: target });
            transcript.push({ prompt: '[안내]', value: '내용을 한 줄씩 입력하세요. /s 또는 SEND 전송, /q 취소' });
        } else {
            // [LOG_ID: 20260716_2000] 하이텔 (10)-6 단체편지 — 쉼표로 여러 명에게 한 번에 보낸다.
            transcript.push({ prompt: '[안내]', value: '받는 사람 아이디를 입력하세요. (여러 명은 쉼표로: hong,kim,lee)' });
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

        // [LOG_ID: 20260719_1200] 축하카드 선택 단계 프롬프트 추가.
        if (flow.stage === 'card_select') {
            setHint(`보낼 축하카드 번호를 고르세요. (1-${MEMO_CARD_KEYS.length}, 취소: /q)`);
            setPrompt(`카드 번호 (1-${MEMO_CARD_KEYS.length}) >>`);
        } else {
            setHint('전송(/s 또는 SEND), 취소(/q, P, M, B)');
            setPrompt(flow.stage === 'target' ? '받는 사람 >>' : '내용 >>');
        }
        setReady?.(true);
        focusCommandInput();
    }

    async function showMemoWrite(targetUserId = '', cardMode = false) {
        state.screen = 'memo-write';
        state._memoTarget = String(targetUserId || '').trim();
        state._memoDeleteConfirm = null;
        if (!ensureMemoAccess()) {
            return;
        }
        updateURL(true);

        state._memoWriteFlow = createMemoWriteFlow(state._memoTarget, cardMode);

        // [LOG_ID: 20260713_1100] 전달받은 원본 내용이 있을 경우 본문에 미리 채워넣고 복제
        if (state._forwardMemoContent) {
            state._memoWriteFlow.bodyLines = state._forwardMemoContent.split('\n');
            state._forwardMemoContent = null;
            state._memoWriteFlow.stage = 'target';
        }

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
            
        const bodyText = Array.isArray(flow?.bodyLines) ? flow.bodyLines.join('\n').trim() : '';

        if (!targetUserId || !bodyText) {
            appendMemoWriteLine('[안내]', '받는 사람과 내용을 모두 입력해 주세요.');
            renderMemoWriteScreen();
            return false;
        }

        try {
            if (flow) {
                flow.sending = true;
            }
            setHint(flow?.cardKey ? '축하카드를 발송하는 중입니다..' : '쪽지를 발송하는 중입니다..');
            const saveToSent = choice !== 1;
            // [LOG_ID: 20260713_1620] 편지 종류 태그(예: [비밀·답장요망]) 제목 앞에 부착
            const typeTag = buildMemoTitleTag(flow?.letterType, flow?.delayMinutes);

            // [LOG_ID: 20260719_1200] 축하카드는 content 맨 앞에 [CARD:key] 마커로 저장한다(스키마 변경
            // 없음). 쪽지 보기(buildMemoViewAnsi)가 이 마커를 감지해 카드 아트를 렌더하고 마커는 지운다.
            const content = flow?.cardKey ? `[CARD:${flow.cardKey}]\n${bodyText}` : bodyText;
            const titlePrefix = flow?.cardKey ? `[축하카드] ${MEMO_CARDS[flow.cardKey].label} ` : typeTag;

            const res = await apiFetch('/api/memos', {
                method: 'POST',
                body: JSON.stringify({
                    recipientUserId: targetUserId,
                    title: `${titlePrefix}${bodyText.substring(0, 20)}...`,
                    content,
                    saveToSent
                })
            });
            clearMemoWriteFlow();
            state._memoBox = choice === 2 ? 'inbox' : 'sent';

            // [LOG_ID: 20260713_1050] 수신자 부재 알림 힌트 노출
            // [LOG_ID: 20260716_2000] 하이텔 (10)-6 단체편지 — 여러 명에게 보냈으면 발송 건수를,
            // 부재자가 여럿이면 그 명단을 함께 알린다.
            const sentCount = Number(res?.sentCount || 1);
            const absentList = Array.isArray(res?.absentRecipients) ? res.absentRecipients : [];

            if (absentList.length) {
                const names = absentList.map((entry) => entry.userId).join(', ');
                setHint(sentCount > 1
                    ? `${sentCount}명에게 발송했습니다. [부재중] ${names}`
                    : `[부재알림] ${names}님은 현재 부재 중입니다: "${absentList[0].absentMsg || ''}"`);
            } else if (sentCount > 1) {
                setHint(`${sentCount}명에게 쪽지를 발송했습니다. (${(res.recipients || []).join(', ')})`);
            } else {
                setHint('쪽지를 발송했습니다.');
            }
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

        // [LOG_ID: 20260719_1200] 축하카드(vmail) 카드 선택 단계 — 카드 고르면 받는 사람 입력으로 넘어간다.
        if (flow.stage === 'card_select') {
            appendMemoWriteLine('카드 번호 >>', line);
            if (isCancel) {
                renderMemoWriteScreen();
                return await cancelMemoWrite();
            }
            const cardIdx = parseInt(trimmed, 10);
            const cardKey = MEMO_CARD_KEYS[cardIdx - 1];
            if (!cardKey) {
                appendMemoWriteLine('[안내]', `잘못된 선택입니다. 1~${MEMO_CARD_KEYS.length} 중 하나를 입력해 주세요.`);
                renderMemoWriteScreen();
                return true;
            }
            flow.cardKey = cardKey;
            appendMemoWriteLine('[확인]', `${MEMO_CARDS[cardKey].label} 카드 선택됨`);
            // 받는 사람이 이미 지정돼 있으면 본문으로, 아니면 받는 사람 입력으로.
            if (flow.target) {
                flow.stage = 'body';
                appendMemoWriteLine('받는 사람 >>', flow.target);
                appendMemoWriteLine('[안내]', '카드에 담을 인사말을 한 줄씩 입력하세요. /s 전송, /q 취소');
            } else {
                flow.stage = 'target';
                appendMemoWriteLine('[안내]', '받는 사람 아이디를 입력하세요.');
            }
            renderMemoWriteScreen();
            return true;
        }

        // [LOG_ID: 20260713_1620] 편지 종류(1-8) 선택 가로채기
        if (flow.stage === 'letter_type') {
            appendMemoWriteLine('편지 종류 >>', line);
            if (isCancel) {
                renderMemoWriteScreen();
                return await cancelMemoWrite();
            }
            const typeChoice = parseInt(trimmed, 10);
            if (!LETTER_TYPES[typeChoice]) {
                appendMemoWriteLine('[안내]', '잘못된 선택입니다. 1~8 중 하나를 입력해 주세요.');
                setPrompt('편지 종류 (1-8) >>');
                renderMemoWriteScreen();
                return true;
            }
            flow.letterType = typeChoice;
            // [LOG_ID: 20260713_1660] 숫자만 남기지 않고 고른 종류의 이름을 바로 확인시켜준다.
            appendMemoWriteLine('[확인]', `${typeChoice}. ${LETTER_TYPES[typeChoice].label} 선택됨`);
            if (LETTER_TYPES[typeChoice].delayed) {
                flow.stage = 'delay_minutes';
                appendMemoWriteLine('[안내]', '지연 시간을 분 단위로 입력하세요. (1~1440, 예: 30)');
                setPrompt('지연 시간(분) >>');
                renderMemoWriteScreen();
                return true;
            }
            flow.stage = 'send_cmd';
            appendMemoWriteLine('[선택]', '명령(1:발송, 2:저장, 3:발송+저장, 0:취소)');
            setPrompt('발송 명령 (1-3, 0) >>');
            renderMemoWriteScreen();
            return true;
        }

        // [LOG_ID: 20260713_1620] 지연편지 지연 시간(분) 입력 가로채기
        if (flow.stage === 'delay_minutes') {
            appendMemoWriteLine('지연 시간(분) >>', line);
            if (isCancel) {
                renderMemoWriteScreen();
                return await cancelMemoWrite();
            }
            const minutes = parseInt(trimmed, 10);
            if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
                appendMemoWriteLine('[안내]', '1~1440(24시간) 사이의 숫자를 입력해 주세요.');
                setPrompt('지연 시간(분) >>');
                renderMemoWriteScreen();
                return true;
            }
            flow.delayMinutes = minutes;
            appendMemoWriteLine('[확인]', `수신함에서 ${minutes}분 뒤부터 보이도록 지연 설정됨`);
            flow.stage = 'send_cmd';
            appendMemoWriteLine('[선택]', '명령(1:발송, 2:저장, 3:발송+저장, 0:취소)');
            setPrompt('발송 명령 (1-3, 0) >>');
            renderMemoWriteScreen();
            return true;
        }

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

            // [LOG_ID: 20260719_1400] @그룹명을 저장된 멤버로 펼친다(주소록/단체편지 그룹).
            const expanded = expandRecipients(trimmed);
            if (expanded !== trimmed) {
                appendMemoWriteLine('[그룹]', `${trimmed} → ${expanded}`);
            }
            flow.target = expanded;
            state._memoTarget = expanded;
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
            // [LOG_ID: 20260719_1200] 축하카드는 편지 종류(비밀/지연 등) 선택을 건너뛰고 바로 발송한다
            // (카드 자체가 편지 종류다). 일반 쪽지만 편지 종류 선택 단계로 넘어간다.
            if (flow.cardMode) {
                appendMemoWriteLine('[안내]', '축하카드를 발송합니다..');
                await handleMemoSubmitWithOptions(3);
                return true;
            }
            flow.stage = 'letter_type';
            // [LOG_ID: 20260713_1660] 편지 종류(1-8)를 DN 프로토콜 선택처럼 번호별 한 줄씩
            // 세로로 나열해 실제로 눈에 보이는 선택 목록(메뉴)으로 만든다.
            appendMemoWriteLine('[편지 종류 선택]', '');
            for (let i = 1; i <= 8; i += 1) {
                appendMemoWriteLine(`  ${i}.`, LETTER_TYPES[i].label);
            }
            setPrompt('편지 종류 (1-8) >>');
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
