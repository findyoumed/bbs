const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');
const { scoreArticleText } = require('../src/server/RssNewsArticleParserScoring');
const { isLikelyNoisyBody, sanitizeArticleText } = require('../src/server/RssNewsArticleSanitizer');

const SAMPLE_NEWS_ARTICLE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>첫 번째 속보</title>
    <meta property="og:title" content="첫 번째 속보">
    <meta property="og:description" content="요약 설명">
  </head>
  <body>
    <div class="sub_content article_cont">
      <div itemprop="articleBody" class="articleBody">
        <div class="article_txt">
          <div class="article_word" id="article_body">
            <div class="photo_view"><p>사진 설명</p></div>
            <br><br>[예시신문 홍길동 기자] 첫 번째 문단입니다. 이 문장은 기사 내용을 풍부하게 만들기 위해 작성된 정상적인 문장입니다.
            <br><br>두 번째 문단입니다. 기사 본문의 완성도를 높이기 위해서 각 문단의 글자 수를 충분히 늘려야 스코어링 조건에 만족하게 됩니다.
            <br><br><div class="view_center">광고 스크립트</div>세 번째 문단입니다. 뉴스의 핵심 사실과 정황을 자세하게 서술하는 단락이며, 독자가 읽기에 유용한 정보를 포함합니다.
            <br><br>네 번째 문단입니다. 기자가 발로 뛰어 취재한 생생한 현장의 목소리를 고스란히 담아내어 기사의 신뢰성을 한층 더 높였습니다.
            <br><br>다섯 번째 문단입니다. 본 기사 서비스는 독자들에게 실시간으로 안전하고 깨끗한 정보만을 전달하는 것을 목표로 합니다.
            <br><br>홍길동 기자 test@example.com
            <br><br>Copyright &copy; 예시신문. All rights reserved. 무단 전재, 재배포 및 AI학습 이용 금지
          </div>
          <div class="share_box">공유하기</div>
        </div>
        <div class="ranking_box">연예 랭킹</div>
      </div>
    </div>
  </body>
</html>`;

const detail = parseNewsArticleHtml(SAMPLE_NEWS_ARTICLE_HTML);
const detailBody = sanitizeArticleText(detail.body);

console.log('--- Raw Parsed Body ---');
console.log(JSON.stringify(detail.body));

console.log('\n--- Sanitized Body ---');
console.log(JSON.stringify(detailBody));

const score = scoreArticleText(detailBody, 'body');
console.log(`\nScore: ${score}`);

const penaltyPattern = /(\uB85C\uADF8\uC778|\uD68C\uC6D0\uAC00\uC785|\uAD11\uACE0|\uAE30\uC0AC\s*\uAD6C\uB3C5|\uAE30\uC0AC\uC81C\uBCF4|\uBB34\uB2E8\s*\uC804\uC7AC|\uC7AC\uBC30\uD3EC \uAE08\uC9C0|\uC804\uCCB4\uBA54\uB274|\uBCF8\uBB38\uC73C\uB85C \uBC14\uB85C\uAC00\uAE30|\uACF5\uC720\uD558\uAE30|\uAE00\uC790\uD06C\uAE30|\uAE30\uC0AC\s*\uC2A4\uD06C\uB7A9|\uD55C\uACBD\s*PREMIUM|\uD6C4\uC18D\uAE30\uC0AC|\uAD6C\uB3C5\uC2E0\uCCAD|ADVERTISEMENT|\uB3C5\uC790\uB4E4\uC758\s*PICK|\uC804\uCCB4\s*\uB0B4\uC6A9\uBCF4\uAE30|\uAE30\uC0AC\uBB38\uC758\s*\uBC0F\s*\uC81C\uBCF4|기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가)/;
const match = detailBody.match(penaltyPattern);
console.log(`Penalty Match: ${match ? match[0] : 'None'}`);

const isNoisy = isLikelyNoisyBody(detailBody);
console.log(`Is Likely Noisy: ${isNoisy}`);
