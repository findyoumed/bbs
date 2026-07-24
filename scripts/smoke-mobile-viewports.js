'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

async function waitForServer(port = 3199, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/api/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(500);
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error(`Server failed to respond on port ${port} within ${timeoutMs}ms`);
}

async function runMobileSmokeTests() {
  console.log('🚀 [Mobile Smoke] Starting local test server on port 3199...');
  const env = { ...process.env, PORT: '3199', NODE_ENV: 'test' };
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env,
    stdio: 'ignore'
  });

  try {
    await waitForServer(3199);
    console.log('✅ [Mobile Smoke] Test server ready.');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();
    const errors = [];

    page.on('pageerror', (err) => {
      console.error('  ❌ Page Uncaught Error:', err.message);
      errors.push({ type: 'pageerror', message: err.message });
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('  ❌ Console Error:', msg.text());
        errors.push({ type: 'console', message: msg.text() });
      }
    });

    const routesToTest = [
      { name: '메인 대문', path: 'http://localhost:3199/' },
      { name: '게시판 목록 (열린광장)', path: 'http://localhost:3199/board/plaza' },
      { name: '오락실 메인', path: 'http://localhost:3199/game' },
      { name: '오목 게임', path: 'http://localhost:3199/game/omok' },
      { name: '오델로 게임', path: 'http://localhost:3199/game/othello' },
      { name: '숫자야구 게임', path: 'http://localhost:3199/game/baseball' },
      { name: '행맨 게임', path: 'http://localhost:3199/game/hangman' },
      { name: '15-패즐 게임', path: 'http://localhost:3199/game/puzzle15' },
      { name: '스크램블 게임', path: 'http://localhost:3199/game/scramble' },
      { name: '단어맞추기(WP) 게임', path: 'http://localhost:3199/game/wp' },
      { name: '타자연습 게임', path: 'http://localhost:3199/game/typing' },
      { name: '퀴즈박사 게임', path: 'http://localhost:3199/game/quiz' },
      { name: '전투 게임', path: 'http://localhost:3199/game/battle' },
      { name: '로그인 화면', path: 'http://localhost:3199/entry/login' },
      { name: '회원가입 화면', path: 'http://localhost:3199/signup' }
    ];

    console.log(`📱 [Mobile Smoke] Testing ${routesToTest.length} routes in 390x844 mobile viewport...\n`);

    for (const route of routesToTest) {
      process.stdout.write(`  Testing ${route.name} (${route.path}) ... `);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      // 모바일 컨테이너 존재 및 가로 폭 오버플로우 체크
      const container = await page.$('#terminal-container');
      if (!container) {
        throw new Error(`#terminal-container missing on ${route.name}`);
      }

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      if (hasHorizontalScroll) {
        console.warn('⚠️ (Horizontal Overflow detected)');
      } else {
        console.log('OK');
      }
    }

    await browser.close();

    if (errors.length > 0) {
      console.error(`\n❌ [Mobile Smoke] Failed with ${errors.length} error(s)!`);
      process.exit(1);
    } else {
      console.log('\n🎉 [Mobile Smoke] ALL MOBILE ROUTES PASSED WITH 0 ERRORS!');
    }

  } finally {
    serverProcess.kill();
  }
}

runMobileSmokeTests().catch((err) => {
  console.error('\n❌ [Mobile Smoke] Test failed:', err);
  process.exit(1);
});
