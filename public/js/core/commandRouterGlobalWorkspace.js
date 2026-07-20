// [LOG_ID: 20260714_1700] ALIAS/WS/TRACE(가짜 셸 알리어스·워크스페이스 전환·스크립트 추적)
// 명령을 제거했다 — 사용자 결정: 1990년대 PC통신에 없던 기능이고 도움말에도 노출되지
// 않아 실사용자가 쓸 일이 없었다. SET/UNSET/ENV는 SET LEVEL(도움말 표시 등급)/
// SET HOME(초기 화면 지정)/SET THEME(나우누리 테마)/SET PROMPT(프롬프트 문자열) 같은
// 실제 사이트 기능의 기반이라 그대로 남긴다.
export function createGlobalWorkspaceCommandHandler(deps) {
  const {
    state,
    setHint,
    setPrompt,
    applyTheme
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
    // [LOG_ID: 20260711_2340] cmd는 dispatcher가 정규화한 "입력 전체" 문자열이라('SET PROMPT X'),
    // 전체 일치(cmd === 'SET')로는 인자가 붙는 순간 어떤 명령도 매칭되지 않았다(회귀 — 아래에서
    // splitCommand(rawCmd)로 인자를 파싱하는 설계 자체가 원래 첫 토큰 비교였음을 보여준다).
    // 인자를 받는 명령(SET/UNSET)은 첫 토큰으로 비교한다.
    const head = String(cmd || '').trim().split(/\s+/)[0];

    if (cmd === 'ENV' || cmd === 'VARS') {
      const vars = state.envVars || {};
      const list = Object.keys(vars).map((key) => `${key}=${vars[key]}`).join('\n');
      setHint(`환경 변수 목록:\n${list || '(없음)'}\n(SET [이름] [값] 으로 설정 가능)`);
      setDefaultPrompt();
      return true;
    }

    if (head === 'SET' || head === 'UNSET') {
      const parts = splitCommand(rawCmd);
      const name = (parts[1] || '').toUpperCase();
      const value = parts.slice(2).join(' ');
      const { settingsService } = deps;
      const envVars = ensureEnvVars();

      if (head === 'SET' && !name) {
        setHint('사용법: SET [이름] [값]\n예: SET PROMPT BBS >\n예: SET SYSTEM_NAME MyBBS\n예: SET IDLE 5 (유휴 자동종료, 1~30분)\n예: SET SORT OLD (게시물 오래된순 정렬, 기본: NEW)\n예: SET TAG 여행 좋아하는 사람 (대화방 덧말, 메시지마다 자동 첨부)');
        setDefaultPrompt();
        return true;
      }

      // [LOG_ID: 20260719_1600] 천리안 원전 6.4.7 ENV "자동접속 차단시간" 재현 — 1~30분 범위로 제한.
      if (head === 'SET' && name === 'IDLE' && value) {
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 30) {
          setHint('IDLE 값은 1~30(분) 사이의 숫자여야 합니다. 예: SET IDLE 5');
          setDefaultPrompt();
          return true;
        }
      }

      // [LOG_ID: 20260719_2200] 대화방 덧말(태그라인) — 메시지 스팸 방지를 위해 길이 제한.
      if (head === 'SET' && name === 'TAG' && value.length > 20) {
        setHint('TAG는 20자 이내로 입력해 주십시오.');
        setDefaultPrompt();
        return true;
      }

      // [LOG_ID: 20260719_1600] 천리안 원전 6.4.7 ENV "목록 출력방식" 재현 — NEW/OLD만 허용.
      if (head === 'SET' && name === 'SORT' && value) {
        const sortValue = value.trim().toUpperCase();
        if (sortValue !== 'NEW' && sortValue !== 'OLD') {
          setHint('SORT 값은 NEW(최신순) 또는 OLD(오래된순)만 가능합니다. 예: SET SORT OLD');
          setDefaultPrompt();
          return true;
        }
      }
      if (head === 'UNSET' && !name) {
        setHint('사용법: UNSET [이름]\n예: UNSET SYSTEM_NAME');
        setDefaultPrompt();
        return true;
      }

      if (head === 'UNSET' || (head === 'SET' && !value)) {
        delete envVars[name];
        setHint(`환경 변수 [${name}]이(가) 삭제되었습니다.`);
        if (name === 'PROMPT') {
          // '>>' 센티널로 setPrompt를 태워 위치 접두 포함 기본 프롬프트로 즉시 복귀시킨다
          // (없으면 삭제된 사용자 정의 프롬프트가 다음 화면 전환까지 잔류).
          setPrompt('>>');
        }
        // [LOG_ID: 20260713_1155] UNSET THEME 시 default 테마로 원복
        if (name === 'THEME' && typeof applyTheme === 'function') {
          applyTheme('default');
          try {
            localStorage.setItem('bbs_theme', 'default');
          } catch (e) {}
        }
      } else {
        envVars[name] = value;
        setHint(`환경 변수 [${name}] = ${value} 로 설정되었습니다.`);
        if (name === 'PROMPT') {
          setPrompt(value);
        }
        // [LOG_ID: 20260713_1155] SET THEME 명령어 연동
        if (name === 'THEME' && typeof applyTheme === 'function') {
          const lowerTheme = value.trim().toLowerCase();
          if (['default', 'blue', 'nownuri'].includes(lowerTheme)) {
            applyTheme(lowerTheme);
            try {
              localStorage.setItem('bbs_theme', lowerTheme);
            } catch (e) {}
          } else {
            setHint(`알 수 없는 테마입니다: ${value} (가능한 값: default, blue, nownuri)`);
          }
        }
      }

      if (settingsService) {
        settingsService.saveEnvVars(envVars);
      }
      return true;
    }

    return false;
  };
}
