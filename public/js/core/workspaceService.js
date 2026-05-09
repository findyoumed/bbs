/**
 * workspaceService.js
 * [LOG: 20260428_1400] Evolution Mode 15/500: Multi-Workspace System.
 * Manages multiple navigation sessions (workspaces) within the terminal.
 */

export function createWorkspaceService(deps) {
  const { state, routingModule, logger, saveWorkspaces } = deps;

  // Max number of workspaces
  const MAX_WORKSPACES = 9;

  /**
   * Snapshot of a workspace state.
   */
  function createSnapshot() {
    return {
      screen: state.screen,
      board: state.board ? { ...state.board } : null,
      post: state.post ? { ...state.post } : null,
      page: state.page,
      boardMenuPath: state.boardMenuPath,
      boardMenuTitle: state.boardMenuTitle,
      serviceData: state.serviceData ? { ...state.serviceData } : null,
      writeMode: state.writeMode,
      _signupFlow: state._signupFlow,
      _chatRoomId: state._chatRoomId,
      _profileUserId: state._profileUserId,
      _currentMemoId: state._currentMemoId,
      history: [...(state.history || [])]
    };
  }

  function applySnapshot(snapshot) {
    if (!snapshot) return;
    
    state.screen = snapshot.screen;
    state.board = snapshot.board;
    state.post = snapshot.post;
    state.page = snapshot.page;
    state.boardMenuPath = snapshot.boardMenuPath;
    state.boardMenuTitle = snapshot.boardMenuTitle;
    state.serviceData = snapshot.serviceData;
    state.writeMode = snapshot.writeMode;
    state._signupFlow = snapshot._signupFlow;
    state._chatRoomId = snapshot._chatRoomId;
    state._profileUserId = snapshot._profileUserId;
    state._currentMemoId = snapshot._currentMemoId;
    state.history = snapshot.history;
  }

  function init() {
    if (!state.workspaces || state.workspaces.length === 0) {
      state.workspaces = [
        { id: 1, name: 'Main', snapshot: createSnapshot(), active: true }
      ];
      state.activeWorkspaceId = 1;
    } else {
      // If loaded from persistence, ensure active workspace is applied
      const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId);
      if (ws) {
        applySnapshot(ws.snapshot);
      }
    }
  }

  function triggerSave() {
    if (typeof saveWorkspaces === 'function') {
      saveWorkspaces(state.workspaces, state.activeWorkspaceId);
    }
  }

  async function switchWorkspace(id) {
    const targetId = Number(id);
    if (targetId === state.activeWorkspaceId) return;

    const ws = state.workspaces.find(w => w.id === targetId);
    if (!ws) return false;

    // 1. Save current workspace
    const currentWs = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (currentWs) {
      currentWs.snapshot = createSnapshot();
      currentWs.active = false;
    }

    // 2. Restore target workspace
    applySnapshot(ws.snapshot);
    ws.active = true;
    state.activeWorkspaceId = targetId;

    if (logger) logger.info(`Switched to workspace [${targetId}] ${ws.name}`);

    // 3. Update URL and Screen
    if (routingModule && routingModule.updateURL) {
      await routingModule.updateURL(true);
    }
    
    triggerSave();
    return true;
  }

  function addWorkspace(name = '') {
    if (state.workspaces.length >= MAX_WORKSPACES) return null;

    const nextId = Math.max(0, ...state.workspaces.map(w => w.id)) + 1;
    const newWs = {
      id: nextId,
      name: name || `WS ${nextId}`,
      snapshot: createSnapshot(),
      active: false
    };
    state.workspaces.push(newWs);
    if (logger) logger.info(`Created new workspace [${nextId}] ${newWs.name}`);
    
    triggerSave();
    return newWs;
  }

  function removeWorkspace(id) {
    const targetId = Number(id);
    if (state.workspaces.length <= 1) return false;

    const index = state.workspaces.findIndex(w => w.id === targetId);
    if (index === -1) return false;

    const removed = state.workspaces.splice(index, 1)[0];
    
    if (state.activeWorkspaceId === targetId) {
      const nextWs = state.workspaces[0];
      void switchWorkspace(nextWs.id);
    }

    if (logger) logger.info(`Removed workspace [${targetId}] ${removed.name}`);
    
    triggerSave();
    return true;
  }

  return {
    init,
    switchWorkspace,
    addWorkspace,
    removeWorkspace,
    getWorkspaces: () => state.workspaces,
    getActiveId: () => state.activeWorkspaceId,
    saveCurrentState: () => {
      const currentWs = state.workspaces.find(w => w.id === state.activeWorkspaceId);
      if (currentWs) {
        currentWs.snapshot = createSnapshot();
        triggerSave();
      }
    }
  };
}
