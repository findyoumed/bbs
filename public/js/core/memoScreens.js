import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbarSequential, renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
// [LOG_ID: 20260719_1200] 하이텔 (10)-3 축하카드(vmail)·천리안 그림엽서 — 카드 아트.
import { MEMO_CARDS, MEMO_CARD_KEYS } from './memoCardAssets.js';
// [LOG_ID: 20260719_1400] 하이텔 (10)-6 단체편지 그룹·천리안 주소록 — @그룹명 → 멤버 펼침.
import { expandRecipients } from './memoGroups.js';
// [LOG_ID: 20260729_0110] handleMemoRawInput은 commandDispatcherExecution.js가 넘겨주는
// 정규화 전 원본 input을 그대로 받는다(commandRouterMemo.js가 rawCmd/cmd가 아니라 input을
// 전달) — 즉 전역 normalizeCommand()의 두벌식 자모 보정(koAliasMap: 'ㅔ'→P 등)을 거치지
// 않는다. contactSysopScreen.js에서 같은 이유로 이미 고친 것과 동일한 헬퍼를 여기도 둔다.
import { convertKoreanToEnglish } from './commandNormalizer.js';

// [LOG_ID: 20260713_1620] 하이텔 원전(길라잡이 p.105) 편지 종류 8종 — 비밀/답장요망/지연
// 3개 속성의 조합. 서버 스키마 변경 없이 제목 앞 대괄호 태그로 인코딩한다.
export const LETTER_TYPES = {
  1: { label: '일반편지', secret: false, replyRequired: false, delayed: false },
  2: { label: '비밀편지', secret: true, replyRequired: false, delayed: false },
  3: { label: '답장요망', secret: false, replyRequired: true, delayed: false },
  4: { label: '지연편지', secret: false, replyRequired: false, delayed: true },
  5: { label: '비밀+답장요망', secret: true, replyRequired: true, delayed: false },
  6: { label: '비밀+지연', secret: true, replyRequired: false, delayed: true },
  7: { label: '답장요망+지연', secret: false, replyRequired: true, delayed: true },
  8: { label: '비밀+답장요망+지연', secret: true, replyRequired: true, delayed: true }
};

export function buildMemoTitleTag(letterType, delayMinutes) {
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
        buildMemoMenuAnsi,
        buildMemoHelpAnsi,
        buildMemoViewAnsi,
        buildMenuHotspotsFromRows,
        renderMenuHotspots,
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
        // [LOG_ID: 20260725_2300] 이전엔 setHint(safeMessage)로 본문과 완전히 동일한 문장을
        // 힌트바에도 그대로 반복 출력해 화면에 같은 안내가 두 번 보였다(모바일 UI 육안 점검에서
        // 발견). myinfo의 guest-blocked 패턴(본문 안내 + 별도의 짧은 행동 유도 힌트)을 따라
        // T 입력 시 초기화면으로 이동한다는 실제 동작(위 handleMemoCommand의 모든 memo-list/
        // memo-view 분기에 공통으로 있는 cmd === 'T' 처리)을 안내하는 문구로 교체한다.
        setHint('T를 입력하면 초기화면으로 이동합니다.');
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

    // [LOG_ID: 20260807_1405] PC통신 나우누리 원전(docs/NOWNURI_SCREENS_FULL_DECODED.txt 91행) 기준
    // 전자우편 메인 서브메뉴(MAIL) 화면 렌더링 함수
    async function showMemoMenu(fromHistory = false) {
        state.screen = 'memo-menu';
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
            const ansiText = buildMemoMenuAnsi(state.user?.userId || '');
            const rendered = await renderAnsiScreenWithTopbarSequential({
                ansiText,
                ansiToHTML,
                screenEl,
                renderScreenSequential,
                afterBodyRender: async () => {
                    await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
                }
            });
            // [LOG_ID: 20260808_0933] 전자우편 대문은 ANSI 텍스트만 렌더돼 메뉴 항목에 호버·클릭
            // 대상이 없었다. 다른 번호형 메뉴와 같은 공용 핫스팟을 씌워 기존 명령 처리로 연결한다.
            const menuEntries = [
                { door: '1', action: 'cmd', cmd: 'RMAIL', title: '편지 읽기' },
                { door: '2', action: 'cmd', cmd: 'WMAIL', title: '편지 쓰기' },
                { door: '3', action: 'cmd', cmd: 'CMAIL', title: '배달 확인' },
                { door: '5', action: 'cmd', cmd: 'GRP', title: '동보편지 주소록' },
                { door: '6', action: 'cmd', cmd: 'ABSENT', title: '부재 설정' },
                { door: '7', action: 'cmd', cmd: '7', title: '전자우편 이용안내' }
            ];
            const hotspots = buildMenuHotspotsFromRows?.(
                rendered.rows,
                menuEntries,
                (left, right) => Number(left) - Number(right)
            );
            renderMenuHotspots?.(rendered.screenNode, hotspots);
            focusCommandInput();
        } catch (e) {
            renderMemoStatus(`전자우편 메뉴를 불러오지 못했습니다. ${String(e?.message || '알 수 없는 오류입니다.')}`);
        }
    }

    // [LOG_ID: 20260808_0940] 7. 전자우편 이용안내 도움말 화면 렌더링 함수
    async function showMemoHelp(fromHistory = false) {
        state.screen = 'memo-help';
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
            const ansiText = buildMemoHelpAnsi?.() || '';
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
            renderMemoStatus(`전자우편 이용안내를 불러오지 못했습니다. ${String(e?.message || '알 수 없는 오류입니다.')}`);
        }
    }

    // [LOG_ID: 20260808_1005] 쪽지 목록 화면의 각 쪽지 행에 마우스 클릭/호버 핫스팟 레이어 연결
    function renderMemoRowHotspots(screenNode, memos) {
        if (!screenNode || !memos || !memos.length) return;
        const layer = document.createElement('div');
        layer.className = 'ansi-hotspot-layer';
        const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
        const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
        const screenRect = screenNode.getBoundingClientRect();
        const scale = (screenNode.offsetWidth || 1) > 0 ? screenRect.width / screenNode.offsetWidth : 1;
        let searchFrom = 0;
        memos.forEach((memo, index) => {
            const itemNum = String(index + 1);
            let lineNode = null;
            for (let i = searchFrom; i < lineNodes.length; i++) {
                const firstToken = (lineNodes[i].textContent || '').trim().split(/\s+/)[0];
                if (firstToken === itemNum) {
                    lineNode = lineNodes[i];
                    searchFrom = i + 1;
                    break;
                }
            }
            if (!lineNode) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ansi-hotspot post-hotspot';
            btn.dataset.postid = itemNum;
            btn.setAttribute('aria-label', memo.title || memo.content || `쪽지 ${itemNum}`);
            const rect = lineNode.getBoundingClientRect();
            const topVal = (rect.top - screenRect.top) / scale;
            const heightVal = (rect.height || 16) / scale;
            btn.style.left = '0';
            btn.style.top = `${topVal}px`;
            btn.style.width = '100%';
            btn.style.height = `${heightVal}px`;
            layer.appendChild(btn);
        });
        if (layer.childElementCount > 0) screenNode.appendChild(layer);
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
            // [LOG: 20260801_2000] ESC 취소 후 stale fetch가 이전 화면을 덮어씌우는 경쟁 조건 가드
            if (state.screen !== 'memo-list') return;
            // [LOG_ID: 20260713_1620] 받은쪽지함에서만 지연편지의 지연 시간이 지나지 않은 항목을 숨긴다.
            state._memos = box === 'inbox' ? (memos || []).filter((m) => !isDelayedMemoPending(m)) : (memos || []);

            // [LOG_ID: 20260716_1800] 보관함(archive)은 받은/보낸 쪽지가 섞여 있어 "상대방"을
            // 쪽지마다 판단해야 하므로 내 아이디를 함께 넘긴다.
            const ansiText = buildMemoListAnsi(state._memos, box, state.user?.userId || '');
            const rendered = await renderAnsiScreenWithTopbarSequential({
                ansiText,
                ansiToHTML,
                screenEl,
                renderScreenSequential,
                afterBodyRender: async () => {
                    await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
                }
            });
            renderMemoRowHotspots(rendered.screenNode, state._memos);
            focusCommandInput();
        } catch (e) {
            renderMemoStatus(`쪽지 목록을 불러오지 못했습니다. ${String(e?.message || '알 수 없는 오류입니다.')}`);
        }
    }

    async function showMemoView(memoId, fromHistory = false, requestedPageNo = 1) {
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
            // [LOG: 20260801_2000] ESC 취소 후 stale fetch가 이전 화면을 덮어씌우는 경쟁 조건 가드 (1차)
            if (state.screen !== 'memo-view') return;
            const hydratedMemo = { ...(memo || {}) };

            // [LOG: 20260429_0042] Direct /memo/:memoId restores need the fetched memo context
            // so memo-view commands keep working even when the list screen was never loaded first.
            // [LOG_ID: 20260713_1000] 내가 보낸 쪽지가 아닐 때만(남에게 받은 편지일 때만) 수신확인(읽음 처리) 처리
            if (hydratedMemo.senderUserId !== state.user?.userId && !hydratedMemo.isRead) {
                const markedMemo = await apiFetch(`/api/memos/${memoId}/read`, { method: 'POST' });
                // [LOG: 20260801_2000] 읽음 처리 중 화면 전환 경쟁 조건 가드 (2차)
                if (state.screen !== 'memo-view') return;
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

            // [LOG_ID: 20260726_0010] 본문 페이징 추가 — 페이지 전환마다 서버 재조회 없이
            // 재사용하도록 조회한 쪽지를 캐싱한다(토론의 광장 안건 보기와 동일한 절약 패턴).
            state._currentMemoView = hydratedMemo;
            const built = buildMemoViewAnsi(hydratedMemo, state.user?.userId, requestedPageNo);
            state.memoViewPageNo = built.pageNo;
            state.memoViewPageCount = built.pageCount;
            const deleteConfirm = state._memoDeleteConfirm;
            const isDeletingThis = Boolean(deleteConfirm && String(deleteConfirm.memoId || '') === String(state._currentMemoId || ''));
            await renderAnsiScreenWithTopbarSequential({
                ansiText: built.text,
                ansiToHTML,
                screenEl,
                renderScreenSequential,
                afterBodyRender: async () => {
                    await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
                    if (isDeletingThis) {
                        setHint('삭제하려면 Y, 취소하려면 N을 입력하세요.');
                        setPrompt('삭제 (Y/n) >>');
                    } else if (hydratedMemo.senderUserId !== state.user?.userId && String(hydratedMemo.title || '').includes('답장요망')) {
                        setHint('발신자가 답장을 요청한 편지입니다. (답장 작성: R / 목록: Enter)');
                    }
                }
            });
            focusCommandInput();
        } catch (e) {
            renderMemoStatus(`쪽지를 읽지 못했습니다. ${String(e?.message || '알 수 없는 오류입니다.')}`);
        }
    }

    // 쪽지 보기 화면 안에서 페이지만 넘길 때 — 이미 캐싱된 쪽지를 재사용해 서버 재조회 없이 다시 그린다.
    async function showMemoViewPage(requestedPageNo) {
        const memo = state._currentMemoView;
        if (!memo) return false;
        const built = buildMemoViewAnsi(memo, state.user?.userId, requestedPageNo);
        state.memoViewPageNo = built.pageNo;
        state.memoViewPageCount = built.pageCount;
        await renderAnsiScreenWithTopbarSequential({
            ansiText: built.text,
            ansiToHTML,
            screenEl,
            renderScreenSequential,
            afterBodyRender: async () => {
                await applyCommandFooter(getMenuNodeByKey('memo')?.footer, getSupportedFooterText(state));
            }
        });
        focusCommandInput();
        return true;
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
            sending: false,
            isMemo: true
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

        // [LOG_ID: 20260801_1020] 대화형 단계(선택/입력)일 때는 기존의 CLI 히스토리 화면을 그린다.
        const isInteractiveStage = ['card_select', 'letter_type', 'delay_minutes', 'send_cmd'].includes(flow.stage);
        if (isInteractiveStage) {
            // [LOG_ID: 20260808_1249] 터미널 80x24 뷰포트(23줄 예산)를 넘치지 않도록 최근 15개 줄만 슬라이스한다.
            const recentTranscript = flow.transcript.slice(-15);
            const linesHtml = recentTranscript
                .map((line) => {
                    const prompt = String(line?.prompt || '');
                    const value = String(line?.value ?? '');
                    return `<div class="ansi-line" style="white-space:pre;overflow:hidden;text-overflow:ellipsis;"><span class="ansi-cyan">${esc(prompt)}</span>${value ? ` <span class="ansi-white">${esc(value)}</span>` : ''}</div>`;
                })
                .join('');
            const transcriptHtml = `<div onwheel="event.preventDefault();" style="display:flex;flex-direction:column;height:100%;overflow:hidden !important;overscroll-behavior:none !important;">${linesHtml}</div>`;

            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            renderRawHtmlScreenWithTopbar({
                leftLabel: 'MEMO',
                centerLabel: flow.cardMode ? '축하카드 선택' : '편지 쓰기',
                bodyHtml: transcriptHtml,
                screenEl,
                isMobile
            });

            if (flow.stage === 'card_select') {
                setHint(`보낼 축하카드 번호를 고르세요. (1-${MEMO_CARD_KEYS.length}, 취소: /q)`);
                setPrompt(`카드 번호 (1-${MEMO_CARD_KEYS.length}) >>`);
            } else if (flow.stage === 'letter_type') {
                setHint('보낼 편지의 종류 번호를 고르세요. (1-8, 취소: /q)');
                setPrompt('편지 종류 (1-8) >>');
            } else if (flow.stage === 'delay_minutes') {
                setHint('지연 시간을 분 단위로 입력하세요. (1-1440, 취소: /q)');
                setPrompt('지연 시간(분) >>');
            } else if (flow.stage === 'send_cmd') {
                setHint('발송 명령을 내리세요. (1:발송, 2:저장, 3:발송+저장, 0:취소)');
                setPrompt('발송 명령 (1-3, 0) >>');
            }
            setReady?.(true);
            focusCommandInput();
            return;
        }

        // [LOG_ID: 20260801_1020] 일반 작성/편집 중일 때는 정통 단말기 폼 에디터로 렌더링
        renderMemoBbsEditor(flow, handleMemoSubmit, cancelMemoWrite);
    }

    // [LOG_ID: 20260801_1020] PC통신 단말기 스타일 메일 폼 에디터 구현
    function renderMemoBbsEditor(flow, onSave, onCancel) {
        flow.stage = 'bbs-form';
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const targetId  = 'memo-ed-target';
        const subjectId = 'memo-ed-subject';
        const bodyId    = 'memo-ed-body';
        const hasSubjectField = !flow.cardMode;
        const sep = '─'.repeat(isMobile ? 40 : 76);

        // [LOG_ID: 20260807_1412] 폰트 색상을 #ffffff 순백색으로 강제 (caret-color, -webkit-text-fill-color 포함)
        const inputStyle = `
          flex: 1;
          background: transparent;
          border: none;
          color: #ffffff !important;
          caret-color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          font-family: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          font-weight: inherit !important;
          letter-spacing: inherit !important;
          outline: none;
          padding: 0;
          margin: 0;
          min-width: 0;
        `;

        const textareaStyle = `
          width: 100%;
          height: 100%;
          min-height: 0;
          flex: 1;
          background: transparent;
          border: none;
          color: #ffffff !important;
          caret-color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          font-family: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          font-weight: inherit !important;
          letter-spacing: inherit !important;
          outline: none;
          padding: 0;
          margin: 0;
          resize: none;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: none !important;
        `;

        const subjectInitiallyVisible = Boolean(flow.cardMode || String(flow.target || state._memoTarget || '').trim());
        const bodyInitiallyVisible = Boolean(
            flow.cardMode
            ? (Array.isArray(flow.bodyLines) && flow.bodyLines.length)
            : (String(flow.subject || '').trim() || (Array.isArray(flow.bodyLines) && flow.bodyLines.length))
        );

        const subjectRowHtml = hasSubjectField ? `
  <div id="memo-ed-subject-row" class="memo-ed-row" style="display:${subjectInitiallyVisible ? 'flex' : 'none'};">
    <label for="${subjectId}" class="memo-ed-label">제    목 :&nbsp;</label>
    <input id="${subjectId}" type="text" autocomplete="off" spellcheck="false" maxlength="60" placeholder="" style="${inputStyle}"/>
  </div>` : '';

        const bodyHtml = `
<style>
  #${targetId}, #${subjectId} {
    color: #ffffff !important;
    caret-color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    cursor: text !important;
    overflow: hidden !important;
  }
  #${bodyId} {
    color: #ffffff !important;
    caret-color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    cursor: text !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
  #${targetId}::placeholder, #${subjectId}::placeholder, #${bodyId}::placeholder {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    opacity: 1 !important;
  }
  #${targetId}::-webkit-input-placeholder, #${subjectId}::-webkit-input-placeholder, #${bodyId}::-webkit-input-placeholder {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    opacity: 1 !important;
  }
  #${targetId}::-moz-placeholder, #${subjectId}::-moz-placeholder, #${bodyId}::-moz-placeholder {
    color: #ffffff !important;
    opacity: 1 !important;
  }
  .memo-ed-label {
    white-space: nowrap;
    user-select: none;
    color: #ffffff !important;
    font-family: inherit;
    cursor: pointer !important;
  }
  .memo-ed-row {
    display: flex;
    align-items: center;
    padding: 2px 0;
    gap: 0;
    flex-shrink: 0;
    cursor: pointer;
  }
  .memo-ed-body-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    margin-top: 4px;
    min-height: 4.4em;
    cursor: pointer;
    overflow: hidden !important;
  }
  /* [LOG_ID: 20260811_1546] 필수 입력 오류는 하단 힌트바가 아닌
     해당 입력 행 바로 위에 표시해 전송·취소 안내를 보존한다. */
  .memo-ed-validation {
    color: #ffffff !important;
    font-family: inherit;
    white-space: pre-wrap;
    padding: 2px 0;
    margin: 0;
    flex-shrink: 0;
  }
</style>
<div onwheel="event.preventDefault();" style="display:flex;flex-direction:column;height:100%;overflow:hidden !important;overscroll-behavior:none !important;min-height:0;font-family:inherit;font-size:inherit;line-height:inherit;color:#ffffff !important;background:transparent;box-sizing:border-box;">
  <div id="memo-ed-target-row" class="memo-ed-row">
    <label for="${targetId}" class="memo-ed-label">받는 사람 :&nbsp;</label>
    <input id="${targetId}" type="text" autocomplete="off" spellcheck="false" placeholder="" style="${inputStyle}"/>
  </div>
  ${subjectRowHtml}
  <div id="memo-ed-write-instruction" style="color:#ffffff !important;font-size:inherit !important;padding:4px 0;white-space:normal;word-break:keep-all;overflow-wrap:break-word;user-select:none;font-family:inherit;">
    ${bodyInitiallyVisible
        ? '내용을 작성한 후 마지막 줄 첫 칸에 마침표(.)를 찍고 Enter를 누르면 다음 단계로 이동합니다.'
        : subjectInitiallyVisible
            ? '제목을 입력한 후 Enter를 누르면 내용을 작성합니다.'
            : '받는 사람을 입력한 후 Enter를 누르면 제목을 입력합니다.'}
  </div>
  <div id="memo-ed-separator" style="display:${bodyInitiallyVisible ? 'block' : 'none'};color:#ffffff;font-size:inherit;line-height:inherit;letter-spacing:0;white-space:pre;user-select:none;margin:2px 0;flex-shrink:0;">${sep}</div>
  <div id="memo-ed-body-row" class="memo-ed-body-wrapper" style="display:${bodyInitiallyVisible ? 'flex' : 'none'};">
    <label for="${bodyId}" class="memo-ed-label" style="padding-bottom:4px;">내    용 :</label>
    <textarea id="${bodyId}" spellcheck="false" autocomplete="off" style="${textareaStyle}"></textarea>
  </div>
</div>`;

        renderRawHtmlScreenWithTopbar({
            leftLabel: 'WMAIL',
            centerLabel: flow.cardMode ? '축하카드 작성' : '편지 쓰기',
            bodyHtml,
            screenEl,
            isMobile
        });

        const targetEl  = document.getElementById(targetId);
        const subjectEl = document.getElementById(subjectId);
        const bodyEl    = document.getElementById(bodyId);
        const targetRowEl  = document.getElementById('memo-ed-target-row');
        const subjectRowEl = document.getElementById('memo-ed-subject-row');
        const bodyRowEl   = document.getElementById('memo-ed-body-row');
        if (!targetEl || !bodyEl) return;

        targetEl.value = String(flow.target || state._memoTarget || '').trim();
        if (subjectEl) {
            subjectEl.value = String(flow.subject || '').trim();
        }
        bodyEl.value   = Array.isArray(flow.bodyLines) ? flow.bodyLines.join('\n') : '';

        const promptRow = document.getElementById('terminal-prompt-row');
        if (promptRow) promptRow.style.display = '';
        if (cmdInput) cmdInput.style.display = '';

        flow._textareaActive = true;
        setHint('전송: Ctrl+S 또는 마지막 줄에 . 후 Enter  |  취소: Escape  |  이동: Tab/화살표');
        setPrompt('선택 >>');
        setReady?.(true);

        function setWriteInstruction(text) {
            const instructionEl = document.getElementById('memo-ed-write-instruction');
            if (instructionEl) instructionEl.textContent = text;
        }

        function revealSubjectStage() {
            if (!subjectRowEl) return;
            subjectRowEl.style.display = 'flex';
            setWriteInstruction('제목을 입력한 후 Enter를 누르면 내용을 작성합니다.');
        }

        function revealBodyStage() {
            if (subjectRowEl) subjectRowEl.style.display = 'flex';
            if (bodyRowEl) bodyRowEl.style.display = 'flex';
            const separatorEl = document.getElementById('memo-ed-separator');
            if (separatorEl) separatorEl.style.display = 'block';
            setWriteInstruction('내용을 작성한 후 마지막 줄 첫 칸에 마침표(.)를 찍고 Enter를 누르면 다음 단계로 이동합니다.');
        }

        function safeFocus(el) {
            if (!el || typeof el.focus !== 'function') return;
            try {
                el.focus({ preventScroll: true });
            } catch (_) {
                el.focus();
            }
            const resetScroll = (node) => {
                if (node) {
                    node.scrollTop = 0;
                    node.scrollLeft = 0;
                }
            };
            resetScroll(document.documentElement);
            resetScroll(document.body);
            resetScroll(document.getElementById('terminal-wrapper'));
            resetScroll(document.getElementById('terminal-container'));
            resetScroll(document.getElementById('terminal-screen'));
            document.querySelectorAll('.ansi-screen, .ansi-screen-body').forEach(resetScroll);
        }

        const onTargetRowClick = (e) => {
            if (e.target !== targetEl) {
                safeFocus(targetEl);
            }
        };

        const onSubjectRowClick = (e) => {
            if (subjectEl && e.target !== subjectEl) {
                safeFocus(subjectEl);
            }
        };

        const onBodyRowClick = (e) => {
            if (e.target !== bodyEl) {
                safeFocus(bodyEl);
            }
        };

        targetRowEl?.addEventListener('click', onTargetRowClick);
        subjectRowEl?.addEventListener('click', onSubjectRowClick);
        bodyRowEl?.addEventListener('click', onBodyRowClick);

        function cleanup() {
            flow._textareaActive = false;
            flow._saving = false;
            targetEl.disabled = false;
            if (subjectEl) subjectEl.disabled = false;
            bodyEl.disabled = false;
            if (promptRow) promptRow.style.display = '';
            if (cmdInput) cmdInput.style.display = '';

            targetRowEl?.removeEventListener('click', onTargetRowClick);
            subjectRowEl?.removeEventListener('click', onSubjectRowClick);
            bodyRowEl?.removeEventListener('click', onBodyRowClick);
            targetEl.removeEventListener('keydown', onTargetKey);
            targetEl.removeEventListener('keypress', onTargetKey);
            targetEl.removeEventListener('input', clearInlineValidationError);
            if (subjectEl) {
                subjectEl.removeEventListener('keydown', onSubjectKey);
                subjectEl.removeEventListener('keypress', onSubjectKey);
                subjectEl.removeEventListener('input', clearInlineValidationError);
            }
            bodyEl.removeEventListener('keydown', onBodyKey);
            bodyEl.removeEventListener('input', clearInlineValidationError);
            if (cmdInput) {
                cmdInput.removeEventListener('keydown', onCmdKey);
            }
            if (typeof screenEl?.removeEventListener === 'function') {
                screenEl.removeEventListener('keydown', onMemoFieldCapture, true);
                screenEl.removeEventListener('keypress', onMemoFieldCapture, true);
          }
        }

        // [LOG_ID: 20260811_1546] 입력 검증 문구는 PC통신식 편집 화면 안에
        // 표시하고, 하단 힌트바의 전송·취소 안내를 덮어쓰지 않는다.
        function clearInlineValidationError() {
            screenEl?.querySelector('.memo-ed-validation')?.remove();
        }

        function showInlineValidationError(message, rowId) {
            clearInlineValidationError();
            const row = document.getElementById(rowId);
            if (!row?.parentNode) return;
            const errorEl = document.createElement('div');
            errorEl.className = 'memo-ed-validation';
            errorEl.setAttribute('role', 'alert');
            errorEl.textContent = String(message || '입력값을 확인해주세요.');
            row.parentNode.insertBefore(errorEl, row);
        }

        function doSave() {
            if (flow._saving) return;
            const targetVal  = targetEl.value.trim();
            const subjectVal = subjectEl ? subjectEl.value.trim() : '';
            const bodyVal    = bodyEl.value.trim();

            if (!targetVal) {
                showInlineValidationError('받는 사람 아이디를 입력해주세요.', 'memo-ed-target-row');
                targetEl.focus();
                return;
            }
            if (!bodyVal) {
                showInlineValidationError('내용을 입력해주세요.', 'memo-ed-body-row');
                revealBodyStage();
                bodyEl.focus();
                return;
            }

            flow._saving = true;
            const expanded = expandRecipients(targetVal);
            flow.target = expanded;
            flow.subject = subjectVal;
            state._memoTarget = expanded;

            const lines = bodyEl.value.split('\n');
            if (lines.length > 0 && lines[lines.length - 1].trim() === '.') lines.pop();
            flow.bodyLines = lines;

            targetEl.disabled = true;
            if (subjectEl) subjectEl.disabled = true;
            bodyEl.disabled = true;

            const releaseFields = () => {
                flow._saving = false;
                targetEl.disabled = false;
                if (subjectEl) subjectEl.disabled = false;
                bodyEl.disabled = false;
            };

            if (flow.cardMode) {
                Promise.resolve(onSave())
                    .then((succeeded) => {
                        if (succeeded === false) {
                            releaseFields();
                            return;
                        }
                        cleanup();
                    })
                    .catch(() => releaseFields());
            } else {
                cleanup();
                flow.stage = 'letter_type';
                appendMemoWriteLine('[받는 사람]', flow.target);
                if (flow.subject) {
                    appendMemoWriteLine('[제목]', flow.subject);
                }
                appendMemoWriteLine('[내용]', flow.bodyLines.join('\n'));
                appendMemoWriteLine('[편지 종류 선택]', '');
                for (let i = 1; i <= Object.keys(LETTER_TYPES).length; i += 1) {
                    appendMemoWriteLine(`  ${i}.`, LETTER_TYPES[i].label);
                }
                setPrompt('편지 종류 (1-8) >>');
                renderMemoWriteScreen();
            }
        }

        function isOnFirstLine(ta) {
            return ta.value.substring(0, ta.selectionStart).indexOf('\n') === -1;
        }

        // [LOG_ID: 20260811_1330] Keyboard layouts/IME modes can report Enter
        // as key, code, or legacy keyCode. Treat all browser variants as the
        // same next-field action, matching the existing Tab behavior.
        function isEnterKey(e) {
            return e?.key === 'Enter'
                || e?.code === 'Enter'
                || e?.code === 'NumpadEnter'
                || e?.keyCode === 13
                || e?.which === 13;
        }

        function isForwardFieldKey(e) {
            return isEnterKey(e)
                || e?.key === 'ArrowDown'
                || (e?.key === 'Tab' && !e.shiftKey);
        }

        function onTargetKey(e) {
            if (e.type === 'keypress' && !isForwardFieldKey(e)) return;
            if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); doSave(); return; }
            if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
            if (isForwardFieldKey(e)) {
                e.preventDefault();
                e.stopPropagation();
                if (subjectEl) {
                    revealSubjectStage();
                    safeFocus(subjectEl);
                    subjectEl.setSelectionRange(0, 0);
                } else {
                    revealBodyStage();
                    safeFocus(bodyEl);
                    bodyEl.setSelectionRange(0, 0);
                }
            }
        }

        function onSubjectKey(e) {
            if (e.type === 'keypress' && !isForwardFieldKey(e)) return;
            if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); doSave(); return; }
            if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
            if (isForwardFieldKey(e)) {
                e.preventDefault();
                e.stopPropagation();
                revealBodyStage();
                safeFocus(bodyEl);
                bodyEl.setSelectionRange(0, 0);
            } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
                e.preventDefault();
                safeFocus(targetEl);
                targetEl.setSelectionRange(targetEl.value.length, targetEl.value.length);
            }
        }

        function onBodyKey(e) {
            if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); doSave(); return; }
            if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                if (cmdInput) {
                    safeFocus(cmdInput);
                    cmdInput.select();
                }
                return;
            }
            if ((e.key === 'ArrowUp' && isOnFirstLine(bodyEl)) || (e.key === 'Tab' && e.shiftKey)) {
                e.preventDefault();
                if (subjectEl) {
                    safeFocus(subjectEl);
                    subjectEl.setSelectionRange(subjectEl.value.length, subjectEl.value.length);
                } else {
                    safeFocus(targetEl);
                    targetEl.setSelectionRange(targetEl.value.length, targetEl.value.length);
                }
                return;
            }
            if (isEnterKey(e)) {
                const pos = bodyEl.selectionStart;
                const before = bodyEl.value.substring(0, pos);
                const currentLine = before.split('\n').pop().trim();
                if (currentLine === '.') { e.preventDefault(); doSave(); return; }
            }
        }

        function onCmdKey(e) {
            // Escape remains available after Tab moves focus from the body to
            // the shared command input. Keep cancel parity with all editor
            // fields instead of leaving the key inert at the boundary.
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
                onCancel();
                return;
            }
            if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
                e.preventDefault();
                safeFocus(bodyEl);
                bodyEl.setSelectionRange(bodyEl.value.length, bodyEl.value.length);
                return;
            }
        }

        // Delegate forward navigation at the screen boundary as a fallback
        // for browsers that do not deliver the composed Enter event to the
        // input's own listener. This keeps Enter and Tab behavior identical.
        function onMemoFieldCapture(e) {
            if (e.target !== targetEl && e.target !== subjectEl) return;
            if (!isForwardFieldKey(e)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.target === targetEl && subjectEl) {
                revealSubjectStage();
                safeFocus(subjectEl);
                subjectEl.setSelectionRange(0, 0);
                return;
            }
            revealBodyStage();
            safeFocus(bodyEl);
            bodyEl.setSelectionRange(0, 0);
        }

        targetEl.addEventListener('keydown', onTargetKey);
        targetEl.addEventListener('keypress', onTargetKey);
        targetEl.addEventListener('input', clearInlineValidationError);
        if (subjectEl) {
            subjectEl.addEventListener('keydown', onSubjectKey);
            subjectEl.addEventListener('keypress', onSubjectKey);
            subjectEl.addEventListener('input', clearInlineValidationError);
        }
        bodyEl.addEventListener('keydown', onBodyKey);
        bodyEl.addEventListener('input', clearInlineValidationError);
        if (cmdInput) {
            cmdInput.addEventListener('keydown', onCmdKey);
        }
        if (typeof screenEl?.addEventListener === 'function') {
            screenEl.addEventListener('keydown', onMemoFieldCapture, true);
            screenEl.addEventListener('keypress', onMemoFieldCapture, true);
        }

        flow._textareaCleanup = cleanup;
        flow._doSave = doSave;
        flow._doCancel = () => { cleanup(); onCancel(); };

        setTimeout(() => {
            if (targetEl) {
                safeFocus(targetEl);
                targetEl.setSelectionRange(targetEl.value.length, targetEl.value.length);
            }
        }, 10);
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
            // [LOG_ID: 20260828_1720] `FW 번호 아이디`는 목록에서 이미
            // 수신자를 지정했으므로 전달 본문을 채운 뒤에도 본문 단계에
            // 머물러야 한다. 기존 읽기 화면의 무대상 FW만 받는 사람
            // 단계를 다시 보여준다.
            state._memoWriteFlow.stage = state._memoWriteFlow.target ? 'body' : 'target';
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
            const userSubject = String(flow?.subject || '').trim();
            const defaultTitle = flow?.cardKey ? `축하카드` : '편지';
            const finalTitle = userSubject ? `${titlePrefix}${userSubject}` : `${titlePrefix}${defaultTitle}`;

            const res = await apiFetch('/api/memos', {
                method: 'POST',
                body: JSON.stringify({
                    recipientUserId: targetUserId,
                    title: finalTitle,
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

        // [LOG_ID: 20260801_1230] 대화형 CLI 입력 처리 시 다음 단계에서 입력창이 비워져 있도록 클리어 처리
        if (cmdInput) {
            cmdInput.value = '';
        }

        const line = String(raw ?? '');
        const trimmed = line.trim();
        const cmd = trimmed.toUpperCase();
        // [LOG_ID: 20260729_0110] 한/영 전환이 안 된 채 물리 P/M/B/S 키를 치면 두벌식 자판상
        // 'ㅔ'/'ㅡ'/'ㅠ'/'ㄴ'으로 들어온다 — 그 결과가 알려진 명령과 일치할 때만 그 명령으로
        // 인정한다(자유 한국어 문장은 음절이 2글자 이상이라 오작동 위험 없음).
        const koCmd = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(trimmed) ? convertKoreanToEnglish(trimmed).toUpperCase() : '';
        const isCancel = trimmed === '/q' || cmd === 'P' || cmd === 'M' || cmd === 'B'
          || koCmd === '/Q' || koCmd === 'P' || koCmd === 'M' || koCmd === 'B';

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

        // [LOG_ID: 20260801_1710] BBS 폼 에디터가 활성화 중(stage === 'bbs-form')일 때는
        // cmdInput 입력을 폼 자체의 keydown 이벤트 리스너가 처리한다. 여기서
        // flow.bodyLines를 수정하거나 renderMemoWriteScreen()을 호출하면 사용자가 textarea에
        // 직접 입력한 내용이 stale한 flow.bodyLines.join('\n')으로 덮어씌워지는 데이터 손실이
        // 발생한다(재현 경로: 폼에서 Tab → cmdInput 포커스 → 임의 텍스트 입력 후 Enter).
        // /q 명령은 폼 취소로 연결하고, 그 외 cmdInput 입력은 소비만 하고 무시한다.
        if (flow.stage === 'bbs-form') {
            if (trimmed === '/q' || koCmd === '/Q' || cmd === 'P' || cmd === 'M' || cmd === 'B') {
                if (typeof flow._doCancel === 'function') {
                    flow._doCancel();
                } else {
                    await cancelMemoWrite();
                }
                return true;
            }

            // [LOG_ID: 20260811_1430] The form owns ordinary text input, but
            // global memo navigation must still reach commandRouterGlobalNavigation.
            // Returning false lets ME/MEMO/RMAIL/WMAIL/MAIL/CMAIL/T run normally.
            if (['ME', 'MEMO', 'RMAIL', 'WMAIL', 'MAIL', 'CMAIL', 'T'].includes(cmd)) {
                return false;
            }
            return true;
        }

        if (isCancel) {
            appendMemoWriteLine('내용 >>', line);
            renderMemoWriteScreen();
            return await cancelMemoWrite();
        }

        if (trimmed === '.' || trimmed === '/s' || cmd === 'SEND' || koCmd === '/S' || koCmd === 'SEND') {
            appendMemoWriteLine('내용 >>', line);
            // [LOG_ID: 20260719_1200] 축하카드는 편지 종류(비밀/지연 등) 선택을 건너뛰고 바로 발송한다
            // (카드 자체가 편지 종류다). 일반 쪽지만 편지 종류 선택 단계로 넘어간다.
            appendMemoWriteLine('[안내]', '편지를 발송하는 중입니다..');
            await handleMemoSubmitWithOptions(3);
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
        showMemoMenu,
        showMemoHelp,
        showMemoView,
        showMemoViewPage,
        showMemoWrite
    };
}
