export function createGlobalScriptingCommandHandler(deps) {
  const {
    state,
    setHint,
    setPrompt
  } = deps;

  function ensureEnvVars() {
    if (!state.envVars) {
      state.envVars = {};
    }
    return state.envVars;
  }

  function setDefaultPrompt() {
    setPrompt('>>');
  }

  function splitCommand(rawCmd) {
    return String(rawCmd || '').trim().split(/\s+/);
  }

  return async function handleGlobalScriptingCommand({ cmd, rawCmd }) {
    if (cmd === 'MATH') {
      const parts = splitCommand(rawCmd);
      const varName = (parts[1] || '').toUpperCase();
      const expr = parts.slice(2).join(' ');
      const { settingsService } = deps;
      const envVars = ensureEnvVars();

      if (!varName || !expr) {
        setHint('사용법: MATH [변수명] [수식]\n예: MATH X $X + 1\n예: MATH RES (10 + 20) * 2');
        setDefaultPrompt();
        return true;
      }

      if (/^[0-9+\-*/%().\s]+$/.test(expr)) {
        try {
          // eslint-disable-next-line no-eval
          const result = eval(expr);
          envVars[varName] = String(result);
          setHint(`계산 결과: ${varName} = ${result}`);
          if (settingsService) {
            settingsService.saveEnvVars(envVars);
          }
        } catch (error) {
          setHint(`MATH 오류: ${error.message}`);
        }
      } else {
        setHint(`MATH 오류: 허용되지 않은 문자 포함 (${expr})`);
      }

      setDefaultPrompt();
      return true;
    }

    if (cmd === 'READ') {
      const parts = splitCommand(rawCmd);
      const varName = (parts[1] || '').toUpperCase();
      const promptText = parts.slice(2).join(' ') || `${varName} >> `;

      if (!varName) {
        setHint('사용법: READ [변수명] [프롬프트 메시지]');
        setDefaultPrompt();
        return true;
      }

      const userInput = await deps.showPrompt(promptText);
      if (userInput !== null) {
        const envVars = ensureEnvVars();
        envVars[varName] = userInput;
        setHint(`환경 변수 [${varName}] 에 '${userInput}' 이 저장되었습니다.`);
      }
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'TRAP') {
      const parts = splitCommand(rawCmd);
      const trapCmd = parts.slice(1, -1).join(' ').replace(/^\((.+)\)$/, '$1');
      const signal = (parts[parts.length - 1] || '').toUpperCase();

      if (!signal || !trapCmd) {
        setHint('사용법: TRAP (명령어) [SIGNAL]\n예: TRAP (ECHO Script Exit) EXIT');
      } else {
        if (!state.traps) {
          state.traps = {};
        }
        state.traps[signal] = trapCmd;
        setHint(`시그널 [${signal}] 핸들러가 등록되었습니다.`);
      }
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'WAITPID') {
      const parts = splitCommand(rawCmd);
      const pid = parseInt(parts[1], 10);

      if (Number.isNaN(pid)) {
        setHint('사용법: WAITPID [PID]');
      } else {
        const proc = state.processes?.find((processInfo) => processInfo.pid === pid);
        if (!proc || proc.status !== 'RUNNING') {
          setHint(`프로세스 [${pid}]가 이미 종료되었거나 존재하지 않습니다.`);
        } else {
          setHint(`프로세스 [${pid}]가 종료될 때까지 대기합니다...`);
          while (proc.status === 'RUNNING') {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          setHint(`프로세스 [${pid}]가 종료되었습니다.`);
        }
      }

      setDefaultPrompt();
      return true;
    }

    if (cmd === 'JOBS') {
      const processes = state.processes || [];
      if (processes.length === 0) {
        setHint('현재 실행 중인 백그라운드 작업이 없습니다.');
      } else {
        let list = 'PID    상태       작업\n';
        list += '------------------------------------\n';
        processes.forEach((processInfo) => {
          const pid = String(processInfo.pid).padEnd(6);
          const status = processInfo.status.padEnd(10);
          list += `${pid} ${status} ${processInfo.cmd}\n`;
        });
        setHint(`백그라운드 작업 목록:\n${list}`);
      }
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'KILL') {
      const pid = parseInt(splitCommand(rawCmd)[1], 10);
      if (Number.isNaN(pid)) {
        setHint('사용법: KILL [PID]');
      } else {
        const index = state.processes?.findIndex((processInfo) => processInfo.pid === pid);
        if (index === -1 || index === undefined) {
          setHint(`프로세스 [${pid}]를 찾을 수 없습니다.`);
        } else {
          state.processes[index].status = 'KILLED';
          setHint(`프로세스 [${pid}]에 종료 신호를 보냈습니다.`);
        }
      }
      setDefaultPrompt();
      return true;
    }

    return false;
  };
}
