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

    // [LOG_ID: 20260726_2330] 헤드리스 실측(20260726_2230)에서 이미 본문 마지막 줄과 컨테이너
    // 경계가 "정확히" 일치(여유 0px)했다 — 실기기 폰트가 근소하게만 더 커도 그대로 잘린다.
    // overflow-y:auto(20260726_2230)는 스크롤로 나머지를 볼 수는 있게 하지만, 스크린샷처럼
    // 처음 그려진 화면 자체는 그대로 "잘린 것처럼" 보인다(사용자 재지적: "아직도 마찬가지로
    // 아래 글자가 잘렸는데"). 캔버스 총 23줄은 그대로 두고 페이지당 본문을 19→18줄로 줄이면,
    // 패딩 루프가 채우는 마지막 한 줄이 항상 빈 줄이 되어 — 여유가 부족해 무언가 잘리더라도
    // 그 빈 줄이 잘리지, 실제 문장이 잘리는 일은 없다.
    const linesPerPage = 18;
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
    // [LOG_ID: 20260722_2200] menu-index/help와 동일한 원인의 버그 — F/B 페이지 넘김마다
    // pushState해 히스토리를 쌓았고, 그 뒤 P(handleHistoryBack → window.history.back())를 누르면
    // 실제 상위(GUIDE)가 아니라 방금 페이지로만 되돌아가 "P가 B처럼 작동"했다. 이미 policy
    // 화면에 있었다면(=페이지 넘김) replaceState로 히스토리를 늘리지 않는다.
    const stayingOnSameScreen = state.screen === 'policy';
    state.screen = 'policy';
    state.policyKind = normalizedKind;
    const built = buildPolicyAnsi(normalizedKind, page);
    state.page = built.page;
    state.policyTotalPages = built.totalPages;
    if (!fromHistory) updateURL(stayingOnSameScreen);

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
