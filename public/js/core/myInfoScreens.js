import { createMyInfoActions } from './myInfoActions.js';
import { createMyInfoRenderer } from './myInfoRenderer.js';
import { createMyInfoState } from './myInfoState.js';

export function createMyInfoScreens(deps) {
    const {
        apiFetch,
        doLogin,
        doLogout,
        guestUser,
        setHint,
        setPrompt,
        showMain,
        state
    } = deps;

    const myInfoState = createMyInfoState(state);
    let myInfoActions = null;

    const { renderMyInfo } = createMyInfoRenderer({
        ...deps,
        ...myInfoState,
        getActions: () => myInfoActions
    });

    myInfoActions = createMyInfoActions({
        apiFetch,
        doLogin,
        doLogout,
        guestUser,
        renderMyInfo,
        setHint,
        setPrompt,
        showMain,
        state,
        ...myInfoState
    });

    return myInfoActions;
}
