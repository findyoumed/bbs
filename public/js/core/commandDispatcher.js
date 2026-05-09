import { createCommandDispatcherExecution } from './commandDispatcherExecution.js';
import { createCommandDispatcherScripting } from './commandDispatcherScripting.js';

/**
 * commandDispatcher.js
 * [LOG: 20260426_1700] Evolution Mode: Modular command dispatching system.
 * Extracts command handling logic from appFactory for better maintainability.
 */

export function createCommandDispatcher(deps) {
  const {
    state,
    terminalUiCore,
    logger,
    vfsService
  } = deps;

  let handleCmd = async () => false;
  const handleCmdRef = (...args) => handleCmd(...args);

  const { expandVariables, handleScriptingCommand } = createCommandDispatcherScripting({
    state,
    terminalUiCore,
    vfsService,
    handleCmd: handleCmdRef
  });

  const { executeSingleCommand } = createCommandDispatcherExecution({
    ...deps,
    handleCmd: handleCmdRef
  });

  /**
  * Orchestrates command execution, supporting batching (;), conditional (&&), 
  * piping (|), and redirection (>, >>) support.
  */
  handleCmd = async function handleCmdImpl(input, context = {}) {
    const rawInput = String(input || '').trim();
    if (!rawInput) {
      return await executeSingleCommand('', context);
    }

    // [LOG: 20260501_1000] Evolution Mode 26: Advanced Pipeline (Piping & Redirection)
    // 1. Split by sequential delimiters (; or &&)
    // [LOG: 20260502_2200] Evolution 34: Support sequence splitting while ignoring delimiters inside parentheses
    const sequences = [];
    let current = '', depth = 0;
    for (let i = 0; i < rawInput.length; i++) {
      const char = rawInput[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;

      if (depth === 0 && (char === ';' || (char === '&' && rawInput[i + 1] === '&'))) {
        if (current.trim()) sequences.push(current.trim());
        sequences.push(char === '&' ? '&&' : ';');
        if (char === '&') i++;
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) sequences.push(current.trim());

    let lastSuccess = true;
    for (let i = 0; i < sequences.length; i++) {
      if (context.halt || context.break) break;
      let sequence = sequences[i];
      if (sequence === ';' || sequence === '&&') continue;

      const isConditional = (i > 0 && sequences[i - 1] === '&&');
      if (isConditional && !lastSuccess) {
        if (logger) logger.info(`Skipping conditional sequence due to previous failure: ${sequence}`);
        break;
      }

      // 2. Handle Piping (|)
      const pipedCmds = sequence.split('|').map(s => s.trim()).filter(s => s);
      let pipedData = context.pipedData || null;

      // [LOG: 20260502_0300] Evolution Mode 31: Background Execution (&)
      const lastCmd = pipedCmds[pipedCmds.length - 1];
      let isBackground = false;
      if (lastCmd && lastCmd.endsWith('&')) {
        isBackground = true;
        pipedCmds[pipedCmds.length - 1] = lastCmd.slice(0, -1).trim();
      }

      if (isBackground) {
        const pid = Math.floor(Math.random() * 9000) + 1000;
        // [LOG: 20260503_1800] Evolution 37: Update last background PID ($!)
        if (!state.envVars) state.envVars = {};
        state.envVars['!'] = String(pid);

        const proc = {
          pid,
          cmd: sequence,
          status: 'RUNNING',
          startTime: Date.now()
        };
        if (!state.processes) state.processes = [];
        state.processes.push(proc);

        terminalUiCore.showNotification(`[${pid}] 백그라운드 작업 시작: ${sequence}`);

        // Execute in background
        (async () => {
          try {
            await executePipeChain(pipedCmds, { ...context, pipedData, pid });
            const p = state.processes.find(p => p.pid === pid);
            if (p) p.status = 'COMPLETED';
            terminalUiCore.showNotification(`[${pid}] 작업 완료: ${sequence}`);
          } catch (e) {
            const p = state.processes.find(p => p.pid === pid);
            if (p) p.status = 'FAILED';
            terminalUiCore.showError(`[${pid}] 작업 실패: ${sequence} (${e.message})`);
          }
        })();

        lastSuccess = true;
        continue;
      }

      const result = await executePipeChain(pipedCmds, { ...context, pipedData });

      // [LOG: 20260503_1800] Evolution 37: Update last status variable ($?)
      if (!state.envVars) state.envVars = {};
      state.envVars['?'] = result.success ? '0' : '1';

      // [LOG: 20260503_1400] Evolution Mode 36: TRACE execution logging
      if (state.trace && sequence !== 'TRACE OFF') {
        terminalUiCore.showNotification(`[TRACE] ${sequence} -> ${result.success ? 'OK' : 'FAIL'}`, 3000, 'info');
      }

      lastSuccess = result.success;
      if (result.halt) {
        context.halt = true;
        break;
      }
      if (result.break) {
        context.break = true;
        break;
      }
      if (result.continue) {
        context.continue = true;
        break;
      }
    }

    return lastSuccess;
  };

  async function executePipeChain(pipedCmds, context) {
    let pipedData = context.pipedData || null;
    let lastSuccess = true;

    for (let j = 0; j < pipedCmds.length; j++) {
      if (context.halt || context.break || context.continue) break;
      const cmdPart = pipedCmds[j];

      // Handle Redirection (>, >>) at the end of this command part
      const redirMatch = cmdPart.match(/(.+?)\s*(>>|>)\s*(.+)$/);
      let redirType = null;
      let redirFile = null;
      let actualCmd = cmdPart;

      if (redirMatch) {
        actualCmd = redirMatch[1].trim();
        redirType = redirMatch[2];
        redirFile = redirMatch[3].trim();
      }

      // Expand variables before execution
      const expandedCmd = expandVariables(actualCmd, { ...context, pipedData });

      // Special Scripting Commands
      // [LOG: 20260502_2200] Pass actualCmd (unexpanded) to support dynamic loop conditions
      if (await handleScriptingCommand(expandedCmd, context, actualCmd)) {
        lastSuccess = true;
        continue;
      }

      // Execute and capture output
      const executionResult = await executeWithCapture(expandedCmd, {
        ...context,
        pipedData,
        quiet: j < pipedCmds.length - 1 || redirType !== null
      });

      lastSuccess = executionResult.success;
      pipedData = executionResult.output;

      // Apply redirection if specified
      if (redirType && redirFile) {
        const { vfsService } = deps;
        if (vfsService) {
          if (redirType === '>>') {
            vfsService.appendFile(redirFile, pipedData);
          } else {
            vfsService.writeFile(redirFile, pipedData);
          }
          if (logger) logger.info(`Redirected output to ${redirFile} (${redirType})`);
        }
      }
    }
    return {
      success: lastSuccess,
      halt: context.halt,
      break: context.break,
      continue: context.continue
    };
  }

  async function executeWithCapture(cmd, context = {}) {
    let output = '';
    const capture = (text) => {
      if (text) output += (output ? '\n' : '') + text;
    };

    const originalListener = terminalUiCore.getOutputListener ? terminalUiCore.getOutputListener() : null;
    terminalUiCore.setOutputListener(capture);

    try {
      const success = await executeSingleCommand(cmd, context);
      return { success, output };
    } finally {
      terminalUiCore.setOutputListener(originalListener);
    }
  }

  return { handleCmd };
}
