import { buildTopbarHtml } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createMyInfoRenderer(deps) {
    const {
        applyCommandFooter,
        cmdInput,
        esc,
        mountPromptRow,
        restorePromptRow,
        screenEl,
        state,
        updateURL,
        setHint,
        setPrompt,
        getMode,
        getStage,
        getTranscript
    } = deps;

    // [LOG_ID: 20260721_1520] 모바일도 PC와 동일하게 날짜까지 보이도록 통일(사용자 요청) —
    // 더는 모바일에서 시:분만 줄이지 않고 항상 풀포맷을 쓴다.
    function buildTimestamp(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        const pad = (num) => String(num).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function getTopbarLabels() {
        const mode = getMode();
        if (mode === 'nickname') {
            return { leftLabel: 'NICK', centerLabel: '닉네임 변경' };
        }
        if (mode === 'email') {
            return { leftLabel: 'EMAIL', centerLabel: '이메일 변경' };
        }
        if (mode === 'password') {
            return { leftLabel: 'PW', centerLabel: '비밀번호 변경' };
        }
        if (mode === 'delete') {
            return { leftLabel: 'DELETE', centerLabel: '회원 탈퇴' };
        }
        return { leftLabel: 'MYINFO', centerLabel: '회원정보변경' };
    }

    function makeMyInfoTopbar() {
        const { leftLabel, centerLabel } = getTopbarLabels();
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        // [LOG_ID: 20260721_1430] layoutMode 누락으로 1초 시계 갱신이 모바일에서도 풀포맷으로
        // 덮어써지던 결함(authScreens.js와 동일 원인) — 여기도 명시적으로 넘긴다.
        return buildTopbarHtml({
            siteLabel: 'PC통신 동호회 01410',
            timestamp: buildTimestamp(),
            layoutMode: isMobile ? 'compact' : 'full',
            leftLabel,
            centerLabel,
            rightLabel: ''
        });
    }

    function buildMessageHtml() {
        const text = String(state._myInfoMessage || '').trim();
        if (!text) {
            return '';
        }
        const className = state._myInfoMessageType === 'error'
            ? 'myinfo-message myinfo-message--error'
            : 'myinfo-message';
        return `<div class="${className}">${esc(text)}</div>`;
    }

    // [LOG_ID: 20260731_2100] ansiBuilderUtils.js의 formatLongDate/formatShortDate와 동일한 결함이
    // 있었다 — DB/Supabase Auth가 주는 값은 전부 UTC ISO 8601("...T08:00:46+00:00")인데, 이 함수는
    // 문자열을 그대로 잘라 찍어 실제 한국시간(KST, UTC+9)보다 9시간 느린 시각을 보여줬다(사용자
    // 보고: /myinfo·/account "최근 접속"이 실제보다 9시간 이른 값으로 표시됨). 명시적 타임존
    // 표기(Z 또는 ±hh:mm)가 있는 값만 Date로 정식 변환한다(브라우저 로컬시간 = 한국 사용자 기준
    // KST로 정확히 환산됨) — 타임존 표기가 없는 값은 이미 로컬이므로 종전과 동일하게 그대로 읽는다.
    function formatDateTime(value) {
        const text = String(value || '').trim();
        if (!text) {
            return '정보 없음';
        }
        if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(text)) {
            const d = new Date(text);
            if (!isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            }
        }
        return text.replace('T', ' ').substring(0, 19);
    }

    function buildCommandLineBlock(lines) {
        return lines.map((line) => `<div class="myinfo-row"><span class="myinfo-label">${esc(line.label)}</span><span class="myinfo-value">${esc(line.value)}</span></div>`).join('');
    }

    function buildPromptTranscriptHtml() {
        const html = getTranscript().map((line) => {
            const prompt = String(line.prompt || '').trimEnd();
            if (line.isHtml) {
                return `<div class="myinfo-password-line">${prompt} ${esc(line.value)}</div>`;
            }
            return `<div class="myinfo-password-line">${esc(`${prompt} ${line.value}`.trim())}</div>`;
        }).join('');
        return `<div class="myinfo-password-block">${html}<div class="myinfo-password-prompt-host" data-myinfo-prompt-host></div></div>`;
    }

    function mountMyInfoPromptRow() {
        // [LOG: 20260508_1604] Keep MyInfo edit prompts inline with the transcript.
        const promptHost = screenEl?.querySelector?.('[data-myinfo-prompt-host]');
        if (promptHost && typeof mountPromptRow === 'function') {
            mountPromptRow(promptHost);
            setMyInfoPromptRowVisible(true);
            return;
        }

        restorePromptRow?.();
    }

    function setMyInfoPromptRowVisible(isVisible) {
        const promptRow = document.getElementById('terminal-prompt-row');
        if (promptRow) {
            // [LOG_ID: 20260716_2230] 숨길 땐 !important로 — is-command-pending CSS의 display:flex !important가
            // 인라인 display:none을 덮어써 대기 캐럿이 노출되던 것을 막는다. 보일 땐 ''로 속성을 지운다.
            if (isVisible) {
                promptRow.style.display = '';
            } else {
                promptRow.style.setProperty('display', 'none', 'important');
            }
        }
    }

    function focusCommandInputAtEnd() {
        if (!cmdInput || !shouldAutoFocusCommandInput()) {
            return;
        }

        cmdInput.focus();
        if (typeof cmdInput.setSelectionRange !== 'function') {
            return;
        }

        const caretPosition = cmdInput.value.length;
        cmdInput.setSelectionRange(caretPosition, caretPosition);
        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                cmdInput.setSelectionRange(caretPosition, caretPosition);
            }, 0);
        }
    }

    function clearDeleteConfirmPromptLabel() {
        document.getElementById('cmd-prompt')?.classList.remove('myinfo-delete-confirm-prompt-label');
    }

    function decorateDeleteConfirmPromptLabel() {
        const promptLabel = document.getElementById('cmd-prompt');
        if (!promptLabel) {
            return;
        }

        // [LOG: 20260509_1006] 회원 탈퇴 최종 확인은 한 줄 프롬프트와 실제 입력값 y로 표시한다.
        promptLabel.classList.add('myinfo-delete-confirm-prompt-label');
        promptLabel.textContent = '';
        promptLabel.append(document.createTextNode('정말로 탈퇴하시겠습니까? ('));

        const yesChoice = document.createElement('span');
        yesChoice.className = 'cmd-token cmd-clickable ansi-action-text';
        yesChoice.setAttribute('role', 'button');
        yesChoice.tabIndex = 0;
        yesChoice.setAttribute('aria-label', 'Y');
        yesChoice.dataset.cmd = 'y';
        yesChoice.dataset.tip = 'y';
        yesChoice.textContent = 'Y';
        promptLabel.append(yesChoice);

        promptLabel.append(document.createTextNode('/'));

        const noChoice = document.createElement('span');
        noChoice.className = 'cmd-token cmd-clickable ansi-action-text';
        noChoice.setAttribute('role', 'button');
        noChoice.tabIndex = 0;
        noChoice.setAttribute('aria-label', 'N');
        noChoice.dataset.cmd = 'n';
        noChoice.dataset.tip = 'n';
        noChoice.textContent = 'n';
        promptLabel.append(noChoice);

        promptLabel.append(document.createTextNode(')'));
    }

    function buildViewContent(user) {
        const recentEndTime = formatDateTime(user.lastLoginDateTime);
        return `
          <div class="myinfo-panel">
            ${buildMessageHtml()}
            ${buildCommandLineBlock([
            { label: '아이디', value: user.userId || 'guest' },
            { label: '현재 닉네임', value: user.nickName || '손님' },
            { label: '이메일', value: user.email || '등록 없음' },
            { label: '최근종료시간', value: recentEndTime },
            { label: '권한 레벨', value: user.level || 1 }
        ])}
            <div class="myinfo-help">
              <div class="myinfo-menu-item" role="button" tabindex="0" data-cmd="1"><span class="myinfo-menu-code">1.</span><span>닉네임 변경(NICK)</span></div>
              <div class="myinfo-menu-item" role="button" tabindex="0" data-cmd="2"><span class="myinfo-menu-code">2.</span><span>이메일 변경(EMAIL)</span></div>
              <div class="myinfo-menu-item" role="button" tabindex="0" data-cmd="3"><span class="myinfo-menu-code">3.</span><span>비밀번호 변경(PW)</span></div>
              <div class="myinfo-menu-item" role="button" tabindex="0" data-cmd="4"><span class="myinfo-menu-code">4.</span><span>회원 탈퇴(DELETE)</span></div>
              <div class="myinfo-menu-item" role="button" tabindex="0" data-cmd="5"><span class="myinfo-menu-code">5.</span><span>로그아웃(LOGOUT)</span></div>
            </div>
          </div>`;
    }

    function buildNicknameContent(user) {
        return `
          <div class="myinfo-panel">
            ${buildMessageHtml()}
            ${buildCommandLineBlock([
            { label: '아이디', value: user.userId || 'guest' },
            { label: '현재 닉네임', value: user.nickName || '손님' }
        ])}
            <div class="myinfo-password-prompt-host" data-myinfo-prompt-host></div>
          </div>`;
    }

    function buildEmailContent() {
        return `
          ${buildPromptTranscriptHtml()}`;
    }

    function buildPasswordContent() {
        return `
          ${buildPromptTranscriptHtml()}`;
    }

    function buildDeleteContent() {
        return `
          ${buildPromptTranscriptHtml()}`;
    }

    // [LOG_ID: 20260722_2300] 사용자 리포트: "회원 정보는 로그인 사용자만 이용할 수 있습니다. >> 라고
    // 나오는 화면에서 힌트바와 선택 >>이 없어진다" — 종전엔 ensureMyInfoAccess()가 showMain()을 먼저
    // 호출해 메인 화면을 그린 뒤 그 위에 setHint/setPrompt만 덮어써, 메인 화면의 자체 렌더가 그 직후
    // 힌트바/프롬프트를 다시 지워버리는 경합이 있었다. 이제 이 안내를 myinfo 화면 자체의 한 모드로
    // 그려 hint/footer가 정상적으로 붙게 하고, ENTER(또는 아무 명령)를 누르면 초기화면으로 이동한다
    // (commandRouterMyInfo.js의 mode==='guest-blocked' 분기).
    function buildGuestBlockedContent() {
        return `
          <div class="myinfo-panel">
            <div class="myinfo-message myinfo-message--error">회원 정보는 로그인 사용자만 이용할 수 있습니다.</div>
          </div>`;
    }

    function buildScreenContent(user) {
        const mode = getMode();
        if (mode === 'nickname') return buildNicknameContent(user);
        if (mode === 'email') return buildEmailContent();
        if (mode === 'password') return buildPasswordContent();
        if (mode === 'delete') return buildDeleteContent(user);
        if (mode === 'guest-blocked') return buildGuestBlockedContent();
        return buildViewContent(user);
    }

    async function applyHint() {
        const mode = getMode();
        clearDeleteConfirmPromptLabel();

        if (mode === 'view') {
            restorePromptRow?.();
            state._maskCommandInput = false;
            const footerText = String(deps.getSupportedFooterText(state) || '').trim();
            await applyCommandFooter('', footerText);
            return;
        }

        // [LOG_ID: 20260722_2300] 게스트 안내 화면 — 힌트바/프롬프트를 정상적으로 유지한 채
        // "ENTER를 누르면 초기화면으로 이동합니다" 안내를 보여준다.
        if (mode === 'guest-blocked') {
            restorePromptRow?.();
            state._maskCommandInput = false;
            setHint('ENTER를 누르면 초기화면으로 이동합니다.');
            setPrompt('>> ');
            if (cmdInput) {
                cmdInput.value = '';
            }
            return;
        }

        // [LOG_ID: 20260716_2030] 입력 프롬프트(닉네임/이메일/비밀번호) 진입 시 입력창을 반드시 비운다.
        // signup의 setStagePrompt는 매 단계 cmdInput.value=''로 초기화하는데 myinfo applyHint에는
        // 이 초기화가 빠져 있었다 — 직전 화면/명령의 잔상(클릭한 메뉴번호, 이전 단계 입력 등)이
        // 입력창에 남아 캐럿이 우측으로 밀리고(사용자 보고: "캐럿 위치가 오른쪽에 있다"),
        // 타이핑 시 [잔상+입력값]이 그대로 제출돼 "현재 비밀번호가 올바르지 않습니다"·"이미 등록된
        // 이메일" 오류가 났다. delete-confirm/complete 단계는 이 뒤에서 자체적으로 value('y'/'')를
        // 다시 설정하므로 영향받지 않는다.
        if (cmdInput) {
            cmdInput.value = '';
        }

        if (mode === 'nickname') {
            state._maskCommandInput = false;
            setHint('새 닉네임을 입력한 뒤 ENTER를 누르십시오.');
            setPrompt('>> ');
            mountMyInfoPromptRow();
            return;
        }

        // [LOG_ID: 20260716_2050] 프롬프트 텍스트 깜빡임 수정 — 반드시 setPrompt()로 새 텍스트를
        // 정한 "뒤"에 mountMyInfoPromptRow()로 프롬프트 행을 인라인 위치에 올려 보여준다.
        // 종전 이메일/비밀번호 단계는 mount(=이전 텍스트로 화면에 노출) → setPrompt(텍스트 교체) 순서라,
        // 단계 전환 시 새 프롬프트 자리에 직전 프롬프트("현재 비밀번호 >>")가 한 프레임 노출됐다가
        // 바뀌는 깜빡임이 있었다(사용자 보고: "새 이메일 >> 자리에 잠시 현재 비밀번호 >> 가 보였다가 바뀐다").
        // 닉네임 단계는 원래 setPrompt→mount 순서라 이 증상이 없었다 — 그 순서로 통일한다.
        if (mode === 'email') {
            const stage = getStage();
            setHint('');
            if (stage === 'email-new') {
                state._maskCommandInput = false;
                setPrompt('새 이메일 >> ');
                mountMyInfoPromptRow();
                return;
            }
            state._maskCommandInput = true;
            setPrompt('현재 비밀번호 >> ');
            mountMyInfoPromptRow();
            return;
        }

        if (mode === 'password') {
            state._maskCommandInput = true;
            setHint('');
            const stage = getStage();
            if (stage === 'password-saving') {
                // [LOG: 20260509_1024] 확인 입력 제출 후 API 처리 중에는 세 번째 확인 프롬프트를 그리지 않는다.
                state._maskCommandInput = false;
                setPrompt('');
                mountMyInfoPromptRow();
                setMyInfoPromptRowVisible(false);
                return;
            }
            if (stage === 'password-current') {
                setPrompt('현재 비밀번호 >> ');
                mountMyInfoPromptRow();
                return;
            }
            if (stage === 'password-confirm') {
                setPrompt('새 비밀번호 확인 >> ');
                mountMyInfoPromptRow();
                return;
            }
            setPrompt('새 비밀번호 >> ');
            mountMyInfoPromptRow();
            return;
        }

        if (mode === 'delete') {
            const stage = getStage();
            setHint('');
            // [LOG: 20260509_1010] setHint()가 prompt row를 footer로 복귀시키므로, 본문 장착은 그 다음에 수행한다.
            mountMyInfoPromptRow();
            if (stage === 'delete-confirm') {
                state._maskCommandInput = false;
                setPrompt('정말로 탈퇴하시겠습니까?');
                decorateDeleteConfirmPromptLabel();
                if (cmdInput) {
                    cmdInput.value = 'y';
                    focusCommandInputAtEnd();
                }
                return;
            }
            if (stage === 'delete-complete') {
                // [LOG: 20260509_1146] 탈퇴 완료 화면은 Enter 입력을 한 번 기다린 뒤 초기화면으로 이동한다.
                state._maskCommandInput = false;
                setPrompt('>> ');
                if (cmdInput) {
                    cmdInput.value = '';
                    focusCommandInputAtEnd();
                }
                return;
            } else {
                state._maskCommandInput = true;
                setPrompt('비밀번호 >> ');
            }
        }
    }

    async function renderMyInfo(fromHistory = false) {
        state.screen = 'myinfo';
        if (!fromHistory) updateURL();
        else void updateURL(true);

        const user = state.user || {};
        if (getMode() === 'nickname' || getMode() === 'email' || getMode() === 'password' || getMode() === 'delete') {
            screenEl.innerHTML = `<div class="ansi-screen" data-screen-kind="myinfo-password">${makeMyInfoTopbar()}${buildScreenContent(user)}</div>`;
            restorePromptRow?.();
        } else {
            screenEl.innerHTML = `<div class="ansi-screen">${makeMyInfoTopbar()}<div class="ansi-screen-body" data-screen-kind="myinfo">${buildScreenContent(user)}</div></div>`;
            restorePromptRow?.();
        }
        screenEl.classList.remove('is-loading');
        screenEl.parentElement?.classList.remove('is-loading');

        await applyHint();
    }

    return {
        renderMyInfo
    };
}
