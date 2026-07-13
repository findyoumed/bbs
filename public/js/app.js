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
  _memberBannerShown: {},
  commandGrade: 'middle', // Default helpbar grade
  _sessionStartTime: Date.now(),
};

const refs = {};

const {
  initTooltips, initAuth, restoreStateFromURL, restoreTheme, updateURL, showMain, showPasswordReset, renderInitError, guestUser
} = initApp({ state, refs, SIGNUP_TOS_TEXT, SIGNUP_PRIVACY_TEXT });

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

// [LOG_ID: 20260713_1030] 90년대 모뎀 접속 연출 (ATDT 01410 -> CONNECT)
async function showConnectSequence() {
  const container = document.getElementById('terminal-screen');
  if (!container) return;

  const originalContent = container.innerHTML;
  container.innerHTML = '<div id="connect-seq" style="padding:20px; font-family:\'Sam3KRFont\',\'DungGeunMo\',\'GulimChe\',monospace; font-size:17px; color:#ffffff; line-height:1.6; white-space:pre-wrap;"></div>';
  const seqEl = document.getElementById('connect-seq');

  // [LOG_ID: 20260713_1155] 나우누리 테마 시 전용 모뎀 번호 및 접속 멘트 분기
  const isNownuri = state.theme === 'nownuri';
  const targetNumber = isNownuri ? '01411' : '01410';
  const targetLabel = isNownuri ? 'NOWNURI' : 'HiTEL';

  const lines = [
    `ATDT ${targetNumber}`,
    'DIALING...',
    `CONNECT 14400 / ${targetLabel}`
  ];

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  for (const line of lines) {
    if (line.startsWith('ATDT') || line.startsWith('CONNECT')) {
      for (let i = 0; i < line.length; i++) {
        seqEl.textContent += line[i];
        await delay(50);
      }
      seqEl.textContent += '\n';
      await delay(300);
    } else {
      seqEl.textContent += line + '\n';
      await delay(800);
    }
  }

  await delay(500);
  container.innerHTML = originalContent;
}

async function init() {
  restoreTheme(); // [LOG: 20260424_1755] 저장된 테마 즉시 복원
  await waitForPrimaryFonts();
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
    // [LOG: 20260416_2233] 병목 제거: 인증 초기화를 먼저 수행하여 중복 렌더링 방지
    try {
      await initAuth();
    } catch (authError) {
      console.warn('인증 초기화 실패 (손님 모드 지속):', authError.message);
    }

    if (window.location.pathname !== '/') {
      await restoreStateFromURL();
    } else {
      try {
        await showConnectSequence();
      } catch (err) {
        console.warn('접속 연출 실패:', err.message);
      }
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
