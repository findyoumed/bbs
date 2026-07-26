'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

async function waitForServer(port = 3198, timeoutMs = 15000) {
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

async function runArcadeInteractTests() {
  console.log('🚀 [Arcade Interact] Starting local test server on port 3198...');
  const env = { ...process.env, PORT: '3198', NODE_ENV: 'test' };
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env,
    stdio: 'ignore'
  });

  try {
    await waitForServer(3198);
    console.log('✅ [Arcade Interact] Test server ready.');

    // [LOG_ID: 20260725_2330] 이 환경에 미리 설치된 Chromium 리비전이 playwright 패키지가
    // 기대하는 리비전과 어긋나 기본 launch()가 "Executable doesn't exist"로 항상 실패했다
    // (smoke-mobile-viewports.js/smoke-full-traversal.js와 동일 원인) — 이 스크립트는 그동안
    // 이 환경에서 단 한 번도 실행된 적이 없었다.
    const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
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

    // 1. 오목 (omok)
    console.log('🎮 [1/10] Testing Omok (오목) turn & click...');
    await page.goto('http://localhost:3198/game/omok', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const cmdInput = page.locator('#cmd-input');
    await cmdInput.fill('H8');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 2. 오델로 (othello)
    // [LOG_ID: 20260725_2330] 실제 라우트 세그먼트는 'oth'다(routingStateRestorer.js) —
    // 'othello'는 존재하지 않아 조용히 초기화면으로 폴백했다(모바일 UI 육안 재점검 중 발견).
    console.log('🎮 [2/10] Testing Othello (오델로) turn & click...');
    await page.goto('http://localhost:3198/game/oth', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('C4');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 3. 숫자야구 (baseball)
    // [LOG_ID: 20260725_2330] 실제 라우트 세그먼트는 'base'다 — 'baseball'은 존재하지 않아
    // 조용히 초기화면으로 폴백했다.
    console.log('🎮 [3/10] Testing Baseball (숫자야구) guess...');
    await page.goto('http://localhost:3198/game/base', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('123');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 4. 행맨 (hangman)
    console.log('🎮 [4/10] Testing Hangman (행맨) letter guess...');
    await page.goto('http://localhost:3198/game/hangman', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('A');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 5. 15-패즐 (puzzle15)
    // [LOG_ID: 20260725_2330] 실제 라우트 세그먼트는 '16p'다 — 'puzzle15'는 존재하지 않아
    // 조용히 초기화면으로 폴백했다.
    console.log('🎮 [5/10] Testing Puzzle15 (15-패즐) tile move...');
    await page.goto('http://localhost:3198/game/16p', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('1');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 6. 스크램블 (scramble)
    console.log('🎮 [6/10] Testing Scramble (스크램블) word guess...');
    await page.goto('http://localhost:3198/game/scramble', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('test');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 7. WP (단어맞추기)
    console.log('🎮 [7/10] Testing WP (단어맞추기) word guess...');
    await page.goto('http://localhost:3198/game/wp', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('word');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 8. 타자연습 (typing)
    console.log('🎮 [8/10] Testing Typing (타자연습) sentence submission...');
    await page.goto('http://localhost:3198/game/typing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await cmdInput.fill('동해물과 백두산이 마르고 닳도록');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    // 9. 퀴즈박사 (quiz) & hotspot click
    console.log('🎮 [9/10] Testing Quiz (퀴즈박사) option click...');
    await page.goto('http://localhost:3198/game/quiz', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const quizHotspot = page.locator('.hotspot-btn').first();
    if (await quizHotspot.isVisible()) {
      await quizHotspot.click();
      await page.waitForTimeout(300);
    } else {
      await cmdInput.fill('1');
      await cmdInput.press('Enter');
      await page.waitForTimeout(300);
    }

    // 10. 전투게임 (battle) & hotspot click
    console.log('🎮 [10/10] Testing Battle (전투게임) grid attack & hotspot click...');
    await page.goto('http://localhost:3198/game/battle', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const battleHotspot = page.locator('.hotspot-btn').first();
    if (await battleHotspot.isVisible()) {
      await battleHotspot.click();
      await page.waitForTimeout(300);
    } else {
      await cmdInput.fill('G3');
      await cmdInput.press('Enter');
      await page.waitForTimeout(300);
    }

    await browser.close();

    if (errors.length > 0) {
      console.error(`\n❌ [Arcade Interact] Failed with ${errors.length} error(s)!`);
      process.exit(1);
    } else {
      console.log('\n🎉 [Arcade Interact] ALL 10 ARCADE GAMES PASSED TURNS & HOTSPOTS WITH 0 ERRORS!');
    }

  } finally {
    serverProcess.kill();
  }
}

runArcadeInteractTests().catch((err) => {
  console.error('\n❌ [Arcade Interact] Test failed:', err);
  process.exit(1);
});
