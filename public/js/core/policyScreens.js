import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

// [LOG_ID: 20260713_2100] 나우누리 GUIDE 화면 "[이용안내]" 구역의 12.이용약관 재현.
// 회원가입 동의 단계(signupScreens.js)의 SIGNUP_TOS_TEXT/SIGNUP_PRIVACY_TEXT를 그대로
// 재사용하되, 그쪽은 동의 버튼이 딸린 전용 HTML 화면이라 여기서는 다른 화면들과 동일한
// ANSI 상단바+페이징 형식(help 화면과 동일 패턴)으로 별도 구현한다.
export function createPolicyScreens(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    cmdInput,
    displayWidth,
    getCommandFooterText,
    isWideChar,
    renderScreenSequential,
    screenEl,
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT,
    state,
    updateURL
  } = deps;
  const {
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildTopHeader,
    wrapAnsiText
  } = createAnsiBuilderUtils({ displayWidth, isWideChar });

  const POLICY_DOCS = {
    tos: { title: '이용약관', code: 'TOS', lines: SIGNUP_TOS_TEXT },
    privacy: { title: '개인정보처리방침', code: 'PRIVACY', lines: SIGNUP_PRIVACY_TEXT }
  };

  function normalizePolicyKind(kind) {
    return POLICY_DOCS[kind] ? kind : 'tos';
  }

  function buildPolicyAnsi(kind, page = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const doc = POLICY_DOCS[normalizePolicyKind(kind)];
    const requestedPage = Math.max(1, Number.parseInt(page, 10) || 1);

    // 원문 각 항목(조/문단)을 화면 폭에 맞춰 줄바꿈 — 조 사이엔 빈 줄로 문단 구분.
    const bodyLines = [];
    (doc.lines || []).forEach((paragraph, idx) => {
      if (idx > 0) bodyLines.push('');
      wrapAnsiText(String(paragraph || ''), targetCols - 2).forEach((line) => {
        bodyLines.push(ansiColor(15) + line + ANSI_RESET);
      });
    });

    const linesPerPage = 19;
    const totalPages = Math.max(1, Math.ceil(bodyLines.length / linesPerPage));
    const finalPage = Math.max(1, Math.min(requestedPage, totalPages));
    const pageSlice = bodyLines.slice((finalPage - 1) * linesPerPage, finalPage * linesPerPage);

    const parts = [
      // [LOG_ID: 20260714_1300] leftLabel을 상위 메뉴("GUIDE") 하드코딩 대신 문서 자신의
      // 코드로 — 사용자 지적: 이용약관/개인정보처리방침 어느 걸 열어도 좌상단이 "GUIDE"로
      // 통일되어 있었다. 다른 화면들(게시판 등)은 모두 자기 자신의 코드를 좌상단에 쓴다.
      buildTopHeader({ leftLabel: doc.code, centerLabel: doc.title }, buildPageLabel(finalPage, totalPages), targetCols),
      ...pageSlice
    ];

    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < 23) {
      joinedLines.push('');
    }

    return {
      text: joinedLines.slice(0, 23).join('\n'),
      page: finalPage,
      totalPages
    };
  }

  async function showPolicy(kind = 'tos', page = 1, fromHistory = false) {
    const normalizedKind = normalizePolicyKind(kind);
    state.screen = 'policy';
    state.policyKind = normalizedKind;
    const built = buildPolicyAnsi(normalizedKind, page);
    state.page = built.page;
    state.policyTotalPages = built.totalPages;
    if (!fromHistory) updateURL();

    await renderAnsiScreenWithTopbarSequential({
      ansiText: built.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('', getCommandFooterText('policy'));
      }
    });
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showPolicy };
}
