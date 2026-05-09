export function createCommandDispatcherScripting(deps) {
  const {
    state,
    terminalUiCore,
    vfsService,
    handleCmd
  } = deps;

  async function evaluateCondition(cond) {
    if (cond.startsWith('-f ')) {
      const filename = cond.slice(3).trim();
      return vfsService && vfsService.getFile(filename) !== null;
    }

    const compMatch = cond.match(/(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)/);
    if (compMatch) {
      const left = compMatch[1].trim();
      const op = compMatch[2];
      const right = compMatch[3].trim();

      const nLeft = parseFloat(left);
      const nRight = parseFloat(right);
      if (!Number.isNaN(nLeft) && !Number.isNaN(nRight) && !Number.isNaN(left) && !Number.isNaN(right)) {
        if (op === '==') return nLeft === nRight;
        if (op === '!=') return nLeft !== nRight;
        if (op === '>=') return nLeft >= nRight;
        if (op === '<=') return nLeft <= nRight;
        if (op === '>') return nLeft > nRight;
        if (op === '<') return nLeft < nRight;
      }

      if (op === '==') return left === right;
      if (op === '!=') return left !== right;
      if (op === '>') return left > right;
      if (op === '<') return left < right;
    }

    return !!cond;
  }

  function expandVariables(text, context = {}) {
    let result = text;
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (context.args && Array.isArray(context.args)) {
      context.args.forEach((arg, index) => {
        const regex = new RegExp(`\\$${index + 1}(?![0-9])`, 'g');
        result = result.replace(regex, arg);
      });
    }

    if (context.vars) {
      for (const key in context.vars) {
        const value = context.vars[key];
        const escapedKey = escapeRegExp(key);
        result = result.replace(new RegExp(`\\$${escapedKey}(?![a-zA-Z0-9_])`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${escapedKey}\\}`, 'g'), value);
      }
    }

    if (context.pipedData !== undefined && context.pipedData !== null) {
      result = result.replace(/\$INPUT/g, context.pipedData);
    }

    const now = new Date();
    const systemVars = {
      USER: state.user?.userId || 'GUEST',
      SCREEN: state.screen || 'NONE',
      BOARD: state.board?.id || 'NONE',
      DATE: now.toLocaleDateString(),
      TIME: now.toLocaleTimeString(),
      RAND: Math.floor(Math.random() * 1000)
    };

    for (const [key, value] of Object.entries(systemVars)) {
      const escapedKey = escapeRegExp(key);
      result = result.replace(new RegExp(`\\$${escapedKey}(?![a-zA-Z0-9_])`, 'g'), value);
      result = result.replace(new RegExp(`\\$\\{${escapedKey}\\}`, 'g'), value);
    }

    if (state.envVars) {
      for (const key in state.envVars) {
        const value = state.envVars[key];
        const escapedKey = escapeRegExp(key);
        result = result.replace(new RegExp(`\\$${escapedKey}(?![a-zA-Z0-9_])`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${escapedKey}\\}`, 'g'), value);
      }
    }

    return result;
  }

  async function handleScriptingCommand(token, context, rawToken) {
    const tryMatch = token.match(/^TRY\s+\((.+?)\)(?:\s+CATCH\s+\((.+?)\))?(?:\s+FINALLY\s+\((.+?)\))?$/i);
    if (tryMatch) {
      const tryCmd = tryMatch[1];
      const catchCmd = tryMatch[2];
      const finallyCmd = tryMatch[3];

      let success = false;
      try {
        success = await handleCmd(tryCmd, { ...context, halt: false });
        if (!success) {
          throw new Error(`Command failed with status ${state.envVars['?'] || '1'}`);
        }
      } catch (error) {
        if (!state.envVars) state.envVars = {};
        state.envVars.ERROR = error.message;
        if (catchCmd) {
          await handleCmd(catchCmd, { ...context, halt: false });
        }
      } finally {
        if (finallyCmd) {
          await handleCmd(finallyCmd, { ...context, halt: false });
        }
      }
      return true;
    }

    const waitMatch = token.match(/^(WAIT|SLEEP)\s+(\d+)$/i);
    if (waitMatch) {
      const ms = parseInt(waitMatch[2], 10);
      await new Promise((resolve) => setTimeout(resolve, ms));
      return true;
    }

    const repeatMatch = token.match(/^REPEAT\s+(\d+)\s+(.+)$/i);
    if (repeatMatch) {
      const count = Math.min(parseInt(repeatMatch[1], 10), 1000);
      const subCmd = repeatMatch[2];
      for (let index = 0; index < count; index += 1) {
        if (context.halt) break;
        const loopCtx = { ...context, break: false, continue: false };
        await handleCmd(subCmd, loopCtx);
        if (loopCtx.halt) { context.halt = true; break; }
        if (loopCtx.break) break;
      }
      return true;
    }

    const whileMatch = (rawToken || token).match(/^WHILE\s+(.+?)\s+(?:DO\s+)?(.+)$/i);
    if (whileMatch) {
      const cond = whileMatch[1].trim();
      const subCmd = whileMatch[2].trim();
      let safety = 0;
      while (await evaluateCondition(expandVariables(cond, context))) {
        if (context.halt || safety++ > 1000) break;
        const loopCtx = { ...context, break: false, continue: false };
        await handleCmd(subCmd, loopCtx);
        if (loopCtx.halt) { context.halt = true; break; }
        if (loopCtx.break) break;
      }
      return true;
    }

    const forMatch = (rawToken || token).match(/^FOR\s+([a-zA-Z0-9_]+)\s+(\d+)\s+(\d+)\s+(.+)$/i);
    if (forMatch) {
      const varName = forMatch[1];
      const start = parseInt(forMatch[2], 10);
      const end = parseInt(forMatch[3], 10);
      const subCmd = forMatch[4].trim();

      const step = start <= end ? 1 : -1;
      let count = 0;
      for (let index = start; (step > 0 ? index <= end : index >= end); index += step) {
        if (context.halt || count++ > 1000) break;
        const loopCtx = {
          ...context,
          break: false,
          continue: false,
          vars: { ...(context.vars || {}), [varName]: String(index) }
        };
        await handleCmd(subCmd, loopCtx);
        if (loopCtx.halt) { context.halt = true; break; }
        if (loopCtx.break) break;
      }
      return true;
    }

    const funcMatch = (rawToken || token).match(/^FUNC\s+([a-zA-Z0-9_]+)\s+\((.+)\)$/i);
    if (funcMatch) {
      const name = funcMatch[1].toUpperCase();
      const body = funcMatch[2].trim();
      if (!state.functions) state.functions = {};
      state.functions[name] = body;
      terminalUiCore.showNotification(`함수 [${name}] 가 정의되었습니다.`);
      return true;
    }

    const callMatch = token.match(/^CALL\s+([a-zA-Z0-9_]+)(?:\s+(.+))?$/i);
    if (callMatch) {
      const name = callMatch[1].toUpperCase();
      const argsStr = callMatch[2] || '';
      const args = argsStr.split(/\s+/).filter((arg) => arg);
      const body = state.functions ? state.functions[name] : null;

      if (!body) {
        terminalUiCore.showError(`함수 [${name}] 을 찾을 수 없습니다.`);
        return true;
      }

      const callCtx = { ...context, args, isScript: true, break: false, continue: false };
      await handleCmd(body, callCtx);
      return true;
    }

    if (token.toUpperCase() === 'RETURN') {
      context.halt = true;
      return true;
    }

    if (token.toUpperCase() === 'BREAK') {
      context.break = true;
      return true;
    }

    if (token.toUpperCase() === 'CONTINUE') {
      context.continue = true;
      return true;
    }

    const ifMatch = token.match(/^IF\s+(.+?)\s+(?:THEN\s+)?(.+)$/i);
    if (ifMatch) {
      const cond = ifMatch[1].trim();
      const subCmd = ifMatch[2].trim();
      if (await evaluateCondition(cond)) {
        await handleCmd(subCmd, context);
      }
      return true;
    }

    if (token.toUpperCase() === 'EXIT' && (context.args || context.isScript || context.pipedData)) {
      context.halt = true;
      return true;
    }

    if (token.toUpperCase() === 'ECHO' || token.toUpperCase().startsWith('ECHO ')) {
      terminalUiCore.showNotification(token.slice(4).trim() || ' ');
      return true;
    }

    return false;
  }

  return {
    expandVariables,
    handleScriptingCommand
  };
}
