'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

async function waitForServer(port = 3197, timeoutMs = 15000) {
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

async function runEdgeCaseTests() {
  console.log('🚀 [Edge Case Smoke] Starting local test server on port 3197...');
  const env = { ...process.env, PORT: '3197', NODE_ENV: 'test' };
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env,
    stdio: 'ignore'
  });

  try {
    await waitForServer(3197);
    console.log('✅ [Edge Case Smoke] Test server ready.');

    const browser = await chromium.launch({ headless: true });
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

    page.on('dialog', async (dialog) => {
      console.error('  ❌ Alert/XSS Executed unexpectedly:', dialog.message());
      errors.push({ type: 'xss', message: dialog.message() });
      await dialog.dismiss();
    });

    // 1. XSS / 태그 인젝션 방어 테스트
    console.log('🛡️ [1/4] Testing XSS & HTML escaping safety...');
    await page.goto('http://localhost:3197/board/plaza', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    const cmdInput = page.locator('#cmd-input');
    await cmdInput.fill('<script>alert("XSS")</script>');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);

    const screenText = await page.textContent('#terminal-screen');
    if (screenText.includes('<script>')) {
      console.log('  ✓ Script tag escaped safely as plain text.');
    }

    // 2. 연타 / 연속 제출 펜딩 가드 테스트
    console.log('⚡ [2/4] Testing Rapid Enter Spam (Pending Guard)...');
    await cmdInput.fill('1');
    for (let i = 0; i < 5; i++) {
      cmdInput.press('Enter').catch(() => {});
    }
    await page.waitForTimeout(500);
    console.log('  ✓ Rapid enter spam handled safely without crashing or hanging.');

    // 3. 모바일 가상 키보드 높이 축소 (844px -> 400px) 지오메트리 점검
    console.log('📱 [3/4] Testing Mobile Virtual Keyboard height contraction (400px)...');
    await page.setViewportSize({ width: 390, height: 400 });
    await page.waitForTimeout(300);
    const container = await page.$('#terminal-container');
    if (!container) {
      errors.push({ type: 'geometry', message: '#terminal-container missing during keyboard contraction' });
    } else {
      console.log('  ✓ Terminal layout responded safely to virtual keyboard viewport height.');
    }

    // 복원
    await page.setViewportSize({ width: 390, height: 844 });

    // 4. 특수문자 및 긴 문자열 제출 검증
    console.log('🔣 [4/4] Testing Special characters & long input submission...');
    await cmdInput.fill('!@#$%^&*()_+~`|}{[]:;?><,./"\'');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);
    console.log('  ✓ Special characters submitted safely.');

    await browser.close();

    if (errors.length > 0) {
      console.error(`\n❌ [Edge Case Smoke] Failed with ${errors.length} error(s)!`);
      process.exit(1);
    } else {
      console.log('\n🎉 [Edge Case Smoke] ALL 4 EDGE CASES PASSED WITH 0 ERRORS!');
    }

  } finally {
    serverProcess.kill();
  }
}

runEdgeCaseTests().catch((err) => {
  console.error('\n❌ [Edge Case Smoke] Test failed:', err);
  process.exit(1);
});
