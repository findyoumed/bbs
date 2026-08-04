/**
 * 01410 — app.js (Minimal Entry Point)
 * [LOG: 20260411_1845] Extreme modularization complete.
 */
'use strict';

import { initApp } from './core/appFactory.js';
import { SIGNUP_TOS_TEXT, SIGNUP_PRIVACY_TEXT } from './core/signupPolicyText.js';
import { beginCommandExecution, trackCommandExecution, cancelCommandExecution } from './core/commandExecutionState.js';

let state = {
  screen: 'main', user: null, token: '', supabase: null, authConfig: { enabled: false },
  stats: {}, assetCache: {}, menuTree: null, menuLookup: {}, menuParents: {},
  boards: [], totalCount: 0, board: null, boardMenuPath: 'top', boardMenuTitle: '',
  boardMenuEntries: [], posts: [], page: 1, totalPages: 1, post: null, writeMode: 'create',
  serviceData: null, subTitle: '', subItems: [], history: [], theme: 'default', _chatSessionKey: '',
  // [LOG: 20260425_2245] Command history state
  cmdHistory: [],
  cmdHistoryIndex: -1,
  cmdHistoryTemp: '',
  _prQueue: [],
  // [LOG_ID: 20260717_1900] _memberBannerShown 제거 — 게시판 신분 배너를 없애면서 쓰이지 않는다.
  commandGrade: 'middle', // Default helpbar grade
  _sessionStartTime: Date.now(),
};

// [LOG: 20260728_1430] 디버그/스모크 테스트용 전역 state 참조 등록
if (typeof window !== 'undefined') {
  window.__debugState = state;
}

const refs = {};

const {
  initTooltips, initAuth, preloadBootstrap, restoreStateFromURL, restoreTheme, updateURL, showMain, showPasswordReset, renderInitError, guestUser, forceExit
} = initApp({ state, refs, SIGNUP_TOS_TEXT, SIGNUP_PRIVACY_TEXT });

// [LOG_ID: 20260719_1600] 천리안 원전 6.4.7 ENV "자동접속 차단시간"(SET IDLE [분]) 재현.
// 종량제 PC통신 시절, 일정 시간 무입력 시 자동으로 접속을 끊던 동작. 기본값은 없음(off)이며
// SET IDLE 1~30 으로 설정해야 활성화된다(settingsService가 저장한 envVars.IDLE에서 읽음).
let idleExitInFlight = false;
setInterval(() => {
  if (idleExitInFlight) return;
  const idleMinutes = Number(state.envVars?.IDLE);
  if (!Number.isFinite(idleMinutes) || idleMinutes <= 0) return;
  const lastActivity = Number(state._lastActivityTime) || 0;
  if (!lastActivity) return;
  if (Date.now() - lastActivity < idleMinutes * 60000) return;

  idleExitInFlight = true;
  (async () => {
    try {
      showIdleExitHint();
      await wait(600);
      await forceExit();
    } catch (error) {
      console.warn('유휴 자동 종료 실패:', error.message);
      idleExitInFlight = false;
    }
  })();
}, 15000);

function showIdleExitHint() {
  const hintEl = document.getElementById('cmd-hint');
  if (hintEl) hintEl.textContent = '* 장시간 무입력으로 접속을 종료합니다.';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// [LOG: 20260427_2033] 초기 렌더 전에 핵심 폰트를 먼저 준비해 FOUT(폰트 번쩍임)과 화면 튐을 줄인다.
async function waitForPrimaryFonts(timeoutMs = 2500) {
  const rootEl = document.documentElement;

  try {
    if (!document.fonts || typeof document.fonts.load !== 'function') {
      return;
    }

    const fontReadyPromise = Promise.allSettled([
      document.fonts.load('17px "Sam3KRFont"'),
      document.fonts.load('17px "BbsPrimaryFont"'),
      document.fonts.load('17px "DungGeunMo"')
    ]).then(async () => {
      try {
        await document.fonts.ready;
      } catch (error) {
        console.warn('폰트 준비 확인 실패:', error.message);
      }
    });

    await Promise.race([
      fontReadyPromise,
      wait(timeoutMs)
    ]);
  } catch (error) {
    console.warn('폰트 로드 대기 실패:', error.message);
  } finally {
    rootEl.classList.remove('fonts-loading');
    rootEl.classList.add('fonts-ready');
  }
}

async function init() {
  restoreTheme(); // [LOG: 20260424_1755] 저장된 테마 즉시 복원
  // [LOG_ID: 20260805_0054] Both primary WOFF2 fonts are preloaded, so keep a
  // short fallback gate without delaying first render for a full second.
  await waitForPrimaryFonts(300);
  initTooltips();
  state.user = guestUser();

  // 브라우저 뒤로가기/앞으로가기 처리
  // [LOG: 20260617_1742] Cancel pending navigation or commands and start new restoration with AbortController support.
  window.onpopstate = async () => {
    cancelCommandExecution(state);
    const token = beginCommandExecution(state);
    try {
      const result = restoreStateFromURL();
      trackCommandExecution(state, result, token);
      await result;
    } catch (e) {
      if (e?.type !== 'cancelled') {
        console.error('Navigation error:', e.message);
      }
    }
  };

  try {
    // [LOG_ID: 20260804_1405] Bootstrap data is public and independent from
    // auth setup, so start both network paths together.
    void preloadBootstrap().catch(() => {});
    // [LOG: 20260416_2233] 병목 제거: 인증 초기화를 먼저 수행하여 중복 렌더링 방지
    try {
      await initAuth();
    } catch (authError) {
      console.warn('인증 초기화 실패 (손님 모드 지속):', authError.message);
    }

    if (window.location.pathname !== '/') {
      await restoreStateFromURL();
    } else {
      await showMain();
    }
  } catch (e) {
    console.error('초기 화면 렌더 실패:', e.message);
    const terminal = await import('./core/appFactory.js').then(m => window.terminal); // Try to get terminal instance
    if (terminal?.setReady) {
      terminal.setReady(true);
    }
    renderInitError(`초기화 과정에서 오류가 발생했습니다. (${e.message})`);
  }
}

init();
