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

    function buildTimestamp(value = new Date()) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const date = value instanceof Date ? value : new Date(value);
        const pad = (num) => String(num).padStart(2, '0');

        if (isMobile) {
            return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }
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
        return buildTopbarHtml({
            siteLabel: 'PC통신 동호회 01410',
            timestamp: buildTimestamp(),
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

    function formatDateTime(value) {
        const text = String(value || '').trim();
        if (!text) {
            return '정보 없음';
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
            promptRow.style.display = isVisible ? '' : 'none';
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
        yesChoice.dataset.cmd = 'y';
        yesChoice.dataset.tip = 'y';
        yesChoice.textContent = 'Y';
        promptLabel.append(yesChoice);

        promptLabel.append(document.createTextNode('/'));

        const noChoice = document.createElement('span');
        noChoice.className = 'cmd-token cmd-clickable ansi-action-text';
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
              <div class="myinfo-menu-item" data-cmd="1"><span class="myinfo-menu-code">1.</span><span>닉네임 변경(NICK)</span></div>
              <div class="myinfo-menu-item" data-cmd="2"><span class="myinfo-menu-code">2.</span><span>이메일 변경(EMAIL)</span></div>
              <div class="myinfo-menu-item" data-cmd="3"><span class="myinfo-menu-code">3.</span><span>비밀번호 변경(PW)</span></div>
              <div class="myinfo-menu-item" data-cmd="4"><span class="myinfo-menu-code">4.</span><span>회원 탈퇴(DELETE)</span></div>
              <div class="myinfo-menu-item" data-cmd="5"><span class="myinfo-menu-code">5.</span><span>로그아웃(LOGOUT)</span></div>
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

    function buildScreenContent(user) {
        const mode = getMode();
        if (mode === 'nickname') return buildNicknameContent(user);
        if (mode === 'email') return buildEmailContent();
        if (mode === 'password') return buildPasswordContent();
        if (mode === 'delete') return buildDeleteContent(user);
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

        if (mode === 'nickname') {
            restorePromptRow?.();
            state._maskCommandInput = false;
            setHint('새 닉네임을 입력한 뒤 ENTER를 누르십시오.');
            setPrompt('새 닉네임 >> ');
            return;
        }

        if (mode === 'email') {
            const stage = getStage();
            setHint('');
            if (stage === 'email-new') {
                state._maskCommandInput = false;
                mountMyInfoPromptRow();
                setPrompt('새 이메일 >> ');
                return;
            }
            state._maskCommandInput = true;
            mountMyInfoPromptRow();
            setPrompt('현재 비밀번호 >> ');
            return;
        }

        if (mode === 'password') {
            state._maskCommandInput = true;
            setHint('');
            const stage = getStage();
            mountMyInfoPromptRow();
            if (stage === 'password-saving') {
                // [LOG: 20260509_1024] 확인 입력 제출 후 API 처리 중에는 세 번째 확인 프롬프트를 그리지 않는다.
                state._maskCommandInput = false;
                setPrompt('');
                setMyInfoPromptRowVisible(false);
                return;
            }
            if (stage === 'password-current') {
                setPrompt('현재 비밀번호 >> ');
                return;
            }
            if (stage === 'password-confirm') {
                setPrompt('새 비밀번호 확인 >> ');
                return;
            }
            setPrompt('새 비밀번호 >> ');
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
        if (getMode() === 'email' || getMode() === 'password' || getMode() === 'delete') {
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
