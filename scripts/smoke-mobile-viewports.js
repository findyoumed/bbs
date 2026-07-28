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

    // [LOG_ID: 20260725_2200] 이 환경에 미리 설치된 Chromium 리비전이 playwright 패키지가 기대하는
    // 리비전과 어긋나 기본 launch()가 "Executable doesn't exist"로 항상 실패했다(smoke-full-traversal.js의
    // Playwright 폴백 감지에서도 같은 원인으로 확인된 패턴) — 미리 설치된 바이너리를 직접 가리킨다.
    const fs = require('fs');
    const customPath = '/opt/pw-browsers/chromium';
    const launchOptions = { headless: true };
    if (fs.existsSync(customPath)) {
      launchOptions.executablePath = customPath;
    }
    const browser = await chromium.launch(launchOptions);

    // [LOG_ID: 20260725_2200] 뷰포트 1개(iPhone 390x844)만 검사하면 그보다 좁은 실기기(작은
    // 안드로이드)에서만 나타나는 가로 오버플로우를 놓친다 — 폭이 다른 뷰포트 2개를 함께 돈다.
    const viewportsToTest = [
      {
        label: 'iPhone 14 (390x844)',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      },
      {
        label: '소형 안드로이드 (360x740)',
        viewport: { width: 360, height: 740 },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      },
      // [LOG_ID: 20260726_1430] 실기기 중 가장 좁은 축에 속하는 iPhone SE(1세대)/유사 소형
      // 기기 폭(320px)이 기존 두 뷰포트(360/390)보다 좁아 그 사이에서만 드러나는 가로
      // 오버플로우를 놓칠 수 있다 — 세 번째 뷰포트로 추가해 커버리지 공백을 메운다.
      {
        label: '초소형 iPhone SE (320x568)',
        viewport: { width: 320, height: 568 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1'
      }
    ];

    const errors = [];

    const routesToTest = [
      { name: '메인 대문', path: 'http://localhost:3199/' },
      { name: '게시판 목록 (열린광장)', path: 'http://localhost:3199/board/plaza' },
      { name: '오락실 메인', path: 'http://localhost:3199/game' },
      { name: '오목 게임', path: 'http://localhost:3199/game/omok' },
      // [LOG_ID: 20260725_2330] 실제 라우트 세그먼트(routingStateRestorer.js의 game() 핸들러)는
      // othello/baseball/puzzle15가 아니라 oth/base/16p다 — 잘못된 경로 3개가 매번 조용히
      // 초기화면으로 폴백해(routingStateRestorer.js의 !sub 아닌 fallthrough → showMain) 이
      // 세 게임 화면 자체가 한 번도 실제로 검사된 적이 없었다(모바일 UI 육안 재점검 중 발견 —
      // 실제 경로로 다시 캡처하자 오델로/숫자야구/15-퍼즐 모두 안내문이 44칸을 넘겨 잘려
      // 보이는 실제 버그가 드러났다, arcadeAnsiBuilders.js에서 별도로 수정).
      { name: '오델로 게임', path: 'http://localhost:3199/game/oth' },
      { name: '숫자야구 게임', path: 'http://localhost:3199/game/base' },
      { name: '행맨 게임', path: 'http://localhost:3199/game/hangman' },
      { name: '15-패즐 게임', path: 'http://localhost:3199/game/16p' },
      { name: '스크램블 게임', path: 'http://localhost:3199/game/scramble' },
      { name: '단어맞추기(WP) 게임', path: 'http://localhost:3199/game/wp' },
      { name: '타자연습 게임', path: 'http://localhost:3199/game/typing' },
      { name: '퀴즈박사 게임', path: 'http://localhost:3199/game/quiz' },
      { name: '전투 게임', path: 'http://localhost:3199/game/battle' },
      // [LOG_ID: 20260725_2330] /entry/login은 실제 라우팅 핸들러(routingStateRestorer.js에
      // rootSegment 'entry' 핸들러 자체가 없음)에 없는 잘못된 경로였다 — 실제 로그인 경로는
      // 'log' 루트 세그먼트 아래 leaf 'login'(menuService.js의 getAuthLeafRoutePath 기본값
      // '/log/login')이다. 이 라우트도 지금까지 조용히 초기화면으로 폴백해 로그인 화면 자체가
      // 한 번도 검사된 적이 없었다(위 오델로/숫자야구/15-퍼즐과 같은 유형의 결함).
      { name: '로그인 화면', path: 'http://localhost:3199/log/login' },
      { name: '회원가입 화면', path: 'http://localhost:3199/signup' },
      // [LOG_ID: 20260725_2200] 전수조사 요청("폭/높이·모바일 확인") — 오락실/로그인류 위주였던
      // 목록을 이번 세션에서 실제로 폭/높이 버그가 났던 화면들까지 넓힌다.
      { name: '자료실(PDS) 목록', path: 'http://localhost:3199/pds' },
      { name: '날씨', path: 'http://localhost:3199/service/weather' },
      { name: '뉴스', path: 'http://localhost:3199/service/news' },
      { name: '전체 메뉴 안내', path: 'http://localhost:3199/index' },
      { name: '도움말', path: 'http://localhost:3199/help' },
      { name: '이용 내역', path: 'http://localhost:3199/history' },
      { name: '여론광장(투표) 목록', path: 'http://localhost:3199/agora' },
      { name: '토론의 광장', path: 'http://localhost:3199/forum' },
      { name: '내 정보(게스트 안내)', path: 'http://localhost:3199/myinfo' },
      { name: '쪽지함(게스트 안내)', path: 'http://localhost:3199/memo' },
      { name: '대화실 로비', path: 'http://localhost:3199/chat' },
      { name: '이용약관', path: 'http://localhost:3199/policy/tos' }
    ];

    for (const vp of viewportsToTest) {
      console.log(`\n📱 [Mobile Smoke] ${vp.label} — testing ${routesToTest.length} routes...\n`);

      const context = await browser.newContext({
        viewport: vp.viewport,
        isMobile: true,
        hasTouch: true,
        userAgent: vp.userAgent
      });
      const page = await context.newPage();

      page.on('pageerror', (err) => {
        console.error('  ❌ Page Uncaught Error:', err.message);
        errors.push({ type: 'pageerror', viewport: vp.label, message: err.message });
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.error('  ❌ Console Error:', msg.text());
          errors.push({ type: 'console', viewport: vp.label, message: msg.text() });
        }
      });

      for (const route of routesToTest) {
        process.stdout.write(`  Testing ${route.name} (${route.path}) ... `);
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);

        // 모바일 컨테이너 존재 및 가로 폭 오버플로우 체크
        const container = await page.$('#terminal-container');
        if (!container) {
          throw new Error(`#terminal-container missing on ${route.name} (${vp.label})`);
        }

        // [LOG_ID: 20260725_2330] 실측으로 드러난 회귀: 존재하지 않는 라우트 세그먼트로
        // 요청하면(예: /game/othello — 실제는 /game/oth) routingStateRestorer.js가 조용히
        // showMain()으로 폴백해 초기화면(TOP)을 그린다. 이 스모크는 그 화면을 "정상 로드"로
        // 착각해 통과시켰고, 그 세 게임 화면(오델로/숫자야구/15-퍼즐)은 실제로 한 번도
        // 검사된 적이 없었다 — 의도된 메인 라우트가 아닌데 TOP/초기화면이 뜨면 실패시킨다.
        // 실측: 상단바 텍스트가 위 300ms 안에는 아직 비어 있는 경우가 있어(레이스), 최대
        // 3초까지 채워지길 기다린 뒤 읽는다(대부분은 300ms 안에 이미 채워져 추가 대기 없음).
        await page.waitForFunction(() => {
          const el = document.querySelector('.retro-topbar-center');
          return Boolean(el && el.textContent.trim().length > 0);
        }, { timeout: 3000 }).catch(() => {});
        const topbar = await page.evaluate(() => ({
          leftLabel: document.querySelector('.retro-topbar-menu')?.textContent?.trim() || '',
          centerLabel: document.querySelector('.retro-topbar-center')?.textContent?.trim() || ''
        }));
        const isMainRoute = route.name === '메인 대문';
        if (!isMainRoute && topbar.leftLabel === 'TOP' && topbar.centerLabel === '초기화면') {
          console.error(`❌ (Silently fell back to main menu — check the route path: ${route.path})`);
          errors.push({
            type: 'silent-fallback-to-main',
            viewport: vp.label,
            message: `${route.name}: route silently fell back to 초기화면(TOP) instead of loading — wrong path?`
          });
          continue;
        }

        const geometry = await page.evaluate(() => {
          const footer = document.getElementById('terminal-footer');
          const cmdInput = document.getElementById('cmd-input');
          const footerRect = footer?.getBoundingClientRect() || null;
          const cmdInputRect = cmdInput?.getBoundingClientRect() || null;
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            footerBottom: footerRect ? footerRect.bottom : null,
            cmdInputBottom: cmdInputRect ? cmdInputRect.bottom : null
          };
        });

        const hasHorizontalScroll = geometry.scrollWidth > geometry.innerWidth;
        // [LOG_ID: 20260725_2200] 사용자 요청("모바일에서 가로폭이 넘치면 안 된다", 이 세션 이전
        // 회차에서 이미 확정된 요구사항)에 맞춰 가로 오버플로우를 경고가 아니라 실패로 승격한다 —
        // 지금까지는 감지만 하고 통과 처리해 회귀를 잡지 못했다.
        if (hasHorizontalScroll) {
          console.error(`❌ (Horizontal Overflow: scrollWidth=${geometry.scrollWidth} > innerWidth=${geometry.innerWidth})`);
          errors.push({
            type: 'horizontal-overflow',
            viewport: vp.label,
            message: `${route.name}: scrollWidth ${geometry.scrollWidth} exceeds innerWidth ${geometry.innerWidth}`
          });
          continue;
        }

        // 하단 명령창/힌트바가 뷰포트 아래로 밀려 잘리지 않는지(세로 높이 문제) 함께 확인한다.
        const footerClipped = geometry.footerBottom !== null && geometry.footerBottom > geometry.innerHeight + 1;
        const cmdInputClipped = geometry.cmdInputBottom !== null && geometry.cmdInputBottom > geometry.innerHeight + 1;
        if (footerClipped || cmdInputClipped) {
          console.error(`❌ (Footer/Command input clipped below viewport: footerBottom=${geometry.footerBottom}, cmdInputBottom=${geometry.cmdInputBottom}, innerHeight=${geometry.innerHeight})`);
          errors.push({
            type: 'vertical-clip',
            viewport: vp.label,
            message: `${route.name}: footer/cmd-input extends past viewport height ${geometry.innerHeight}`
          });
          continue;
        }

        console.log('OK');
      }

      await context.close();
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
