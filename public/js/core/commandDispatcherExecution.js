import { normalizeCommand } from './commandNormalizer.js';

const HISTORY_BACK_SCREENS = new Set([
  'help',
  'history',
  'profile',
  'active-users',
  'activity-summary',
  'system-diagnostics',
  'system-log'
]);

// [LOG: 20260429_0440] Pending board search prompts show examples like `LT foo` / `LI bar`.
// Normalize that follow-up input back to the actual keyword so prompt-mode searches do not miss results.
function normalizePendingSearchInput(searchType, rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) {
    return '';
  }

  if (searchType === 'lt') {
    const match = input.match(/^LT\s+(.+)$/i);
    return match ? match[1].trim() : input;
  }

  if (searchType === 'li') {
    const match = input.match(/^LI\s+(.+)$/i);
    return match ? match[1].trim() : input;
  }

  return input;
}

function isSensitiveCommandInput(state) {
  // [LOG: 20260507_1735] Masked prompt input must never be written to command logs.
  if (state?._maskCommandInput === true) {
    return true;
  }

  const screen = String(state?.screen || '').trim().toLowerCase();
  if (screen !== 'myinfo') {
    return false;
  }

  const mode = String(state?._myInfoMode || '').trim().toLowerCase();
  const stage = String(state?._myInfoStage || '').trim().toLowerCase();
  if (mode === 'email') return stage === 'email-current';
  if (mode === 'password') return ['password-current', 'password-new', 'password-confirm'].includes(stage);
  if (mode === 'delete') return stage === 'delete-password';
  return false;
}

export function createCommandDispatcherExecution(deps) {
  const {
    state,
    terminalUiCore,
    statusManager,
    soundService,
    recordCommandExecution,
    logger,
    aliasService,
    handlers: {
      handleGlobalCommand,
      handleEntryCommand,
      handleBrowseCommand,
      handleServiceCommand,
      handleChatCommand,
      handleMemoCommand,
      handleMyInfoCommand,
      handlePostViewCommand,
      handleVfsCommand,
      handleLogCommand
    },
    screens: {
      showMain,
      handleHistoryBack,
      postScreens
    },
    setPrompt,
    handleCmd
  } = deps;

  async function executeSingleCommand(rawInput, context = {}) {
    const input = String(rawInput || '').trim();
    const sensitiveInput = isSensitiveCommandInput(state);
    const expandedInput = sensitiveInput ? input : (aliasService ? aliasService.expand(input) : input);
    const normalized = normalizeCommand(expandedInput, state.screen);
    const cmd = normalized.toUpperCase();
    const screen = state.screen;

    if (logger && input) {
      const logInput = sensitiveInput ? '[REDACTED]' : input;
      const logExpandedInput = sensitiveInput ? '[REDACTED]' : expandedInput;
      const logNormalized = sensitiveInput ? '[REDACTED]' : cmd;
      logger.cmd(`Command: ${logInput} (expanded: ${logExpandedInput}, norm: ${logNormalized})`, {
        screen,
        rawInput: logInput,
        expandedInput: logExpandedInput,
        normalized: logNormalized,
        sensitive: sensitiveInput
      });
    }

    const dispatcherPipeline = [
      async () => {
        if (!state._pendingSearch) return false;
        const search = state._pendingSearch;
        state._pendingSearch = null;
        const searchInput = normalizePendingSearchInput(search.type, input);

        if (!searchInput) {
          await postScreens.showPostList(search.boardId, 1, {
            menuPath: search.menuPath,
            menuTitle: search.menuTitle,
            searchParams: {}
          });
          return true;
        }

        await postScreens.showPostList(search.boardId, 1, {
          menuPath: search.menuPath,
          menuTitle: search.menuTitle,
          searchParams: { [search.type]: searchInput }
        });
        return true;
      },
      async () => {
        if (input) return false;
        return (await handleBrowseCommand({ s: screen, input, cmd, rawCmd: normalized, context }))
          || (await handleServiceCommand({ s: screen, cmd, rawCmd: normalized, context }))
          || (await handleGlobalCommand({ s: screen, cmd, rawCmd: normalized, context }));
      },
      // [LOG: 20260506_1315] Screen-local navigation commands like B/F must win
      // over global command handling so page navigation does not leak into menu navigation.
      async () => await handleBrowseCommand({ s: screen, input, cmd, rawCmd: normalized, context }),
      async () => await handleServiceCommand({ s: screen, cmd, rawCmd: normalized, context }),
      async () => input && await handleGlobalCommand({ cmd, rawCmd: normalized, context }),
      async () => input && await handleVfsCommand({ cmd, rawCmd: normalized, context }),
      async () => await handleEntryCommand({ s: screen, cmd, context }),
      async () => HISTORY_BACK_SCREENS.has(screen) && ['P', 'M', 'B'].includes(cmd) && (await handleHistoryBack(), true),
      async () => HISTORY_BACK_SCREENS.has(screen) && cmd === 'T' && (await showMain(), true),
      async () => await handleChatCommand({ input, rawCmd: normalized, cmd, context }),
      async () => await handleMemoCommand({ input, rawCmd: normalized, cmd, context }),
      async () => await handleMyInfoCommand({ input, rawCmd: normalized, cmd, context }),
      async () => await handlePostViewCommand({ cmd, context }),
      async () => screen === 'system-log' && (await handleLogCommand(cmd, context))
    ];

    try {
      let handled = false;
      for (const execute of dispatcherPipeline) {
        if (!(await execute())) {
          continue;
        }

        handled = true;
        if (!context.quiet) {
          soundService.playBeep();
        }
        if (!sensitiveInput && typeof recordCommandExecution === 'function') {
          recordCommandExecution(cmd);
        }
        break;
      }

      if (statusManager) {
        statusManager.update();
      }

      if (!handled && input && !['F', 'B', 'P', 'M', 'T', 'Z'].includes(cmd)) {
        // [LOG: 20260507_1510] PC통신 UI에는 unknown-command footer feedback이 없으므로 조용히 무시한다.
        return false;
      }

      return handled;
    } catch (error) {
      console.error('[Dispatcher] Error processing command:', error);
      terminalUiCore.showError(`오류: ${error.message}`);
      setPrompt('>>');
      return false;
    }
  }

  return {
    executeSingleCommand
  };
}
