const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Connecting to localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const typeCmd = async (cmd) => {
      console.log(`Typing command: ${cmd}`);
      await page.waitForSelector('#cmd-input');
      await page.fill('#cmd-input', cmd);
      await page.keyboard.press('Enter');
    };

    // 1. "GO NEWS" 입력 후 엔터
    await typeCmd('GO NEWS');
    await page.waitForTimeout(1500);

    // 2. 주제 선택 (예: "1" 입력 후 엔터)
    await typeCmd('1');
    await page.waitForTimeout(1500);

    // 3. 기사 선택 (예: "2" 입력 후 엔터)
    await typeCmd('2');
    
    // 기사가 제대로 로드될 때까지 대기
    console.log('Waiting for article details to load...');
    await page.waitForFunction(() => document.body.dataset.screen === 'news-view', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // 4. "ㅔㄱ" (PR의 한글 오타) 입력 후 엔터 (갈무리 모드 진입 시도)
    console.log('Triggering PR using typo: ㅔㄱ...');
    await typeCmd('ㅔㄱ');
    
    // 갈무리 모드(_printView)가 켜지고 body.dataset.printView === 'true'가 될 때까지 대기
    console.log('Waiting for print-view to active...');
    await page.waitForFunction(() => document.body.dataset.printView === 'true', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // 5. 스타일 및 본문 정보 덤프
    const dump = await page.evaluate(() => {
      const htmlEl = document.documentElement;
      const bodyEl = document.body;
      const lines = document.querySelectorAll('.ansi-line');
      
      return {
        renderedLineCount: lines.length,
        linesHTML: Array.from(lines).map(l => l.textContent.trim()).slice(-5),
        htmlDataPrintView: htmlEl.dataset.printView,
        bodyDataPrintView: bodyEl.dataset.printView
      };
    });

    console.log('Typo Test Results Dump:', JSON.stringify(dump, null, 2));

  } catch (error) {
    console.error('Typo Test failed:', error);
  } finally {
    await browser.close();
  }
}

run();
