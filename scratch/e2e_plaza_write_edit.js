// [E2E] /board/plaza 글쓰기(W) → 저장(S) → 수정(E) 흐름 검증 스크립트
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3000';
const SHOT_DIR = path.join(__dirname, 'shots');
const STAMP = Date.now();
const TITLE = `E2E 글쓰기 검증 ${STAMP}`;
const TITLE_EDITED = `E2E 수정 검증 ${STAMP}`;

async function run() {
  const fs = require('fs');
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[console.${msg.type()}]`, msg.text().slice(0, 200));
    }
  });
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 300)));
  const shot = async (name) => {
    try {
      await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), timeout: 8000, animations: 'disabled' });
      console.log(`[shot] ${name}`);
    } catch (e) {
      console.log(`[shot 실패] ${name}: ${e.message.split('\n')[0]}`);
    }
  };
  const typeCmd = async (cmd, wait = 1200) => {
    await page.waitForSelector('#cmd-input');
    await page.fill('#cmd-input', cmd);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(wait);
  };
  const bodyText = async () => (await page.textContent('body')) || '';

  try {
    // 1. 로그인
    console.log('1) 로그인');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await typeCmd('claudee2e', 1500);
    await shot('01-login-id');
    await typeCmd('e2e-test-2026!', 3000);
    await shot('02-login-done');
    let text = await bodyText();
    if (text.includes('올바르지 않습니다') || text.includes('없습니다')) {
      throw new Error('로그인 실패: ' + text.slice(-300));
    }

    // 2. plaza 게시판 이동
    console.log('2) /board/plaza 이동');
    await page.goto(`${BASE}/board/plaza`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await shot('03-board-list');

    // 3. W → 글쓰기
    console.log('3) W (글쓰기 시작)');
    await typeCmd('W');
    await shot('04-write-header-stage');
    text = await bodyText();
    if (!text.includes('머리말')) throw new Error('머리말 단계가 뜨지 않음: ' + text.slice(-300));

    console.log('4) 머리말 2번(횡설수설) 선택');
    await typeCmd('2');
    await shot('05-write-title-stage');

    console.log('5) 제목 입력');
    await typeCmd(TITLE);
    await shot('06-write-body-stage');

    console.log('6) 본문 3줄 입력');
    await typeCmd('본문 첫째 줄입니다.', 400);
    await typeCmd('둘째 줄입니다.', 400);
    await typeCmd('셋째 줄 - 한글 인코딩 확인 (가나다라).', 400);
    await shot('07-write-body-filled');

    console.log('7) S (저장)');
    await typeCmd('S', 2500);
    await shot('08-after-save-list');
    text = await bodyText();
    if (!text.includes(`E2E 글쓰기 검증`)) throw new Error('저장 후 목록에 글이 없음: ' + text.slice(-500));

    // 4. 글 번호 찾기 (목록 텍스트에서)
    const m = text.match(/(\d+)\s+E2E테스터[^\n]*E2E 글쓰기 검증/);
    let postNo = m ? m[1] : null;
    if (!postNo) {
      // 화면 행 형식이 다를 수 있으니 번호만 다시 추출
      const rows = text.split('\n').filter((l) => l.includes('E2E 글쓰기 검증'));
      const m2 = rows[0] ? rows[0].match(/^\s*(\d+)/) : null;
      postNo = m2 ? m2[1] : null;
    }
    console.log('작성된 글 번호:', postNo);
    if (!postNo) throw new Error('글 번호를 찾지 못함');

    // 5. 글 읽기 확인
    console.log('8) 글 열람');
    await typeCmd(postNo, 2000);
    await shot('09-post-view');
    text = await bodyText();
    if (!text.includes('본문 첫째 줄입니다.')) throw new Error('본문이 표시되지 않음');

    // 6. 목록 복귀 후 E [번호] 수정
    console.log('9) 목록 복귀 후 E 수정');
    await typeCmd('L', 1500); // 첫장(목록)
    await typeCmd(`E ${postNo}`, 1500);
    await shot('10-edit-header-stage');
    text = await bodyText();
    if (!text.includes('글 수정')) throw new Error('수정 화면이 뜨지 않음: ' + text.slice(-300));

    console.log('10) 머리말 유지(엔터) → 제목 수정');
    await typeCmd('', 800); // 머리말 단계: 빈 입력 → 기존 유지
    await shot('11-edit-title-stage');
    await typeCmd(TITLE_EDITED, 800);
    await shot('12-edit-body-stage');

    console.log('11) 본문 한 줄 추가 후 저장');
    await typeCmd('수정에서 추가된 넷째 줄.', 400);
    await typeCmd('S', 2500);
    await shot('13-after-edit-list');
    text = await bodyText();
    if (!text.includes('E2E 수정 검증')) throw new Error('수정 제목이 목록에 반영되지 않음: ' + text.slice(-500));

    // 7. 수정 결과 열람
    console.log('12) 수정된 글 열람');
    await typeCmd(postNo, 2000);
    await shot('14-post-view-after-edit');
    text = await bodyText();
    if (!text.includes('수정에서 추가된 넷째 줄.')) throw new Error('수정 본문이 반영되지 않음');
    if (!text.includes('본문 첫째 줄입니다.')) throw new Error('기존 본문이 사라짐');

    console.log('\n=== 전체 흐름 성공 ===');
    console.log('작성/수정 글 번호:', postNo, '(검증 후 삭제 예정)');

    // 8. 정리: D [번호] 삭제
    console.log('13) 테스트 글 삭제');
    await typeCmd('L', 1500);
    await typeCmd(`D ${postNo}`, 1000);
    await shot('15-delete-confirm');
    text = await bodyText();
    // 삭제 확인 프롬프트가 있으면 Y
    if (text.includes('삭제') && (text.includes('Y/N') || text.includes('y/n') || text.includes('하시겠'))) {
      await typeCmd('Y', 2000);
    }
    await shot('16-after-delete');
    console.log('삭제 완료');
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('E2E 실패:', e.message);
  process.exit(1);
});
