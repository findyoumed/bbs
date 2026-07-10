// [진단] 글쓰기 화면 풋터의 "선택 >>" 잔재 DOM 확인
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const typeCmd = async (cmd, wait = 1200) => {
    await page.waitForSelector('#cmd-input');
    await page.fill('#cmd-input', cmd);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(wait);
  };
  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await typeCmd('claudee2e', 1500);
    await typeCmd('e2e-test-2026!', 3000);
    await page.goto('http://localhost:3000/board/plaza', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await typeCmd('W');

    const footerHtml = await page.evaluate(() => {
      const footer = document.getElementById('terminal-footer');
      return footer ? footer.outerHTML : '(no footer)';
    });
    console.log('=== terminal-footer HTML ===');
    console.log(footerHtml.slice(0, 4000));

    const promptRows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter((el) => {
        return el.children.length === 0 && /선택\s*>>/.test(el.textContent || '') === false && false;
      }).length;
    });
    void promptRows;
    const selMatches = await page.evaluate(() => {
      const hits = [];
      const walk = (el, path) => {
        for (const child of el.children) {
          const p = `${path}>${child.tagName.toLowerCase()}${child.id ? '#' + child.id : ''}${child.className && typeof child.className === 'string' ? '.' + child.className.split(' ').join('.') : ''}`;
          const ownText = Array.from(child.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('');
          const val = child.value !== undefined ? String(child.value || '') : '';
          if (/선택\s*>>/.test(ownText) || /선택\s*>>/.test(val)) {
            hits.push({ path: p, ownText: ownText.trim(), value: val });
          }
          walk(child, p);
        }
      };
      walk(document.body, 'body');
      return hits;
    });
    console.log('=== "선택 >>" 포함 요소 ===');
    console.log(JSON.stringify(selMatches, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error('진단 실패:', e.message); process.exit(1); });
