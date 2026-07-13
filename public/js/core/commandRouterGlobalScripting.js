// [LOG_ID: 20260713_1650] MATH 명령이 eval()을 써서 사이트 CSP(script-src, unsafe-eval 미허용)에
// 막혀 항상 실패했다(H 도움말엔 있지만 실행 불가한 죽은 명령이었음). 입력이 이미
// `/^[0-9+\-*/%().\s]+$/`로 제한되어 있으므로, 같은 문자 집합만 다루는 재귀 하강 파서로 대체한다.
function evaluateSafeArithmetic(expr) {
  let pos = 0;
  const text = expr.replace(/\s+/g, '');

  function peek() { return text[pos]; }
  function fail(msg) { throw new Error(msg); }

  function parseNumber() {
    const start = pos;
    while (pos < text.length && /[0-9.]/.test(text[pos])) pos += 1;
    if (pos === start) fail('숫자가 필요합니다.');
    const numText = text.slice(start, pos);
    if ((numText.match(/\./g) || []).length > 1) fail(`잘못된 숫자: ${numText}`);
    return Number(numText);
  }

  function parseUnary() {
    if (peek() === '+') { pos += 1; return parseUnary(); }
    if (peek() === '-') { pos += 1; return -parseUnary(); }
    if (peek() === '(') {
      pos += 1;
      const value = parseExpr();
      if (peek() !== ')') fail("')' 가 필요합니다.");
      pos += 1;
      return value;
    }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseUnary();
    for (;;) {
      const op = peek();
      if (op === '*' || op === '/' || op === '%') {
        pos += 1;
        const rhs = parseUnary();
        if (op === '*') value *= rhs;
        else if (op === '/') { if (rhs === 0) fail('0으로 나눌 수 없습니다.'); value /= rhs; }
        else { if (rhs === 0) fail('0으로 나눌 수 없습니다.'); value %= rhs; }
      } else {
        return value;
      }
    }
  }

  function parseExpr() {
    let value = parseTerm();
    for (;;) {
      const op = peek();
      if (op === '+' || op === '-') {
        pos += 1;
        const rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  if (!text) fail('수식이 비어 있습니다.');
  const result = parseExpr();
  if (pos !== text.length) fail(`처리되지 않은 문자: ${text.slice(pos)}`);
  if (!Number.isFinite(result)) fail('계산 결과가 유효하지 않습니다.');
  return result;
}

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
    // [LOG_ID: 20260711_2340] cmd는 입력 전체 문자열이므로 인자를 받는 명령은 첫 토큰으로
    // 비교한다(전체 일치는 인자가 붙으면 매칭 불가 — commandRouterGlobalWorkspace 주석 참고).
    const head = String(cmd || '').trim().split(/\s+/)[0];

    if (head === 'MATH') {
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
          const result = evaluateSafeArithmetic(expr);
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

    if (head === 'READ') {
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

    if (head === 'TRAP') {
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

    if (head === 'WAITPID') {
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

    if (head === 'KILL') {
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
