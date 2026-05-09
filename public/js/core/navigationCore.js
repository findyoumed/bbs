/**
 * [LOG: 20260410_2350] 내비게이션 시스템 코어
 */
export function createNavigationCore(deps) {
    const {
        state,
        normalizeSearchKey,
        getMenuChildren,
        getMenuNodeByKey,
        getMenuNodeKey,
        getMenuNodeTitle,
        getMenuParentNode,
        resolveMenuNodeTarget,
        resolveAnyMenuNodeTarget,
        executeMenuNodeAction: executeMenuNodeActionProxy, // 순기능 참조를 위해 프록시 사용
        resolveBoardTarget,
        getBoardMenuPath,
        getBoardSelectTitle,
        getBoardKey,
        showPostList,
        showMain,
        showBoardSelect,
        showNewsMenu,
        showWeatherMenu,
        showChatLobby,
        showLogin,
        showPasswordReset,
        startOAuthLogin,
        showSignup,
        showMyInfo,
        setHint,
        setPrompt,
        cmdInput,
        screenEl
    } = deps;

    /**
     * Jump to Content: Quickly scrolls to the content area (skipping header)
     * [LOG: 20260427_1240] Evolution: Added for better accessibility and mobile UX.
     */
    function jumpToContent() {
        if (!screenEl) return;
        const topbar = screenEl.querySelector('.retro-topbar');
        if (topbar) {
            const rect = topbar.getBoundingClientRect();
            screenEl.scrollTop = topbar.offsetTop + topbar.offsetHeight;
        } else {
            screenEl.scrollTop = 0;
        }
    }

    async function executeGoCommand(rawCmd) {
        const match = String(rawCmd || '').trim().match(/^GO\s+(.+)$/i);
        if (!match) return false;

        const target = match[1].trim();
        const normalized = normalizeSearchKey(target);
        if (normalized === 'TOP') {
            await showMain();
            return true;
        }

        const currentMenuNode = state.screen === 'main'
            ? state.menuTree
            : getMenuNodeByKey(state.boardMenuPath);
        const localTargetNode = resolveMenuNodeTarget(target, getMenuChildren(currentMenuNode));
        const targetNode = localTargetNode || resolveAnyMenuNodeTarget(target);
        if (targetNode) {
            const contextNode = localTargetNode ? currentMenuNode : getMenuParentNode(targetNode);
            await executeMenuNodeAction(
                targetNode,
                getMenuNodeKey(contextNode) || 'top',
                getMenuNodeTitle(contextNode || state.menuTree)
            );
            return true;
        }

        const contextBoards = state.screen === 'board-select' ? state.boardMenuEntries : state.boards;
        const targetBoard = resolveBoardTarget(target, contextBoards) || resolveBoardTarget(target, state.boards);
        if (!targetBoard) return false;

        const menuPathForBoard = state.screen === 'board-select'
            ? state.boardMenuPath
            : getBoardMenuPath(targetBoard);
        const menuTitleForBoard = state.screen === 'board-select'
            ? state.boardMenuTitle
            : getBoardSelectTitle(menuPathForBoard);
        await showPostList(getBoardKey(targetBoard), 1, {
            menuPath: menuPathForBoard,
            menuTitle: menuTitleForBoard,
        });
        return true;
    }

    async function executeMenuNodeAction(node, menuPath = '', menuTitle = '') {
        if (!node) return false;

        const nodeKey = getMenuNodeKey(node);
        const parentNode = getMenuParentNode(node);
        const contextMenuPath = String(menuPath || getMenuNodeKey(parentNode) || 'top').trim() || 'top';
        const contextMenuTitle = String(menuTitle || getMenuNodeTitle(parentNode || state.menuTree)).trim() || getBoardSelectTitle('top');
        const targetId = String(node?.go || node?.id || '').trim();

        if (node.type === 'menu') {
            await showBoardSelect(nodeKey, getMenuNodeTitle(node));
            return true;
        }

        if (node.type === 'board' && targetId) {
            await showPostList(targetId, 1, {
                menuPath: contextMenuPath,
                menuTitle: contextMenuTitle,
            });
            return true;
        }

        if (node.type === 'news') {
            state.boardMenuPath = contextMenuPath;
            state.boardMenuTitle = contextMenuTitle;
            await showNewsMenu();
            return true;
        }

        if (node.type === 'weather') {
            state.boardMenuPath = contextMenuPath;
            state.boardMenuTitle = contextMenuTitle;
            await showWeatherMenu();
            return true;
        }

        if (node.type === 'chatt') {
            await showChatLobby();
            return true;
        }

        if (node.type === 'login') {
            showLogin();
            return true;
        }

        if (node.type === 'password-reset') {
            showPasswordReset();
            return true;
        }

        if (node.type === 'oauth-login') {
            const provider = String(node?.go || '').trim().toLowerCase();
            try {
                setHint(`${getMenuNodeTitle(node)} 인증 페이지로 이동합니다.`);
                setPrompt('>>');
                await startOAuthLogin(provider);
            } catch (error) {
                setHint(error.message || '소셜 로그인을 시작할 수 없습니다.');
                setPrompt('>>');
                cmdInput.focus();
            }
            return true;
        }

        if (node.type === 'signup') {
            await showSignup();
            return true;
        }

        if (node.type === 'myinfo') {
            showMyInfo();
            return true;
        }

        return false;
    }

    return { executeGoCommand, executeMenuNodeAction };
}
