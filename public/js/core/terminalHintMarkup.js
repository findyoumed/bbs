import { CMD_META } from './commandService.js';

export function createTerminalHintMarkup(deps) {
  const { state, esc } = deps;

  function resolveCommandLabel(cmd, labelOverride = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    return String(labelOverride || CMD_META[normalizedCmd]?.label || normalizedCmd).trim();
  }

  function buildCommandToken(cmd, labelOverride = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    if (!normalizedCmd) {
      return '';
    }

    const meta = CMD_META[normalizedCmd] || {};
    const label = String(labelOverride || meta.label || normalizedCmd).trim();
    const defaultLabel = String(meta.label || normalizedCmd).trim();
    const tip = String(
      labelOverride && label !== defaultLabel
        ? `${label}[${normalizedCmd}]`
        : (meta.tip || normalizedCmd)
    ).trim();
    // [LOG_ID: 20260723_2300] prefill(예: GO)은 클릭 즉시 실행하지 않고 입력줄에 "CMD "만 채워
    // 사용자가 이어서 인자를 타이핑하게 한다 — fill(즉시 실행)과는 다른 별도 속성.
    const dataAttr = meta.fill
      ? `data-cmd-fill="${esc(meta.fill)}"`
      : meta.prefill
        ? `data-cmd-prefill="${esc(normalizedCmd)} "`
        : `data-cmd="${esc(normalizedCmd)}"`;
    // [LOG: 20260622_1900] 푸터 토큰 표기는 '라벨(CMD)' 괄호 형식으로 통일(기존 대다수 화면의 표기와 동일).
    const tokenText = normalizedCmd === label.toUpperCase()
      ? esc(label)
      : `${esc(label)}(${esc(normalizedCmd)})`;
    return `<span class="cmd-token cmd-clickable" data-tip="${esc(tip)}" ${dataAttr}>${tokenText}</span>`;
  }

  function buildParenCommandToken(labelOverride, cmd) {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const label = String(labelOverride || '').trim();
    if (!normalizedCmd || !label || !CMD_META[normalizedCmd]) {
      return '';
    }

    const meta = CMD_META[normalizedCmd] || {};
    const dataAttr = meta.fill
      ? `data-cmd-fill="${esc(meta.fill)}"`
      : meta.prefill
        ? `data-cmd-prefill="${esc(normalizedCmd)} "`
        : `data-cmd="${esc(normalizedCmd)}"`;
    const tip = String(meta.tip || `${label}[${normalizedCmd}]`).trim();

    return `<span class="cmd-token cmd-clickable" data-tip="${esc(tip)}" ${dataAttr}>${esc(label)}(${esc(normalizedCmd)})</span>`;
  }

  function getCommandTokenText(cmd, labelOverride = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const label = resolveCommandLabel(normalizedCmd, labelOverride);
    return normalizedCmd === label.toUpperCase()
      ? label
      : `${label}(${normalizedCmd})`;
  }

  function getCommandPriority(cmd) {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    return Number(CMD_META[normalizedCmd]?.priority ?? 50);
  }

  function buildCommandEntry(cmd, labelOverride = '') {
    const tokenText = getCommandTokenText(cmd, labelOverride);
    const priority = getCommandPriority(cmd);
    return `<span class="cmd-entry" data-priority="${priority}" data-token-text="${esc(tokenText)}">${buildCommandToken(cmd, labelOverride)}<span class="cmd-sep">,</span></span>`;
  }

  function getFooterTokenBucket(cmd, label = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const resolvedLabel = resolveCommandLabel(normalizedCmd, label);

    if (['F', 'B', 'L'].includes(normalizedCmd)) return 10;
    // [LOG_ID: 20260712_0100] 뉴스 기사 화면의 '이전기사/다음기사'도 글 이동 그룹(10)으로 정렬.
    if (normalizedCmd === 'N') return ['이전글', '이전기사'].includes(resolvedLabel) ? 10 : 50;
    if (normalizedCmd === 'A') return ['다음글', '다음기사'].includes(resolvedLabel) ? 10 : 50;
    if (['P', 'M', 'Z'].includes(normalizedCmd)) return 20;
    if (normalizedCmd === 'T') return 30;
    if (normalizedCmd === 'GO') return 40;
    if (['LOGIN', 'WHO', 'PF', 'HI', 'MYINFO'].includes(normalizedCmd)) return 60;
    if (['H', 'HELP', '?'].includes(normalizedCmd)) return 70;
    return 50;
  }

  function sortFooterTokens(tokens) {
    return [...tokens]
      .map((token, index) => ({ ...token, index }))
      .sort((left, right) => {
        const bucketDiff = getFooterTokenBucket(left.cmd, left.label) - getFooterTokenBucket(right.cmd, right.label);
        if (bucketDiff !== 0) {
          return bucketDiff;
        }
        return left.index - right.index;
      })
      .map(({ index, ...token }) => token);
  }

  function getFooterPageState() {
    if (state.screen === 'post-view') {
      return {
        pageNo: Math.max(1, Number(state.postPageNo || 1)),
        pageCount: Math.max(1, Number(state.postPageCount || 1))
      };
    }

    if (state.screen === 'help') {
      return {
        pageNo: Math.max(1, Number(state.page || 1)),
        pageCount: Math.max(1, Number(state.helpTotalPages || 1))
      };
    }

    // [LOG_ID: 20260725_1030] policy/menu-index는 help와 동일한 F/B 페이징이지만 페이지 상태를
    // state.serviceData가 아니라 state.page + 자기 전용 totalPages 필드에 저장한다(policyScreens.js/
    // menuIndexScreens.js — 둘 다 serviceData를 아예 건드리지 않음). 이 분기가 없어 DEFAULT
    // 폴백(state.serviceData?.pageNo/pageCount)을 타면서, 직전에 봤던 다른 화면(날씨/뉴스 등)의
    // serviceData 잔여값을 그대로 읽어 F가 실제 페이지 수와 무관하게 숨거나 계속 뜨는 오류가 있었다.
    if (state.screen === 'policy') {
      return {
        pageNo: Math.max(1, Number(state.page || 1)),
        pageCount: Math.max(1, Number(state.policyTotalPages || 1))
      };
    }

    if (state.screen === 'menu-index') {
      return {
        pageNo: Math.max(1, Number(state.page || 1)),
        pageCount: Math.max(1, Number(state.menuIndexTotalPages || 1))
      };
    }

    if (state.screen === 'post-list') {
      return {
        pageNo: Math.max(1, Number(state.page || 1)),
        pageCount: Math.max(1, Number(state.totalPages || 1))
      };
    }

    // [LOG_ID: 20260726_2300] 안건 보기(conf-agenda)도 본문이 길면 페이징된다 — help/policy와
    // 같은 이유로 전용 필드(state.confAgendaPageNo/PageCount)를 쓴다(serviceData는 이미
    // kind/roomNo/agendaId/agenda 캐시가 들어있어 재사용하면 다른 화면 잔여값 오류가 재현된다).
    if (state.screen === 'conf-agenda') {
      return {
        pageNo: Math.max(1, Number(state.confAgendaPageNo || 1)),
        pageCount: Math.max(1, Number(state.confAgendaPageCount || 1))
      };
    }

    // [LOG_ID: 20260726_0010] 쪽지 보기(memo-view)도 본문이 길면 페이징된다 — 전용 필드 사용.
    if (state.screen === 'memo-view') {
      return {
        pageNo: Math.max(1, Number(state.memoViewPageNo || 1)),
        pageCount: Math.max(1, Number(state.memoViewPageCount || 1))
      };
    }

    return {
      pageNo: Math.max(1, Number(state.serviceData?.pageNo || 1)),
      pageCount: Math.max(1, Number(state.serviceData?.pageCount || 1))
    };
  }

  function shouldShowFooterToken(cmd, label, allTokens) {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const resolvedLabel = resolveCommandLabel(normalizedCmd, label);
    const defaultLabel = resolveCommandLabel(normalizedCmd, '');
    const usesCustomLabel = Boolean(label) && resolvedLabel !== defaultLabel;

    // [LOG_ID: 20260713_1010] SET LEVEL에 따른 힌트 토큰 필터링
    const currentLevel = String(state.envVars?.LEVEL || '중급').trim().toUpperCase();
    
    // 1. 고급 등급: H(도움말/HELP/?) 토큰만 노출하고 나머지는 완전히 숨김
    if (currentLevel === '고급' || currentLevel === 'HIGH') {
      if (!['H', 'HELP', '?'].includes(normalizedCmd)) {
        return false;
      }
    }
    // 2. 초급 등급: 우선순위가 높은(주요 이동/도움말 등 priority <= 20) 핵심 명령어 토큰만 노출
    else if (currentLevel === '초급' || currentLevel === 'LOW') {
      const priority = getCommandPriority(normalizedCmd);
      const isCoreNav = ['F', 'B', 'L', 'P', 'M', 'H', 'HELP', '?', 'LOGIN'].includes(normalizedCmd);
      if (priority > 20 && !isCoreNav) {
        return false;
      }
    }

    if (['X', 'Z', 'M'].includes(normalizedCmd)) return false;
    if (normalizedCmd === 'H' && state.screen === 'help') return false;
    if (normalizedCmd === 'LOGIN' && !state.user?.isGuest) return false;

    const meta = CMD_META[normalizedCmd];
    if (meta?.login && state.user?.isGuest && !usesCustomLabel) return false;

    if ((resolvedLabel === '이전글' || resolvedLabel === '다음글') && state.screen !== 'post-view') return false;

    if (normalizedCmd === 'P' && allTokens.some((token) => token.cmd === 'B' && resolveCommandLabel(token.cmd, token.label) === '상위')) {
      return false;
    }

    // [LOG_ID: 20260723_2240] help/policy/weatherView/menuIndex/newsList는 CMD_ORDER에서
    // F/B 라벨을 'B:이전페이지'/'F:다음페이지'로 오버라이드하는데, 이 페이지 존재 여부 검사는
    // 기본 라벨('이전쪽'/'이전', '다음쪽'/'다음')만 알고 있어 '이전페이지'/'다음페이지'는 매치되지
    // 않았다 — 그 결과 이 다섯 카테고리는 마지막/유일 페이지에서도 F/B가 계속 노출됐다(날씨
    // 지역별 화면 실측: 07/01 단일 페이지·피드 오류 화면에서도 "다음페이지(F)"가 떠 있었음).
    // voteDetail의 'B:목록'·voteCreate의 'B:취소'·confAgendas의 'B:회의실'처럼 B가 페이지 이동과
    // 무관한 라벨로도 쓰이므로, cmd만으로 판단하지 않고 실제 페이지네이션 라벨만 넓게 포함한다.
    if (normalizedCmd === 'B' && ['이전쪽', '이전', '이전페이지'].includes(resolvedLabel)) {
      const { pageNo } = getFooterPageState();
      if (pageNo <= 1) return false;
    }

    if (normalizedCmd === 'F' && ['다음쪽', '다음', '다음페이지'].includes(resolvedLabel)) {
      const { pageNo, pageCount } = getFooterPageState();
      if (pageNo >= pageCount) return false;
    }

    return true;
  }

  function renderHintMarkup(text) {
    const placeholders = [];
    const stash = (html) => {
      const key = `@@CMDTOKEN${placeholders.length}@@`;
      placeholders.push({ key, html });
      return key;
    };

    let source = String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim() !== '>>')
      .join('\n')
      .trim();

    source = source.replace(/번호\/명령\(([^)]*)\)/g, (_, inner) => {
      const tokens = [];
      const tokenPattern = /([A-Z0-9]{1,8})(?::([^\s,()]+))?/g;
      let match;
      while ((match = tokenPattern.exec(inner)) !== null) {
        tokens.push({ cmd: match[1].toUpperCase(), label: match[2] || '' });
      }

      const visibleTokens = sortFooterTokens(
        tokens.filter((token) => shouldShowFooterToken(token.cmd, token.label, tokens))
      );
      const renderedInner = visibleTokens
        .map((token) => stash(buildCommandEntry(token.cmd, token.label)))
        .join('');

      return stash(`<span class="cmd-entry-list">${renderedInner}</span>`);
    });

    source = source.replace(/\{\{([^|{}]+)\|([A-Z0-9]{1,8})\}\}/g, (_, label, cmd) => {
      return stash(buildCommandToken(cmd, label));
    });

    source = source.replace(/([가-힣A-Za-z0-9_]+)\(([A-Z0-9]{1,8})\)/g, (match, label, cmd) => {
      const token = buildParenCommandToken(label, cmd);
      return token ? stash(token) : match;
    });

    source = source.replace(/\b([A-Z]{1,8}):([^\s,()<>]{1,10})/g, (match, cmd, label) => {
      if (cmd === 'HTTP' || cmd === 'HTTPS') {
        return match;
      }
      return stash(buildCommandToken(cmd, label));
    });

    let html = esc(source).replace(/\n/g, '<br>');
    [...placeholders].reverse().forEach(({ key, html: tokenHtml }) => {
      html = html.split(key).join(tokenHtml);
    });

    return html;
  }

  return {
    renderHintMarkup
  };
}
