export function createMyInfoCommandHandler(deps) {
    const {
        cancelMyInfoEdit,
        logoutFromMyInfo,
        openDeleteAccount,
        openEmailChange,
        openNicknameChange,
        openPasswordChange,
        showMain,
        state,
        submitDeleteAccount,
        submitEmailChange,
        submitNicknameChange,
        submitPasswordChange
    } = deps;

    function isNavigationCommand(cmd) {
        return ['T', 'P', 'M', 'B', 'Q', 'X', 'EXIT', 'BYE', 'LOGOUT'].includes(String(cmd || '').trim().toUpperCase());
    }

    return async function handleMyInfoCommand({ input, rawCmd, cmd }) {
        if (state.screen !== 'myinfo') {
            return false;
        }

        const mode = String(state._myInfoMode || 'view').trim().toLowerCase();

        if (cmd === 'T') {
            await showMain();
            return true;
        }

        if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
            if (mode !== 'view') {
                await cancelMyInfoEdit();
                return true;
            }
            await showMain();
            return true;
        }

        if (cmd === '5' || cmd === 'Q' || cmd === 'LOGOUT' || cmd === 'EXIT' || cmd === 'BYE') {
            await logoutFromMyInfo();
            return true;
        }

        if (mode === 'view') {
            if (cmd === '1' || cmd === 'N' || cmd === 'NICK' || cmd === 'NICKNAME') {
                await openNicknameChange();
                return true;
            }
            if (cmd === '2' || cmd === 'E' || cmd === 'EMAIL' || cmd === 'MAIL') {
                await openEmailChange();
                return true;
            }
            if (cmd === '3' || cmd === 'PW' || cmd === 'PASSWORD') {
                await openPasswordChange();
                return true;
            }
            if (cmd === '4' || cmd === 'X' || cmd === 'DELETE') {
                await openDeleteAccount();
                return true;
            }
            return false;
        }

        const value = String(input || rawCmd || '').trim();
        const stage = String(state._myInfoStage || 'idle').trim().toLowerCase();
        // [LOG: 20260509_0959] 탈퇴 최종 확인은 빈 Enter도 기본값 y로 처리한다.
        if (mode === 'delete' && stage === 'delete-confirm') {
            return await submitDeleteAccount(value || 'y');
        }
        if (mode === 'delete' && stage === 'delete-complete') {
            // [LOG: 20260509_1146] 탈퇴 완료 안내를 확인한 뒤 Enter로 초기화면으로 이동한다.
            await showMain();
            return true;
        }

        if (!value || isNavigationCommand(cmd)) {
            return false;
        }

        if (mode === 'nickname') {
            return await submitNicknameChange(value);
        }

        if (mode === 'email') {
            await submitEmailChange(value);
            return true;
        }

        if (mode === 'password') {
            await submitPasswordChange(value);
            return true;
        }

        if (mode === 'delete') {
            return await submitDeleteAccount(value);
        }

        return false;
    };
}
