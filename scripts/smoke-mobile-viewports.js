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
      { name: '혈액형 진단', path: 'http://localhost:3199/game/blood' },
      { name: '궁합 보기', path: 'http://localhost:3199/game/compat' },
      { name: '토정비결', path: 'http://localhost:3199/game/tojeong' },
      { name: '바이오리듬', path: 'http://localhost:3199/game/bio' },
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
      // [LOG_ID: 20260828_2000] AGORA는 메뉴 컨테이너, 투표 목록은 하위 VOTE 경로다.
      { name: '여론광장(투표) 목록', path: 'http://localhost:3199/agora/vote' },
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

          // Text can be clipped by a fixed-width child without increasing the
          // document scrollWidth (for example #terminal-screen has overflow-x:hidden).
          // Inspect text-node client rects as well, while explicitly allowing only
          // components that intentionally provide horizontal scrolling. The
          // generic .ansi-screen must remain visible to this check: its mobile
          // overflow-x:auto fallback would otherwise hide real text overflow.
          const overflowAllowed = (node) => {
            let element = node?.parentElement || node;
            while (element && element !== document.documentElement) {
              if (element.matches?.('.post-table, [data-mobile-overflow-allowed="true"]')) {
                return true;
              }
              element = element.parentElement;
            }
            return false;
          };

          const textOverflow = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let textNode;
          while ((textNode = walker.nextNode())) {
            const value = textNode.nodeValue?.replace(/\s+/g, ' ').trim();
            // Box-drawing separators are intentional ANSI decoration rather
            // than readable content; they may be wider than a phone while the
            // surrounding text remains fully usable. Keep the check focused on
            // letters/numbers (including Hangul) that users need to read.
            if (!value || !/[A-Za-z0-9가-힣]/.test(value) || overflowAllowed(textNode)) continue;
            const parent = textNode.parentElement;
            if (!parent || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(parent.tagName)) continue;
            if (parent.closest('[aria-hidden="true"]')) continue;
            const parentStyle = getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') continue;

            const range = document.createRange();
            range.selectNodeContents(textNode);
            let explicitlyClipped = false;
            for (let ancestor = parent; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
              const ancestorStyle = getComputedStyle(ancestor);
              // Accessibility-only labels use clip: rect(...) to hide their long
              // text while retaining a 1x1px focus/announcement target. Their
              // Range still reports the intrinsic text width, so do not treat it
              // as visible overflow.
              if (ancestorStyle.clip !== 'auto' || ancestorStyle.clipPath !== 'none') {
                explicitlyClipped = true;
                break;
              }
            }
            if (explicitlyClipped) {
              range.detach?.();
              continue;
            }
            for (const rect of range.getClientRects()) {
              if (rect.width <= 0 || rect.height <= 0) continue;
              const outsideLeft = rect.left < -1.5;
              const outsideRight = rect.right > window.innerWidth + 1.5;
              if (outsideLeft || outsideRight) {
                textOverflow.push({
                  tag: parent.tagName.toLowerCase(),
                  id: parent.id || '',
                  className: typeof parent.className === 'string' ? parent.className : '',
                  text: value.slice(0, 80),
                  left: Math.round(rect.left * 10) / 10,
                  right: Math.round(rect.right * 10) / 10
                });
                break;
              }
            }
            range.detach?.();
            if (textOverflow.length >= 8) break;
          }

          // Visible keyboard/touch controls should expose an accessible name.
          // The read-only prompt renderer is a visual clone (tabindex=-1), so
          // it is intentionally excluded from this check.
          const unnamedControls = [...document.querySelectorAll(
            'button, [role="button"], input:not([type="hidden"]), textarea, select, a[href]'
          )]
            .filter((el) => {
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.display !== 'none'
                && style.visibility !== 'hidden'
                && rect.width > 0
                && rect.height > 0
                && el.tabIndex !== -1;
            })
            .filter((el) => {
              const labelledBy = el.getAttribute('aria-labelledby')
                ?.split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent || '')
                .join(' ')
                .trim();
              const labelFor = el.id
                ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()
                : '';
              const accessibleName = el.getAttribute('aria-label')
                || labelledBy
                || labelFor
                || (el.innerText || el.textContent || '').trim()
                || el.getAttribute('title')
                || el.getAttribute('placeholder');
              return !accessibleName;
            })
            .slice(0, 8)
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              className: typeof el.className === 'string' ? el.className : ''
            }));

          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            footerBottom: footerRect ? footerRect.bottom : null,
            cmdInputBottom: cmdInputRect ? cmdInputRect.bottom : null,
            textOverflow,
            unnamedControls
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

        if (geometry.textOverflow.length > 0) {
          const first = geometry.textOverflow[0];
          const details = geometry.textOverflow
            .slice(0, 3)
            .map(item => `${item.tag}${item.id ? `#${item.id}` : ''}: "${item.text}" (${item.left}..${item.right})`)
            .join('; ');
          console.error(`  (Text outside mobile viewport: ${details})`);
          errors.push({
            type: 'text-horizontal-overflow',
            viewport: vp.label,
            message: `${route.name}: ${geometry.textOverflow.length} text node(s) extend beyond ${geometry.innerWidth}px (first: ${first.text})`
          });
          continue;
        }

        if (geometry.unnamedControls.length > 0) {
          const first = geometry.unnamedControls[0];
          console.error(`  (Interactive control has no accessible name: ${first.tag}#${first.id}.${first.className})`);
          errors.push({
            type: 'unnamed-control',
            viewport: vp.label,
            message: `${route.name}: ${first.tag}#${first.id || '(no-id)'} has no accessible name`
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

        // Interactive controls need a compact but usable touch target. Keep
        // this check focused on controls whose visual box is the hit area;
        // command tokens intentionally use a larger pseudo-element hit area.
        const undersizedTargets = await page.evaluate(() => {
          const selector = [
            '.ansi-hotspot',
            '.blood-hotspot',
            '.entry-signup-method',
            '.bbs-btn',
            '.myinfo-menu-item',
            '.terminal-notification-row.is-interactive'
          ].join(',');
          return [...document.querySelectorAll(selector)]
            .filter((el) => {
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.display !== 'none'
                && style.visibility !== 'hidden'
                && rect.width > 0
                && rect.height > 0
                && (rect.width < 24 || rect.height < 24);
            })
            .slice(0, 8)
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return {
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                className: typeof el.className === 'string' ? el.className : '',
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
                label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 40)
              };
            });
        });
        if (undersizedTargets.length > 0) {
          const first = undersizedTargets[0];
          console.error(`  (Interactive target below 24px: ${first.tag}.${first.className} ${first.width}x${first.height})`);
          errors.push({
            type: 'touch-target-size',
            viewport: vp.label,
            message: `${route.name}: interactive target ${first.label || first.className} is ${first.width}x${first.height}px`
          });
          continue;
        }

        console.log('OK');
      }

      // [LOG_ID: 20260831_0900] 기존 모바일 smoke는 레이아웃만 확인해
      // 터치 click이 실제 라우팅·게임 선택·편집기 포커스로 이어지는지 검증하지
      // 않았다. 각 viewport에서 대표적인 터치 흐름을 한 번씩 실행한다.
      await verifyMobileTouchInteractions(page, vp.label, errors);

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

async function verifyMobileTouchInteractions(page, viewportLabel, errors) {
  const reportFailure = (message) => {
    console.error(`  ❌ [Mobile Interaction] ${message}`);
    errors.push({ type: 'touch-interaction', viewport: viewportLabel, message });
  };

  try {
    await page.goto('http://localhost:3199/', { waitUntil: 'domcontentloaded' });
    // Cold mobile bootstrap can render the shell before TOP hotspots are
    // mounted. Wait for the actual interactive node instead of sampling a
    // fixed delay and reporting a false missing-control failure.
    // A cold bootstrap on the narrowest viewport can leave the shell in its
    // loading state for several seconds.  Waiting for both the rendered MAIN
    // screen and its actual hotspot avoids reporting a missing touch control
    // when the page simply has not finished hydration yet.
    await page.waitForFunction(
      () => document.body.dataset.screen === 'main'
        && Boolean(document.querySelector('.ansi-hotspot-layer button, .ansi-hotspot-layer [role="button"], .ansi-hotspot')),
      { timeout: 12000 }
    ).catch(() => {});
    await page.waitForTimeout(150);
    const topHotspot = page.locator('.ansi-hotspot-layer button, .ansi-hotspot-layer [role="button"], .ansi-hotspot').first();
    if (await topHotspot.count() === 0) {
      reportFailure('TOP 화면에 터치 가능한 메뉴 핫스팟이 없습니다.');
    } else {
      const beforeUrl = page.url();
      await topHotspot.tap();
      await page.waitForTimeout(450);
      const screen = await page.locator('#terminal-container').getAttribute('data-screen');
      if (page.url() === beforeUrl && screen === 'main') {
        reportFailure('TOP 메뉴 핫스팟 터치가 화면 전환으로 이어지지 않았습니다.');
      }
    }

    await page.goto('http://localhost:3199/game/blood', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    // 혈액형 입력은 프롬프트 안의 semantic span(.blood-hotspot)으로
    // 구현되어 있고, 일반 메뉴처럼 .ansi-hotspot-layer button을 쓰지 않는다.
    const bloodButtons = page.locator('.blood-hotspot');
    if (await bloodButtons.count() < 4) {
      reportFailure(`혈액형 선택 핫스팟 수가 부족합니다: ${await bloodButtons.count()}`);
    } else {
      await bloodButtons.first().tap();
      await page.waitForTimeout(350);
      const screen = await page.locator('#terminal-container').getAttribute('data-screen');
      if (screen !== 'blood-result') {
        reportFailure(`혈액형 선택 터치 후 결과 화면이 아닙니다: ${screen || 'unknown'}`);
      }
    }

    // [LOG_ID: 20260831_0900] 실제 모바일 편집기의 터치 포커스와
    // Enter 이동을 대표 쪽지 작성 흐름으로 확인한다. 테스트 사용자만
    // window.__debugState에 주입하며 서버 데이터는 쓰지 않는다.
    await page.goto('http://localhost:3199/memo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    await page.evaluate(() => {
      if (window.__debugState) {
        window.__debugState.user = {
          userId: 'qa-mobile-user',
          nickName: 'QA Mobile',
          level: 1,
          isAdmin: false,
          isGuest: false
        };
      }
    });
    const commandInput = page.locator('#cmd-input');
    if (await commandInput.count() !== 1) {
      reportFailure('모바일 쪽지 화면에 명령 입력창이 없습니다.');
      return;
    }
    await commandInput.tap();
    await commandInput.fill('W');
    await commandInput.press('Enter');
    // The narrowest viewport can defer layout while the keyboard-safe mobile
    // styles settle. Wait for the actual editor fields instead of relying on a
    // fixed delay, while keeping a bounded failure for a real routing defect.
    await page.waitForSelector('#memo-ed-target', { state: 'attached', timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(150);
    const target = page.locator('#memo-ed-target');
    const subject = page.locator('#memo-ed-subject');
    const body = page.locator('#memo-ed-body');
    if (await target.count() !== 1 || await subject.count() !== 1 || await body.count() !== 1) {
      reportFailure('모바일 쪽지 작성기의 입력 필드가 모두 렌더링되지 않았습니다.');
      return;
    }
    await target.tap();
    const focusedTarget = await page.evaluate(() => document.activeElement?.id || '');
    if (focusedTarget !== 'memo-ed-target') {
      reportFailure(`받는 사람 터치 포커스가 잘못되었습니다: ${focusedTarget || 'none'}`);
    }
    await target.press('Enter');
    const focusedSubject = await page.evaluate(() => document.activeElement?.id || '');
    if (focusedSubject !== 'memo-ed-subject') {
      reportFailure(`받는 사람 Enter 이동이 잘못되었습니다: ${focusedSubject || 'none'}`);
    }
    console.log(`  ✓ [Mobile Interaction] ${viewportLabel}: TOP·혈액형·쪽지 터치 흐름 통과`);
    // [LOG_ID: 20260831_1630] Mobile WMAIL editor: verify touch focus,
    // Enter/Tab navigation, and SEND hint without issuing an external request.
    await page.goto('http://localhost:3199/guide', { waitUntil: 'domcontentloaded' });
    // Supabase-backed bootstrap can take longer than the fixed route settle
    // delay on a cold mobile test server. Wait for the actual menu screen so
    // the following tap tests the rendered control rather than a loading gap.
    await page.waitForFunction(
      () => document.body.dataset.screen === 'board-select',
      { timeout: 3500 }
    ).catch(() => {});
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      if (window.__debugState) {
        window.__debugState.user = {
          userId: 'qa-mobile-contact',
          nickName: 'QA Mobile',
          level: 1,
          isAdmin: false,
          isGuest: false
        };
      }
    });
    const contactButton = page.locator(
      '.ansi-hotspot[aria-label*="TOSYSOP"], .ansi-hotspot-layer button[aria-label*="TOSYSOP"]'
    ).first();
    if (await contactButton.count() !== 1) {
      reportFailure('Mobile GUIDE contact button is missing.');
    } else {
      await contactButton.tap();
      await page.waitForSelector('#tosysop-ed-target', { state: 'attached', timeout: 2500 }).catch(() => {});
      const contactTarget = page.locator('#tosysop-ed-target');
      const contactSubject = page.locator('#tosysop-ed-subject');
      const contactBody = page.locator('#tosysop-ed-body');
      if (await contactTarget.count() !== 1 || await contactSubject.count() !== 1 || await contactBody.count() !== 1) {
        reportFailure('Mobile contact editor fields did not render.');
      } else {
        await contactTarget.tap();
        const targetFocus = await page.evaluate(() => document.activeElement?.id || '');
        await contactSubject.press('Enter');
        const bodyFocus = await page.evaluate(() => document.activeElement?.id || '');
        await contactBody.press('Tab');
        const commandFocus = await page.evaluate(() => document.activeElement?.id || '');
        // The recipient is fixed to sysop and readonly; tapping its row is
        // intentionally routed to the editable subject field.
        if (targetFocus !== 'tosysop-ed-subject' || bodyFocus !== 'tosysop-ed-body' || commandFocus !== 'cmd-input') {
          reportFailure(`Mobile contact Enter/Tab focus mismatch: ${targetFocus}/${bodyFocus}/${commandFocus}`);
        }
        const sendToken = page.locator('#cmd-hint [data-cmd="SEND"]').first();
        if (await sendToken.count() !== 1) {
          reportFailure('Mobile contact SEND hint token is missing.');
        } else {
          const hintBeforeSend = await page.locator('#cmd-hint').textContent();
          await sendToken.tap();
          await page.waitForTimeout(180);
          const sendResult = await page.evaluate(() => ({
            validation: document.querySelector('.tosysop-ed-validation')?.textContent || '',
            hint: document.querySelector('#cmd-hint')?.textContent || '',
            active: document.activeElement?.id || ''
          }));
          if (!sendResult.validation || sendResult.hint !== hintBeforeSend || sendResult.active !== 'tosysop-ed-subject') {
            reportFailure(`Mobile contact SEND hint action failed: ${JSON.stringify(sendResult)}`);
          }
        }
      }
    }

    // [LOG_ID: 20260831_1630] Board post-write command entry and P cancel
    // are exercised on the real mobile route without creating a persistent post.
    await page.goto('http://localhost:3199/board/plaza', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    await page.evaluate(() => {
      if (window.__debugState) {
        window.__debugState.user = {
          userId: 'qa-mobile-post',
          nickName: 'QA Mobile',
          level: 1,
          isAdmin: false,
          isGuest: false
        };
      }
    });
    const postCommandInput = page.locator('#cmd-input');
    await postCommandInput.tap();
    await postCommandInput.fill('W');
    await postCommandInput.press('Enter');
    await page.waitForTimeout(350);
    if (await page.locator('#terminal-container').getAttribute('data-screen') !== 'post-write') {
      reportFailure('Mobile board W command did not enter post-write.');
    } else {
      await postCommandInput.fill('1');
      await postCommandInput.press('Enter');
      await page.waitForTimeout(120);
      await postCommandInput.fill('Mobile test title');
      await postCommandInput.press('Enter');
      await page.waitForTimeout(120);
      await postCommandInput.fill('Mobile test body');
      await postCommandInput.press('Enter');
      await page.waitForTimeout(120);
      const cancelToken = page.locator('#cmd-hint [data-cmd="P"]').first();
      if (await cancelToken.count() !== 1) {
        reportFailure('Mobile post-write cancel hint token is missing.');
      } else {
        await cancelToken.tap();
        await page.waitForTimeout(250);
        const postScreen = await page.locator('#terminal-container').getAttribute('data-screen');
        if (postScreen === 'post-write') {
          reportFailure('Mobile post-write P hint did not cancel the editor.');
        }
      }
    }

    // [LOG_ID: 20260831_1630] Game command input must accept a touch-focused
    // Enter and keep validation inline instead of replacing the hint footer.
    await page.goto('http://localhost:3199/game/bio', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    const gameInput = page.locator('#cmd-input');
    const gameHintBefore = await page.locator('#cmd-hint').textContent();
    await gameInput.tap();
    await gameInput.fill('19900230');
    await gameInput.press('Enter');
    await page.waitForTimeout(220);
    const gameResult = await page.evaluate(() => ({
      error: document.querySelector('.game-inline-validation')?.textContent || '',
      hint: document.querySelector('#cmd-hint')?.textContent || '',
      screen: document.querySelector('#terminal-container')?.getAttribute('data-screen') || ''
    }));
    if (!gameResult.error || gameResult.hint !== gameHintBefore || gameResult.screen !== 'bio-input') {
      reportFailure(`Mobile game input/validation failed: ${JSON.stringify(gameResult)}`);
    }

    // Long user supplied values are not present in deterministic seed data on
    // every environment, so exercise the rendered post/news/memo containers
    // with a fixture that has both Hangul and an unbroken URL.  This catches
    // fixed-width children that document.scrollWidth alone can miss.
    await verifyMobileLongTextFlows(page, viewportLabel, errors);

  } catch (error) {
    reportFailure(error.message || String(error));
  }
}

async function verifyMobileLongTextFlows(page, viewportLabel, errors) {
  const reportFailure = (message) => {
    console.error(`  [Mobile Long Text] ${message}`);
    errors.push({ type: 'mobile-long-text', viewport: viewportLabel, message });
  };

  const checkFixture = async (route, expectedScreen, label) => {
    let postReadRoute;
    if (route) {
      // The post detail API normally uses view=1 and increments the hit count.
      // Rewrite this deterministic smoke request to view=0 so mobile layout
      // coverage remains read-only against a live Supabase-backed server.
      if (route === '/plaza/23') {
        postReadRoute = async (requestRoute) => {
          const requestUrl = new URL(requestRoute.request().url());
          requestUrl.searchParams.set('view', '0');
          await requestRoute.continue({ url: requestUrl.toString() });
        };
        await page.route('**/api/boards/plaza/posts/23*', postReadRoute);
      }
      try {
        await page.goto(`http://localhost:3199${route}`, { waitUntil: 'domcontentloaded' });
      } finally {
        if (postReadRoute) await page.unroute('**/api/boards/plaza/posts/23*', postReadRoute);
      }
    }
    await page.waitForFunction(
      (screen) => document.body.dataset.screen === screen,
      expectedScreen,
      { timeout: 3500 }
    ).catch(() => {});
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const body = document.querySelector('.ansi-screen-body');
      if (!body) return { missing: true, screen: document.body.dataset.screen || '' };

      const fixture = document.createElement('div');
      fixture.className = 'ansi-line mobile-long-text-fixture';
      fixture.dataset.mobileLongTextFixture = 'true';
      const span = document.createElement('span');
      span.className = 'ansi-fg-white';
      span.textContent = [
        '한글 긴 본문 줄바꿈 점검 ',
        'https://example.com/path/',
        'A'.repeat(180),
        ' 마지막 문장'
      ].join('');
      fixture.appendChild(span);
      body.appendChild(fixture);

      const range = document.createRange();
      range.selectNodeContents(span);
      const rects = [...range.getClientRects()]
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ left: rect.left, right: rect.right, width: rect.width }));
      const fixtureRect = fixture.getBoundingClientRect();
      const output = {
        screen: document.body.dataset.screen || '',
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: body.getBoundingClientRect().width,
        fixtureWidth: fixtureRect.width,
        fixtureScrollWidth: fixture.scrollWidth,
        fixtureClientWidth: fixture.clientWidth,
        rects
      };
      fixture.remove();
      range.detach?.();
      return output;
    });

    if (result.missing) {
      reportFailure(`${label}: .ansi-screen-body is missing on ${route} (${result.screen || 'unknown screen'})`);
      return;
    }
    if (result.screen !== expectedScreen) {
      reportFailure(`${label}: expected ${expectedScreen} but rendered ${result.screen || 'unknown screen'}`);
      return;
    }

    const overflowingRects = result.rects.filter((rect) => (
      rect.left < -1.5 || rect.right > result.viewport + 1.5
    ));
    const fixtureOverflow = result.fixtureScrollWidth > result.fixtureClientWidth + 1.5;
    if (result.scrollWidth > result.viewport + 1.5 || overflowingRects.length > 0 || fixtureOverflow) {
      reportFailure(`${label}: injected long text overflowed (${JSON.stringify({
        viewport: result.viewport,
        scrollWidth: result.scrollWidth,
        fixtureScrollWidth: result.fixtureScrollWidth,
        fixtureClientWidth: result.fixtureClientWidth,
        rects: result.rects.slice(0, 3)
      })})`);
    } else {
      console.log(`  [Mobile Long Text] ${viewportLabel}: ${label} wrapped within ${result.viewport}px`);
    }
  };

  // Direct post detail route ensures the post-view renderer is covered even
  // when the list fixture does not contain a long title/body.
  await checkFixture('/plaza/23', 'post-view', 'post-view');

  // Open a real news article through its command flow; direct article URLs
  // require transient metadata that is intentionally not hard-coded here.
  await page.goto('http://localhost:3199/service/news', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);
  const newsInput = page.locator('#cmd-input');
  await newsInput.fill('1');
  await newsInput.press('Enter');
  await page.waitForTimeout(850);
  await newsInput.fill('1');
  await newsInput.press('Enter');
  await page.waitForFunction(
    () => document.body.dataset.screen === 'news-view',
    { timeout: 3500 }
  ).catch(() => {});
  await page.waitForTimeout(300);
  const newsScreen = await page.evaluate(() => document.body.dataset.screen || '');
  if (newsScreen === 'news-view') {
    await checkFixture(null, 'news-view', 'news-view');
  } else {
    reportFailure(`news-view: article command flow did not reach news-view (${newsScreen || 'unknown screen'})`);
  }

  // Guest memo view still renders the same narrow body container. Injecting
  // through that renderer path covers long memo bodies without persisting data.
  await checkFixture('/memo/1', 'memo-view', 'memo-view');
}

runMobileSmokeTests().catch((err) => {
  console.error('\n❌ [Mobile Smoke] Test failed:', err);
  process.exit(1);
});
