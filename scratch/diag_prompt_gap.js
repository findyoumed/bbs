// [진단] PC/모바일 프롬프트-커서 공백 실측 비교
const { chromium, devices } = require('playwright');

const TARGETS = [
  { name: 'PC(1280x800)', options: { viewport: { width: 1280, height: 800 } } },
  { name: 'Mobile(iPhone 13)', options: { ...devices['iPhone 13'] } },
  { name: 'Mobile(Galaxy S9+)', options: { ...devices['Galaxy S9+'] } }
];

async function measure(page) {
  return await page.evaluate(() => {
    const renderer = document.getElementById('cmd-prompt-renderer');
    const wrapper = document.getElementById('cmd-input-wrapper');
    const input = document.getElementById('cmd-input');
    const cursor = document.querySelector('.terminal-cursor');
    const row = document.getElementById('terminal-prompt-row');
    if (!renderer || !input) return { error: 'no elements' };

    const cs = (el) => {
      const s = getComputedStyle(el);
      return {
        fontSize: s.fontSize,
        fontFamily: s.fontFamily.slice(0, 60),
        letterSpacing: s.letterSpacing,
        width: s.width,
        transform: s.transform,
        paddingLeft: s.paddingLeft,
        marginRight: s.marginRight
      };
    };

    // 같은 폰트로 실제 텍스트 진행폭 측정
    const s = getComputedStyle(renderer);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const promptText = renderer.value || '';
    const textWidth = ctx.measureText(promptText).width;

    const r = renderer.getBoundingClientRect();
    const w = wrapper ? wrapper.getBoundingClientRect() : null;
    const c = cursor ? cursor.getBoundingClientRect() : null;
    const rowRect = row ? row.getBoundingClientRect() : null;

    // 커서 left(inline style)
    const cursorLeft = cursor ? cursor.style.left : '';

    return {
      promptText,
      fontsLoaded: document.fonts.status,
      renderer: { rect: { x: r.x, w: r.width }, style: cs(renderer) },
      wrapper: w ? { x: w.x, w: w.width } : null,
      cursor: c ? { x: c.x, w: c.width, inlineLeft: cursorLeft } : null,
      input: { style: cs(input), valueLen: input.value.length },
      row: rowRect ? { x: rowRect.x, w: rowRect.width, padding: getComputedStyle(row).padding } : null,
      textWidthPx: textWidth,
      // 핵심 지표: 프롬프트 글자 끝 → 커서 시작 사이 간격(px)과 그것의 em 환산
      gapPx: c ? (c.x - (r.x + textWidth)) : null,
      emPx: parseFloat(s.fontSize)
    };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  for (const target of TARGETS) {
    const context = await browser.newContext(target.options);
    const page = await context.newPage();
    await page.goto('http://localhost:3000/board/plaza', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500); // 폰트/렌더 안정화
    const m = await measure(page);
    const gapEm = m.gapPx !== null && m.emPx ? (m.gapPx / m.emPx).toFixed(3) : 'n/a';
    console.log(`\n===== ${target.name} =====`);
    console.log(JSON.stringify(m, null, 1));
    console.log(`>>> 프롬프트 끝→커서 간격: ${m.gapPx !== null ? m.gapPx.toFixed(2) : 'n/a'}px = ${gapEm}em`);
    await page.screenshot({ path: `scratch/shots/gap-${target.name.replace(/[^\w]/g, '_')}.png` });
    await context.close();
  }
  await browser.close();
}

run().catch((e) => { console.error('진단 실패:', e.message); process.exit(1); });
