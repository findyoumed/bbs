export function createGlobalWorkspaceCommandHandler(deps) {
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

  return async function handleGlobalWorkspaceCommand({ cmd, rawCmd }) {
    if (cmd === 'ALIAS') {
      const parts = splitCommand(rawCmd);
      const sub = (parts[1] || '').toUpperCase();
      const { aliasService } = deps;

      if (!aliasService) {
        return false;
      }

      if (!sub || sub === 'LIST' || sub === 'L') {
        const aliases = aliasService.getAliases();
        const keys = Object.keys(aliases);
        if (keys.length === 0) {
          setHint('등록된 알리어스가 없습니다. (ALIAS [이름] [대상 명령])');
        } else {
          const list = keys.map((key) => `[${key}] -> ${aliases[key]}`).join('\n');
          setHint(`알리어스 목록:\n${list}\n(ALIAS RM [이름] 으로 삭제 가능)`);
        }
        setDefaultPrompt();
        return true;
      }

      if (sub === 'RM' || sub === 'DEL') {
        const name = parts[2];
        if (!name) {
          setHint('삭제할 알리어스 이름을 입력해 주세요. (예: ALIAS RM T)');
        } else if (aliasService.removeAlias(name)) {
          setHint(`알리어스 [${name.toUpperCase()}]가 삭제되었습니다.`);
        } else {
          setHint(`알리어스 [${name.toUpperCase()}]를 찾을 수 없습니다.`);
        }
        setDefaultPrompt();
        return true;
      }

      if (sub === 'CLR' || sub === 'CLEAR') {
        aliasService.clearAliases();
        setHint('모든 알리어스가 삭제되었습니다.');
        setDefaultPrompt();
        return true;
      }

      const name = sub;
      const target = parts.slice(2).join(' ');
      if (!target) {
        const aliases = aliasService.getAliases();
        if (aliases[name]) {
          setHint(`알리어스 [${name}] -> ${aliases[name]}`);
        } else {
          setHint('사용법: ALIAS [이름] [명령]\n예: ALIAS T GO TOP\n예: ALIAS B1 GO BOARD1');
        }
      } else if (aliasService.setAlias(name, target)) {
        setHint(`알리어스 [${name}] -> ${target} 가 등록되었습니다.`);
      } else {
        setHint(`알리어스 [${name}]를 등록할 수 없습니다.`);
      }
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'WS') {
      const parts = splitCommand(rawCmd);
      const sub = (parts[1] || '').toUpperCase();
      const value = parts[2];
      const { workspaceService } = deps;

      if (!workspaceService) {
        return false;
      }

      if (sub === 'LIST' || sub === 'L' || !sub) {
        const list = workspaceService.getWorkspaces().map((workspace) =>
          `${workspace.active ? '*' : ' '} [${workspace.id}] ${workspace.name}`
        ).join('\n');
        setHint(`워크스페이스 목록:\n${list}\n(WS ADD [이름], WS SW [ID], WS RM [ID])`);
        setDefaultPrompt();
        return true;
      }

      if (sub === 'ADD' || sub === 'A') {
        const newWorkspace = workspaceService.addWorkspace(parts.slice(2).join(' '));
        if (newWorkspace) {
          setHint(`새 워크스페이스 [${newWorkspace.id}] ${newWorkspace.name} 가 생성되었습니다.`);
          await workspaceService.switchWorkspace(newWorkspace.id);
        } else {
          setHint('더 이상 워크스페이스를 생성할 수 없습니다. (최대 9개)');
        }
        setDefaultPrompt();
        return true;
      }

      if (sub === 'SW' || sub === 'S') {
        if (!value) {
          setHint('이동할 워크스페이스 ID를 입력해 주세요. (예: WS SW 2)');
          setDefaultPrompt();
          return true;
        }
        const success = await workspaceService.switchWorkspace(value);
        if (!success) {
          setHint(`워크스페이스 [${value}]를 찾을 수 없습니다.`);
        }
        setDefaultPrompt();
        return true;
      }

      if (sub === 'RM' || sub === 'R') {
        if (!value) {
          setHint('삭제할 워크스페이스 ID를 입력해 주세요. (예: WS RM 2)');
          setDefaultPrompt();
          return true;
        }
        const success = workspaceService.removeWorkspace(value);
        if (!success) {
          setHint(`워크스페이스 [${value}]를 삭제할 수 없습니다. (최소 1개 유지)`);
        } else {
          setHint(`워크스페이스 [${value}]가 삭제되었습니다.`);
        }
        setDefaultPrompt();
        return true;
      }
    }

    if (cmd === 'ENV' || cmd === 'VARS') {
      const vars = state.envVars || {};
      const list = Object.keys(vars).map((key) => `${key}=${vars[key]}`).join('\n');
      setHint(`환경 변수 목록:\n${list || '(없음)'}\n(SET [이름] [값] 으로 설정 가능)`);
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'SET' || cmd === 'UNSET') {
      const parts = splitCommand(rawCmd);
      const name = (parts[1] || '').toUpperCase();
      const value = parts.slice(2).join(' ');
      const { settingsService } = deps;
      const envVars = ensureEnvVars();

      if (cmd === 'SET' && !name) {
        setHint('사용법: SET [이름] [값]\n예: SET PROMPT BBS >\n예: SET SYSTEM_NAME MyBBS');
        setDefaultPrompt();
        return true;
      }
      if (cmd === 'UNSET' && !name) {
        setHint('사용법: UNSET [이름]\n예: UNSET SYSTEM_NAME');
        setDefaultPrompt();
        return true;
      }

      if (cmd === 'UNSET' || (cmd === 'SET' && !value)) {
        delete envVars[name];
        setHint(`환경 변수 [${name}]이(가) 삭제되었습니다.`);
      } else {
        envVars[name] = value;
        setHint(`환경 변수 [${name}] = ${value} 로 설정되었습니다.`);
        if (name === 'PROMPT') {
          setPrompt(value);
        }
      }

      if (settingsService) {
        settingsService.saveEnvVars(envVars);
      }
      return true;
    }

    if (cmd === 'TRACE') {
      const parts = splitCommand(rawCmd);
      const sub = (parts[1] || '').toUpperCase();

      if (sub === 'ON') {
        state.trace = true;
        setHint('스크립트 추적(TRACE) 모드가 활성화되었습니다.');
      } else if (sub === 'OFF') {
        state.trace = false;
        setHint('스크립트 추적(TRACE) 모드가 비활성화되었습니다.');
      } else {
        setHint(`현재 TRACE 상태: ${state.trace ? 'ON' : 'OFF'}\n사용법: TRACE [ON|OFF]`);
      }
      setDefaultPrompt();
      return true;
    }

    return false;
  };
}
