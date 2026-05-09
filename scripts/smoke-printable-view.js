'use strict';

const StateManager = require('../public/js/core/BbsStateBootstrap');
const { assert } = require('./lib/scriptUtils');

function main() {
  const articlePayload = StateManager.buildPrintablePayload({
    currentState: 'article_view',
    currentBoard: { name: '자유 게시판', boardId: 'plaza' },
    currentArticle: {
      id: 17,
      title: '한글 인쇄 테스트',
      nickName: '손님',
      userId: 'guest',
      createdAt: '2026-03-21T12:34:00+09:00',
      hit: 12,
      recommend: 3,
      content: '첫 줄\n둘째 줄'
    }
  });

  assert(articlePayload, 'article payload missing');
  assert(articlePayload.title === '자유 게시판 / #17', `unexpected article title: ${articlePayload.title}`);
  assert(articlePayload.lines.includes('한글 인쇄 테스트'), 'article title line missing');
  assert(articlePayload.lines.includes('첫 줄'), 'article content line missing');

  const servicePayload = StateManager.buildPrintablePayload({
    currentState: 'service_view',
    currentService: {
      kind: 'news',
      title: '뉴스 서비스',
      newspaper: { title: 'JTBC', door: '1' },
      category: { title: '속보', door: '1' },
      sourceUrl: 'https://example.com/rss',
      lines: ['제목: 첫 번째 속보', '', '본문 첫 줄', '본문 둘째 줄']
    }
  });

  assert(servicePayload, 'service payload missing');
  assert(servicePayload.lines.includes('JTBC'), 'service newspaper line missing');
  assert(servicePayload.lines.includes('속보'), 'service category line missing');
  assert(servicePayload.lines.includes('본문 둘째 줄'), 'service content line missing');

  const html = StateManager.renderPrintableHtml(articlePayload);
  assert(html.includes('<!doctype html>'), 'print html doctype missing');
  assert(html.includes('window.print()'), 'print html script missing');
  assert(html.includes('한글 인쇄 테스트'), 'print html content missing');

  console.log(JSON.stringify({
    ok: true,
    articleTitle: articlePayload.title,
    articleLineCount: articlePayload.lines.length,
    serviceTitle: servicePayload.title,
    serviceLineCount: servicePayload.lines.length
  }, null, 2));
}

main();
