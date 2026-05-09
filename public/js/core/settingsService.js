/**
 * settingsService.js
 * [LOG: 20260426_2000] Evolution Mode: Centralized persistent settings management.
 */

const KEYS = {
  HISTORY: 'bbs_cmd_history',
  MUTED: 'bbs_muted',
  SCALE: 'bbs_terminal_scale',
  SCALE_MANUAL: 'bbs_terminal_scale_manual',
  THEME: 'bbs_theme',
  STATS: 'bbs_cmd_stats',
  WORKSPACES: 'bbs_workspaces',
  ALIASES: 'bbs_aliases',
  ENV_VARS: 'bbs_env_vars',
  VFS: 'bbs_vfs' // Added
};

export function createSettingsService(deps) {
  const { state } = deps;

  function loadSettings() {
    try {
      // 1. Command History
      const savedHistory = localStorage.getItem(KEYS.HISTORY);
      if (savedHistory) {
        state.cmdHistory = JSON.parse(savedHistory);
      } else {
        state.cmdHistory = [];
      }

      // 2. Mute State
      state.isMuted = localStorage.getItem(KEYS.MUTED) === 'true';

      // 3. Terminal Scale
      const savedScale = localStorage.getItem(KEYS.SCALE);
      if (savedScale) {
        state.terminalScale = parseFloat(savedScale);
      }

      // 4. Theme
      const savedTheme = localStorage.getItem(KEYS.THEME);
      if (savedTheme) {
        state.theme = savedTheme;
      }

      // 5. Command Stats
      const savedStats = localStorage.getItem(KEYS.STATS);
      state.cmdStats = savedStats ? JSON.parse(savedStats) : {};

      // 6. Workspaces
      const savedWorkspaces = localStorage.getItem(KEYS.WORKSPACES);
      if (savedWorkspaces) {
        try {
          const wsData = JSON.parse(savedWorkspaces);
          state.workspaces = wsData.list;
          state.activeWorkspaceId = wsData.activeId;
        } catch (e) {}
      }

      // 7. Aliases
      const savedAliases = localStorage.getItem(KEYS.ALIASES);
      state.aliases = savedAliases ? JSON.parse(savedAliases) : {};

      // 8. Environment Variables (VARS)
      const savedVars = localStorage.getItem(KEYS.ENV_VARS);
      state.envVars = savedVars ? JSON.parse(savedVars) : {
        PROMPT: '>>',
        SYSTEM_NAME: 'PC통신동호회 01410'
      };

      // 9. VFS (Virtual File System)
      const savedVfs = localStorage.getItem(KEYS.VFS);
      state.vfs = savedVfs ? JSON.parse(savedVfs) : {};
    } catch (e) {
      console.warn('[Settings] Failed to load settings:', e);
    }
  }

  /**
   * Loads VFS from storage.
   */
  function loadVfs() {
    try {
      const saved = localStorage.getItem(KEYS.VFS);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Saves VFS to storage.
   */
  function saveVfs(vfs) {
    try {
      localStorage.setItem(KEYS.VFS, JSON.stringify(vfs));
    } catch (e) {
      console.warn('[Settings] Failed to save VFS:', e);
    }
  }

  /**
   * Saves environment variables.
   * [LOG: 20260429_0000] Evolution Mode 22/500: Env Vars Persistence.
   */
  function saveEnvVars(vars) {
    try {
      localStorage.setItem(KEYS.ENV_VARS, JSON.stringify(vars));
    } catch (e) {
      console.warn('[Settings] Failed to save env vars:', e);
    }
  }

  /**
   * Saves command aliases.
   */
  function saveAliases(aliases) {
    try {
      localStorage.setItem(KEYS.ALIASES, JSON.stringify(aliases));
    } catch (e) {
      console.warn('[Settings] Failed to save aliases:', e);
    }
  }

  /**
   * Saves the current workspaces state.
   * [LOG: 20260428_1640] Evolution Mode 16/500: Workspace Persistence.
   */
  function saveWorkspaces(workspaces, activeId) {
    try {
      if (!workspaces) return;
      localStorage.setItem(KEYS.WORKSPACES, JSON.stringify({
        list: workspaces,
        activeId
      }));
    } catch (e) {
      console.warn('[Settings] Failed to save workspaces:', e);
    }
  }

  /**
   * Records command execution for analytics.
   * [LOG: 20260427_0220] Evolution Mode 6/500: Command Analytics.
   */
  function recordCommandExecution(cmd) {
    try {
      if (!cmd) return;
      const normalizedCmd = cmd.trim().toUpperCase().split(' ')[0];
      if (!normalizedCmd) return;

      if (!state.cmdStats) state.cmdStats = {};
      state.cmdStats[normalizedCmd] = (state.cmdStats[normalizedCmd] || 0) + 1;
      
      localStorage.setItem(KEYS.STATS, JSON.stringify(state.cmdStats));
    } catch (e) {
      console.warn('[Settings] Failed to record command execution:', e);
    }
  }

  /**
   * Saves the command history with metadata.
   * [LOG: 20260427_0125] Evolution Mode: Command History Metadata.
   */
  function saveHistory(cmd, screenContext) {
    try {
      if (!cmd) return;
      
      const entry = {
        cmd,
        screen: screenContext,
        ts: Date.now()
      };

      // Add to start of history
      state.cmdHistory = [entry, ...(state.cmdHistory || [])]
        .filter((v, i, a) => a.findIndex(t => t.cmd === v.cmd) === i) // Deduplicate
        .slice(0, 100); // Increase limit to 100

      localStorage.setItem(KEYS.HISTORY, JSON.stringify(state.cmdHistory));
    } catch (e) {
      console.warn('[Settings] Failed to save history:', e);
    }
  }

  function setMuted(muted) {
    state.isMuted = !!muted;
    localStorage.setItem(KEYS.MUTED, state.isMuted.toString());
  }

  function setScale(scale, isManual = true) {
    state.terminalScale = scale;
    localStorage.setItem(KEYS.SCALE, scale.toString());
    if (isManual) {
      localStorage.setItem(KEYS.SCALE_MANUAL, 'true');
    } else {
      localStorage.removeItem(KEYS.SCALE_MANUAL);
    }
  }

  function isManualScale() {
    return localStorage.getItem(KEYS.SCALE_MANUAL) === 'true';
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem(KEYS.THEME, theme);
  }

  return {
    loadSettings,
    saveHistory,
    saveWorkspaces,
    saveAliases,
    loadVfs,
    saveVfs,
    saveEnvVars, // Added
    recordCommandExecution,
    setMuted,
    setScale,
    isManualScale,
    setTheme,
    KEYS
  };
}
