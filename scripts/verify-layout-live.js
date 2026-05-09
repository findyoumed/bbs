const { chromium, devices } = require('playwright');
const path = require('path');

async function checkLayout(browser, name, viewport, isMobile = false) {
  console.log(`Checking layout: ${name} (${viewport.width}x${viewport.height}${isMobile ? ', Mobile' : ''})`);
  const context = await browser.newContext({
    viewport: viewport,
    ...(isMobile ? devices['iPhone 12'] : {})
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // 폰트/JS 대기

    const metrics = await page.evaluate(() => {
      const wrapper = document.getElementById('terminal-wrapper');
      const screen = document.getElementById('terminal-screen');
      const footer = document.getElementById('terminal-footer');
      const topbar = document.querySelector('.retro-topbar--ansi');
      const getBox = (el) => el ? el.getBoundingClientRect().toJSON() : null;
      return {
        wrapper: getBox(wrapper),
        screen: getBox(screen),
        footer: getBox(footer),
        topbar: getBox(topbar),
        footerState: footer ? footer.dataset.footerState : null,
        footerPlacement: footer ? footer.dataset.footerPlacement : null,
        windowHeight: window.innerHeight,
        bodyScrollHeight: document.body.scrollHeight
      };
    });

    console.log(`[${name}] Metrics:`, JSON.stringify(metrics, null, 2));

    if (metrics.topbar && metrics.topbar.y < 0) {
      console.error(`❌ [${name}] TOP CLIPPING DETECTED: Topbar Y is ${metrics.topbar.y}`);
    }
    
    if (!metrics.footer || metrics.footer.height === 0 || metrics.footer.y >= metrics.windowHeight) {
      console.error(`❌ [${name}] FOOTER INVISIBLE/OFFSCREEN: Y=${metrics.footer?.y}, WindowH=${metrics.windowHeight}`);
    }

    await page.screenshot({ path: `layout-check-${name.toLowerCase()}.png`, fullPage: false });
  } finally {
    await page.close();
    await context.close();
  }
}

async function verifyLayout() {
  const browser = await chromium.launch();
  
  await checkLayout(browser, 'Desktop-Standard', { width: 1280, height: 900 });
  await checkLayout(browser, 'Laptop-Small', { width: 1366, height: 768 });
  await checkLayout(browser, 'Mobile-Portrait', { width: 390, height: 844 }, true);

  await browser.close();
}

verifyLayout();
