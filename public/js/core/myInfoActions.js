export function createMyInfoActions(deps) {
    const {
        apiFetch,
        doLogin,
        doLogout,
        guestUser,
        showMain,
        state,
        setHint,
        setPrompt,
        renderMyInfo,
        clearDraft,
        clearMessage,
        clearTranscript,
        appendTranscriptLine,
        resetMyInfoState,
        setDraft,
        setMessage,
        setMode,
        setStage,
        getStage
    } = deps;

    const PASSWORD_FAILURE_LIMIT = 5;

    function normalizeEmail(value) {
        const email = String(value || '').trim().toLowerCase();
        if (!email) {
            return '';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return '';
        }
        return email;
    }

    async function verifyCurrentPassword(userId, password) {
        const targetUserId = String(userId || '').trim();
        const currentPassword = String(password || '').trim();
        if (!targetUserId || !currentPassword) {
            return false;
        }

        try {
            const result = await apiFetch(`/api/members/${encodeURIComponent(targetUserId)}/password/verify`, {
                method: 'POST',
                body: JSON.stringify({ password: currentPassword }),
                silent: true
            });
            return result?.verified === true;
        } catch (error) {
            console.error('[MyInfo] current password verification request failed:', error.message);
            return false;
        }
    }

    function getPasswordFailureCounts() {
        return state._myInfoPasswordFailures && typeof state._myInfoPasswordFailures === 'object'
            ? state._myInfoPasswordFailures
            : {};
    }

    function resetPasswordFailureCount(stage = '') {
        if (!stage) {
            state._myInfoPasswordFailures = {};
            return;
        }

        const nextCounts = { ...getPasswordFailureCounts() };
        delete nextCounts[stage];
        state._myInfoPasswordFailures = nextCounts;
    }

    function recordPasswordFailure(stage) {
        const key = String(stage || '').trim() || 'password';
        const nextCounts = { ...getPasswordFailureCounts() };
        const count = (Number(nextCounts[key]) || 0) + 1;
        nextCounts[key] = count;
        state._myInfoPasswordFailures = nextCounts;
        return {
            count,
            reachedLimit: count >= PASSWORD_FAILURE_LIMIT,
            remaining: Math.max(0, PASSWORD_FAILURE_LIMIT - count)
        };
    }

    async function abortPasswordChange(message) {
        resetPasswordFailureCount();
        resetMyInfoState();
        setMessage(message, 'error');
        setHint('');
        setPrompt('>> ');
        await renderMyInfo(true);
        return false;
    }

    async function ensureMyInfoAccess() {
        if (!state.user?.isGuest) {
            return true;
        }

        resetMyInfoState();
        await showMain();
        setHint('회원 정보는 로그인 사용자만 이용할 수 있습니다.');
        setPrompt('>> ');
        return false;
    }

    async function showMyInfo(fromHistory = false, options = {}) {
        if (!(await ensureMyInfoAccess())) {
            return;
        }

        const hasMode = Object.prototype.hasOwnProperty.call(options, 'mode');
        const hasMessage = Object.prototype.hasOwnProperty.call(options, 'message');

        if (!fromHistory && state.screen !== 'myinfo') {
            resetMyInfoState();
        }

        if (hasMode) {
            setMode(options.mode);
        } else if (!fromHistory || state.screen !== 'myinfo') {
            setMode('view');
        }

        if (options.clearDraft === true) {
            clearDraft();
        }

        if (hasMessage) {
            if (String(options.message || '').trim()) {
                setMessage(options.message, options.messageType);
            } else {
                clearMessage();
            }
        }

        await renderMyInfo(fromHistory);
    }

    async function openNicknameChange() {
        if (!(await ensureMyInfoAccess())) {
            return;
        }
        clearMessage();
        clearDraft();
        clearTranscript();
        setMode('nickname');
        setStage('idle');
        setHint('새 닉네임을 명령줄에 입력한 뒤 ENTER를 누르십시오.');
        setPrompt('>> ');
        await renderMyInfo(true);
    }

    async function submitNicknameChange(rawValue) {
        if (!(await ensureMyInfoAccess())) {
            return false;
        }
        const newNick = String(rawValue || '').trim();
        setDraft({ nickName: newNick });

        if (newNick.length < 2) {
            setMessage('닉네임은 2자 이상이어야 합니다.', 'error');
            await renderMyInfo(true);
            return false;
        }

        const cmdInput = document.getElementById('cmd-input');
        if (cmdInput) {
            cmdInput.value = '';
        }

        let updated;
        try {
            // [LOG: 20260716_1928] setHint('')는 내부에서 syncScreenContext→restorePromptRow를 호출하여
            // 인라인 프롬프트를 하단으로 복원하고 terminal-footer--prompt-detached를 제거한다.
            // 이 때문에 숨겨져 있던 하단 푸터(힌트바)가 잠깐 깜빡이며 노출된다.
            // 힌트 DOM만 직접 비워서 프롬프트 위치를 건드리지 않는다.
            const hintBarEl = document.getElementById('cmd-hint');
            if (hintBarEl) {
                hintBarEl.innerHTML = '';
            }
            updated = await apiFetch('/api/members/profile', {
                method: 'POST',
                body: JSON.stringify({ nickName: newNick })
            });
        } catch (error) {
            setMessage(error.message || '닉네임을 변경하지 못했습니다.', 'error');
            await renderMyInfo(true);
            return false;
        }

        if (!updated) {
            setMessage('닉네임을 변경하지 못했습니다.', 'error');
            await renderMyInfo(true);
            return false;
        }

        state.user.userId = updated.userId || state.user.userId;
        state.user.nickName = updated.nickName || newNick;
        resetMyInfoState();
        await showMyInfo(true, {
            mode: 'view',
            message: `닉네임이 [${state.user.nickName}]로 변경되었습니다.`,
            messageType: 'notice',
            clearDraft: true
        });
        return true;
    }

    async function openEmailChange() {
        if (!(await ensureMyInfoAccess())) {
            return;
        }
        clearMessage();
        clearDraft();
        clearTranscript();
        setMode('email');
        setStage('email-current');
        appendTranscriptLine({ prompt: '본인 확인을 위해 현재 비밀번호를 입력해 주십시오.', value: '' });
        setHint('');
        setPrompt('현재 비밀번호 >> ');
        await renderMyInfo(true);
    }

    async function submitEmailChange(rawValue) {
        if (!(await ensureMyInfoAccess())) {
            return false;
        }

        const stage = getStage();
        const text = String(rawValue || '').trim();
        const targetUserId = String(state.user?.userId || '').trim();
        // [LOG: 20260507_1735] Password input is no-echo: transcript keeps prompts only.
        if (stage === 'email-current') {
            if (!text) {
                clearMessage();
                appendTranscriptLine({ prompt: '현재 비밀번호를 입력해 주십시오.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            appendTranscriptLine({ prompt: '현재 비밀번호 >>', value: '*'.repeat(text.length) }); // [LOG: 20260509_0917] 암호 마스킹 유지
            const promptRow = document.getElementById('terminal-prompt-row');
            if (promptRow && promptRow.parentElement) {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'myinfo-password-line';
                lineDiv.textContent = '현재 비밀번호 >> ' + '*'.repeat(text.length);
                promptRow.parentElement.insertBefore(lineDiv, promptRow);
                promptRow.style.display = 'none';
            }

            const verified = await verifyCurrentPassword(targetUserId, text);
            if (promptRow) promptRow.style.display = '';

            if (!verified) {
                const failure = recordPasswordFailure('email-current');
                if (failure.reachedLimit) {
                    return await abortPasswordChange('현재 비밀번호 확인이 5회 실패하여 이메일 변경을 취소했습니다.');
                }
                clearMessage();
                appendTranscriptLine({ prompt: '현재 비밀번호가 올바르지 않습니다.', value: '' });
                setMode('email');
                setStage('email-current');
                await renderMyInfo(true);
                return false;
            }

            clearMessage();
            resetPasswordFailureCount('email-current');
            setDraft({ password: text });
            setMode('email');
            setStage('email-new');
            setHint('');
            setPrompt('새 이메일 >> ');
            await renderMyInfo(true);
            return true;
        }

        if (stage === 'email-new') {
            const nextEmail = normalizeEmail(text);
            if (!nextEmail) {
                clearMessage();
                appendTranscriptLine({ prompt: '이메일 형식이 올바르지 않습니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            const currentEmail = normalizeEmail(state.user?.email || '');
            if (currentEmail && nextEmail === currentEmail) {
                clearMessage();
                appendTranscriptLine({ prompt: '현재 이메일과 같습니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            appendTranscriptLine({ prompt: '새 이메일 >>', value: nextEmail });
            const promptRow = document.getElementById('terminal-prompt-row');
            if (promptRow && promptRow.parentElement) {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'myinfo-password-line';
                lineDiv.textContent = '새 이메일 >> ' + nextEmail;
                promptRow.parentElement.insertBefore(lineDiv, promptRow);
                promptRow.style.display = 'none';
            }

            let updated = null;
            try {
                updated = await apiFetch(`/api/members/${encodeURIComponent(targetUserId)}/email`, {
                    method: 'POST',
                    body: JSON.stringify({
                        email: nextEmail,
                        password: String(state._myInfoDraft?.password || '')
                    }),
                    silent: true
                });
            } catch (error) {
                console.error('[MyInfo] email change failed:', error.message);
                clearMessage();
                appendTranscriptLine({ prompt: error.message || '이메일을 변경하지 못했습니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            if (promptRow) promptRow.style.display = '';

            if (!updated) {
                clearMessage();
                appendTranscriptLine({ prompt: '이메일을 변경하지 못했습니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            if (updated?.verified === false) {
                clearMessage();
                clearDraft();
                appendTranscriptLine({ prompt: '현재 비밀번호가 올바르지 않습니다.', value: '' });
                setMode('email');
                setStage('email-current');
                setHint('');
                setPrompt('현재 비밀번호 >> ');
                await renderMyInfo(true);
                return false;
            }

            state.user.userId = updated.userId || state.user.userId;
            state.user.nickName = updated.nickName || state.user.nickName;
            state.user.email = updated.email || nextEmail;
            if (state.supabase && typeof doLogin === 'function') {
                try {
                    await doLogin(targetUserId, String(state._myInfoDraft?.password || ''));
                } catch (sessionError) {
                    console.error('[MyInfo] Email changed, but session refresh failed:', sessionError.message);
                }
            }
            resetPasswordFailureCount('email-current');
            resetMyInfoState();
            await showMyInfo(true, {
                mode: 'view',
                message: `이메일이 [${state.user.email}]로 변경되었습니다.`,
                messageType: 'notice',
                clearDraft: true
            });
            return true;
        }

        return false;
    }

    async function openPasswordChange() {
        if (!(await ensureMyInfoAccess())) {
            return;
        }
        resetPasswordFailureCount();
        clearMessage();
        clearDraft();
        clearTranscript();
        setMode('password');
        setStage('password-current');
        appendTranscriptLine({ prompt: '본인 확인을 위해 현재 비밀번호를 입력해 주십시오.', value: '' });
        setHint('');
        setPrompt('현재 비밀번호 >> ');
        await renderMyInfo(true);
    }

    async function submitPasswordChange(rawValue) {
        if (!(await ensureMyInfoAccess())) {
            return false;
        }

        const stage = getStage();
        const text = String(rawValue || '').trim();
        const targetUserId = String(state.user?.userId || '').trim();

        if (stage === 'password-current') {
            if (!text) {
                clearMessage();
                appendTranscriptLine({ prompt: '현재 비밀번호를 입력해 주십시오.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            appendTranscriptLine({ prompt: '현재 비밀번호 >>', value: '*'.repeat(text.length) }); // [LOG: 20260509_1013] 비밀번호 변경 입력은 트랜스크립트에 한 번만 남긴다.
            await renderMyInfo(true);
            const promptRow = document.getElementById('terminal-prompt-row');
            if (promptRow) {
                promptRow.style.display = 'none';
            }

            const verified = await verifyCurrentPassword(targetUserId, text);
            if (promptRow) {
                promptRow.style.display = '';
            }

            if (!verified) {
                const failure = recordPasswordFailure('password-current');
                if (failure.reachedLimit) {
                    return await abortPasswordChange('현재 비밀번호 확인이 5회 실패하여 비밀번호 변경을 취소했습니다.');
                }
                clearMessage();
                appendTranscriptLine({ prompt: '현재 비밀번호가 올바르지 않습니다.', value: '' });
                setMode('password');
                setStage('password-current');
                await renderMyInfo(true);
                return false;
            }

            clearMessage();
            resetPasswordFailureCount('password-current');
            clearDraft();
            setMode('password');
            setStage('password-new');
            setHint('새 비밀번호를 입력한 뒤 ENTER를 누르십시오.');
            setPrompt('새 비밀번호 >> ');
            await renderMyInfo(true);
            return true;
        }

        if (stage === 'password-new') {
            appendTranscriptLine({ prompt: '새 비밀번호 >>', value: '*'.repeat(text.length) }); // [LOG: 20260509_1013] 짧은 비밀번호도 먼저 입력 줄로 남긴 뒤 오류를 아래에 출력한다.
            if (text.length < 6) {
                clearMessage();
                appendTranscriptLine({ prompt: '비밀번호는 6자 이상이어야 합니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            setDraft({ password: text });
            resetPasswordFailureCount('password-confirm');
            clearMessage();
            setStage('password-confirm');
            setHint('새 비밀번호 확인을 입력한 뒤 ENTER를 누르십시오.');
            setPrompt('새 비밀번호 확인 >> ');
            await renderMyInfo(true);
            return true;
        }

        if (stage === 'password-confirm') {
            appendTranscriptLine({ prompt: '새 비밀번호 확인 >>', value: '*'.repeat(text.length) }); // [LOG: 20260509_1013] 확인 입력도 트랜스크립트 렌더링만 사용한다.

            if (text !== String(state._myInfoDraft?.password || '')) {
                const failure = recordPasswordFailure('password-confirm');
                if (failure.reachedLimit) {
                    return await abortPasswordChange('새 비밀번호 확인이 5회 일치하지 않아 비밀번호 변경을 취소했습니다.');
                }
                clearMessage();
                appendTranscriptLine({ prompt: '새 비밀번호가 서로 일치하지 않습니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            const normalizedPassword = text;
            setStage('password-saving'); // [LOG: 20260509_1024] API 처리 중 세 번째 `새 비밀번호 확인 >>` 프롬프트가 보이지 않도록 분리
            await renderMyInfo(true);
            const promptRow = document.getElementById('terminal-prompt-row');
            if (promptRow) {
                promptRow.style.display = 'none';
            }

            try {
                const updated = await apiFetch(`/api/members/${encodeURIComponent(targetUserId)}/password`, {
                    method: 'POST',
                    body: JSON.stringify({ password: normalizedPassword }),
                    silent: true
                });
                if (promptRow) {
                    promptRow.style.display = '';
                }
                if (!updated) {
                    clearMessage();
                    appendTranscriptLine({ prompt: '비밀번호를 변경하지 못했습니다.', value: '' });
                    setStage('password-confirm');
                    await renderMyInfo(true);
                    return false;
                }
                if (state.supabase && typeof doLogin === 'function') {
                    try {
                        await doLogin(targetUserId, normalizedPassword);
                    } catch (sessionError) {
                        console.error('[MyInfo] Password changed, but session refresh failed:', sessionError.message);
                        resetPasswordFailureCount();
                        resetMyInfoState();
                        await doLogout({ localOnly: true });
                        await showMain();
                        setHint('비밀번호는 변경되었지만 세션 갱신에 실패했습니다. 새 비밀번호로 다시 로그인해 주십시오.');
                        setPrompt('>> ');
                        return true;
                    }
                }
            } catch (error) {
                if (promptRow) {
                    promptRow.style.display = '';
                }
                console.error('[MyInfo] Password change failed:', error.message);
                clearMessage();
                appendTranscriptLine({ prompt: error.message || '비밀번호를 변경하지 못했습니다.', value: '' });
                setStage('password-confirm');
                await renderMyInfo(true);
                return false;
            }

            resetPasswordFailureCount();
            resetMyInfoState();
            await showMain();
            setHint('비밀번호가 성공적으로 변경되었습니다.');
            setPrompt('>> ');
            return true;
        }

        return false;
    }

    async function openDeleteAccount() {
        if (!(await ensureMyInfoAccess())) {
            return;
        }
        clearMessage();
        clearDraft();
        clearTranscript();
        resetPasswordFailureCount('delete-password');
        setMode('delete');
        setStage('delete-password');
        appendTranscriptLine({ prompt: '본인 확인을 위해 현재 비밀번호를 입력해 주십시오.', value: '' });
        setHint('');
        setPrompt('비밀번호 >> ');
        await renderMyInfo(true);
    }

    async function submitDeleteAccount(rawValue) {
        if (!(await ensureMyInfoAccess())) {
            return false;
        }

        const stage = getStage();
        const targetUserId = String(state.user?.userId || '').trim();

        if (stage === 'delete-password') {
            const password = String(rawValue || '').trim();
            if (!password) {
                clearMessage();
                appendTranscriptLine({ prompt: '비밀번호를 입력해 주십시오.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            appendTranscriptLine({ prompt: '비밀번호 >>', value: '*'.repeat(password.length) }); // [LOG: 20260509_1006] 검증 중에도 마스킹 입력은 트랜스크립트에 한 번만 남긴다.
            await renderMyInfo(true);
            const promptRow = document.getElementById('terminal-prompt-row');
            if (promptRow) {
                promptRow.style.display = 'none';
            }

            const verified = await verifyCurrentPassword(targetUserId, password);
            if (promptRow) {
                promptRow.style.display = '';
            }

            if (!verified) {
                const failure = recordPasswordFailure('delete-password');
                if (failure.reachedLimit) {
                    return await abortPasswordChange('현재 비밀번호 확인이 5회 실패하여 회원 탈퇴를 취소했습니다.');
                }
                clearMessage();
                appendTranscriptLine({ prompt: '비밀번호가 올바르지 않습니다.', value: '' });
                await renderMyInfo(true);
                return false;
            }

            setStage('delete-confirm');
            // [LOG: 20260509_1006] 최종 확인 질문은 트랜스크립트 중복 출력이 아니라 현재 프롬프트 한 줄로 렌더링한다.
            setHint('');
            setPrompt('정말로 탈퇴하시겠습니까?');
            await renderMyInfo(true);
            return true;
        }

        if (stage === 'delete-confirm') {
            const answer = String(rawValue || '').trim().toLowerCase() || 'y';
            appendTranscriptLine({ prompt: '정말로 탈퇴하시겠습니까? (Y/n)', value: answer });

            if (answer === 'y') {
                let response = null;
                try {
                    response = await apiFetch(`/api/members/${encodeURIComponent(targetUserId)}`, {
                        method: 'DELETE',
                        silent: true
                    });
                } catch (error) {
                    console.error('[MyInfo] delete account failed:', error.message);
                    setMessage(error.message || '회원 탈퇴를 처리하지 못했습니다.', 'error');
                    await renderMyInfo(true);
                    return false;
                }
                if (!response) {
                    setMessage('회원 탈퇴를 처리하지 못했습니다.', 'error');
                    await renderMyInfo(true);
                    return false;
                }

                resetPasswordFailureCount('delete-password');
                clearDraft();
                clearMessage();
                try {
                    await doLogout({ localOnly: true });
                } catch (error) {
                    console.error('[MyInfo] logout fallback after delete failed:', error.message);
                    state.token = '';
                    state.user = guestUser();
                }
                const authDeleteError = String(response.authDeleteError || '').trim();
                appendTranscriptLine({
                    prompt: authDeleteError
                        ? '회원 정보는 삭제됐지만 인증 계정 정리는 별도 확인이 필요합니다.'
                        : '회원 탈퇴가 완료되었습니다. 다시 이용하려면 회원가입 메뉴를 이용해 주십시오.',
                    value: ''
                }); // [LOG: 20260509_1146] 탈퇴 완료 메시지는 초기화면 footer가 아니라 완료 화면 본문에 남긴다.
                setMode('delete');
                setStage('delete-complete');
                state._maskCommandInput = false;
                setHint('');
                setPrompt('>> ');
                await renderMyInfo(true);
                return true;
            } else if (answer === 'n') {
                appendTranscriptLine({ prompt: '탈퇴를 취소했습니다.', value: '' });
                resetPasswordFailureCount('delete-password');
                resetMyInfoState();
                setHint('');
                setPrompt('>> ');
                await renderMyInfo(true);
                return true;
            } else {
                appendTranscriptLine({ prompt: 'y 또는 n을 입력해 주십시오.', value: '' });
                await renderMyInfo(true);
                return false;
            }
        }

        return false;
    }

    async function cancelMyInfoEdit() {
        if (!(await ensureMyInfoAccess())) {
            return;
        }
        resetPasswordFailureCount();
        resetMyInfoState();
        setHint('');
        setPrompt('>> ');
        await renderMyInfo(true);
    }

    async function logoutFromMyInfo() {
        resetMyInfoState();
        try {
            await doLogout();
        } catch (error) {
            console.error('[MyInfo] logout failed:', error.message);
            state.token = '';
            state.user = guestUser();
        }
        await showMain();
    }

    return {
        cancelMyInfoEdit,
        openDeleteAccount,
        openEmailChange,
        openNicknameChange,
        openPasswordChange,
        logoutFromMyInfo,
        showMyInfo,
        submitDeleteAccount,
        submitEmailChange,
        submitNicknameChange,
        submitPasswordChange
    };
}
