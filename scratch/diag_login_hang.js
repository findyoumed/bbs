// [진단] /login에서 회원 ID 제출 직후 페이지 응답 불능 원인 추적
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (msg) => console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300)));
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)));
  page.on('requestfailed', (req) => console.log('[reqfail]', req.url(), req.failure()?.errorText));
  page.on('dialog', (d) => { console.log('[dialog]', d.type(), d.message()); d.dismiss().catch(() => {}); });
  page.on('crash', () => console.log('[CRASH] 페이지 크래시!'));
  page.on('request', (req) => { if (req.url().includes('/api/')) console.log('[req]', req.method(), req.url()); });
  page.on('response', (res) => { if (res.url().includes('/api/')) console.log('[res]', res.status(), res.url()); });

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    console.log('로그인 화면 도착');

    await page.fill('#cmd-input', 'claudee2e');
    await page.keyboard.press('Enter');
    console.log('ID 제출됨. 1초 간격으로 상태 폴링...');

    for (let i = 1; i <= 12; i++) {
      await page.waitForTimeout(1000);
      try {
        const info = await page.evaluate(() => {
          const inp = document.querySelector('#cmd-input');
          return {
            ready: document.readyState,
            hasInput: Boolean(inp),
            inputVisible: inp ? inp.offsetParent !== null : false,
            active: document.activeElement ? document.activeElement.id || document.activeElement.tagName : '',
            tail: (document.body.innerText || '').slice(-200).replace(/\n/g, ' | ')
          };
        }, { timeout: 3000 });
        console.log(`[${i}s]`, JSON.stringify(info));
      } catch (e) {
        console.log(`[${i}s] evaluate 실패 (메인 스레드 블로킹 의심):`, e.message.split('\n')[0]);
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error('진단 실패:', e.message); process.exit(1); });
