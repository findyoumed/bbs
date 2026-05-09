'use strict';

const http = require('http');
const path = require('path');
const AssetManager = require('../src/core/AssetManager');
const MenuResolver = require('../src/server/MenuResolver');
const RssService = require('../src/server/RssService');
const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');
const { createAttachmentRepository } = require('../src/server/AttachmentRepository');
const { resolveLegacyPaths } = require('../src/server/projectPaths');
const { createBoardRepositoryFromEnv } = require('../src/server/BoardRepository');
const createRequestHandler = require('../src/server/createRequestHandler');

const SAMPLE_NEWS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss>
  <channel>
    <item>
      <title><![CDATA[첫 번째 속보]]></title>
      <author>JTBC</author>
      <link>https://example.com/news/1</link>
      <description><![CDATA[첫 줄<br>둘째 줄]]></description>
      <content:encoded><![CDATA[첫 줄<br>둘째 줄<br>셋째 줄<br>넷째 줄]]></content:encoded>
      <pubDate>Sat, 21 Mar 2026 10:00:00 +0900</pubDate>
    </item>
    <item>
      <title>두 번째 속보</title>
      <author>편집부</author>
      <link>https://example.com/news/2</link>
      <description>요약 &lt;b&gt;본문&lt;/b&gt;</description>
      <pubDate>Sat, 21 Mar 2026 11:00:00 +0900</pubDate>
    </item>
    <item>
      <title><![CDATA[아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도 - 헬스조선]]></title>
      <author>구글뉴스</author>
      <link>https://news.google.com/rss/articles/AU_yqL-google-news-test-token?oc=5</link>
      <description><![CDATA[아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도 헬스조선]]></description>
      <pubDate>Sat, 21 Mar 2026 12:00:00 +0900</pubDate>
    </item>
  </channel>
</rss>`;

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
            <br><br>[예시신문 홍길동 기자] 첫 번째 문단입니다.
            <br><br>두 번째 문단입니다.
            <br><br><div class="view_center">광고 스크립트</div>세 번째 문단입니다.
            <br><br>네 번째 문단입니다.
            <br><br>다섯 번째 문단입니다.
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

const SAMPLE_NEWS_NOISY_ARTICLE_HTML = String.raw`<!doctype html>
<html lang="ko">
  <body>
    <div class="articleBody">
      First clean paragraph.
      <br><br>Second clean paragraph.
      <br><br>\u201c\uc548 \ub0b4\ub9ac\uc790\u201d ... $(document).ready(function(){ _spinTopPickBest(spinTopParams, 1); }); trending widgets
    </div>
  </body>
</html>`;

const SAMPLE_GOOGLE_NEWS_WRAPPER_HTML = `<!doctype html>
<html lang="ko">
  <body>
    <c-wiz>
      <div data-n-a-sg="test-google-news-signature" data-n-a-ts="1714919580"></div>
    </c-wiz>
  </body>
</html>`;

const SAMPLE_GOOGLE_NEWS_RESOLVED_MOBILE_URL = 'https://m.health.chosun.com/svc/news_view.html?contid=2026050402115';
const SAMPLE_GOOGLE_NEWS_RESOLVED_MOBILE_URL_ESCAPED = 'https://m.health.chosun.com/svc/news_view.html?contid\\u003d2026050402115';
const SAMPLE_GOOGLE_NEWS_CANONICAL_URL = 'https://health.chosun.com/site/data/html_dir/2026/05/04/2026050402115.html';

const SAMPLE_GOOGLE_NEWS_BATCH_RESPONSE = `)]}'

[[["wrb.fr","Fbv4je","[[\\\"garturlres\\\",\\\"${SAMPLE_GOOGLE_NEWS_RESOLVED_MOBILE_URL_ESCAPED}\\\",1]]",null,null,null,"generic"]]]`;

const SAMPLE_GOOGLE_NEWS_SOURCE_ARTICLE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도</title>
    <meta property="og:title" content="아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도">
    <meta property="og:description" content="구글뉴스 원문 첫 줄 요약">
  </head>
  <body>
    <div class="article_body">
      출생 후 15~43주에 금속 노출량이 많았던 아동은 전체 뇌 부피가 작아지는 경향을 보였다./사진=클립아트코리아
      <br><br>
      내과
      <br><br>아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도
      <br><br>전종보 헬스조선 기자
      <br><br>입력 2026.05.05 22:33
      <br><br>정부와 여당이 영유아 실내마스크 착용 해제를 검토하고 있다.
      <br><br>영유아는 입 모양을 보고 말을 배워야 하지만, 마스크에 얼굴이 가려져 언어 습득이 늦어질 수 있다.
      <br><br>오랜 기간 마스크 착용으로 인해 영유아 언어능력이나 사회성이 저하될 우려가 있다는 의견도 이어졌다.
      <br><br>관련기사
      <br><br>실내 마스크 해제·입국 후 PCR 폐지되나
      <br><br>헬스조선을 만나는 또다른 방법
      <br><br>PC버전
      <br><br>맨위로 ↑
      <br><br>기사 전체보기
      <br><br>저작권자
    </div>
  </body>
</html>`;

const SAMPLE_GOOGLE_NEWS_MOBILE_ARTICLE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도 - 모바일</title>
    <meta property="og:title" content="아기들 ‘이것’ 입에 넣다가… 뇌에 문제 생길 수도 - 모바일">
    <meta property="og:description" content="모바일 요약">
  </head>
  <body>
    <div class="wrapper">모바일 래퍼만 내려오는 페이지</div>
  </body>
</html>`;

const SAMPLE_NEWS_SBS_TAIL = `정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.

ⓒ SBS & SBS i / RSS 피드는 개인 리더 이용 목적으로 허용 되어 있습니다. 피드를 이용한 게시 등의 무단 복제는 금지 되어 있습니다. ▶ SBS 뉴스 앱 다운로드 ▶ 뉴스에 지식을 담다 - 스브스프리미엄 앱 다운로드 ⓒ SBS & SBS i : 무단복제 및 재배포 금지
▲&nbsp;

▶ 이 기사의 전체 내용 확인하기 ▶ SBS 뉴스 앱 다운로드 ▶ 뉴스에 지식을 담다 - 스브스프리미엄 앱 다운로드 ⓒ SBS & SBS i : 무단복제 및 재배포 금지`;

const SAMPLE_NEWS_SBS_BODY = `ⓒ SBS & SBS i / RSS 피드는 개인 리더 이용 목적으로 허용 되어 있습니다. 피드를 이용한 게시 등의 무단 복제는 금지 되어 있습니다.

▶ SBS 뉴스 앱 다운로드

▶ 뉴스에 지식을 담다 - 스브스프리미엄 앱 다운로드

ⓒ SBS & SBS i  : 무단복제 및 재배포 금지

정상 본문 첫 문단입니다. 핵심 요약이 있었…
▶ 영상 시청

정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.`;

const SAMPLE_NEWS_HANKYUNG_BODY = `사회

한경 PREMIUM9

AI를 넘어서는 성공투자,

한경 프리미엄9

구독하기

막 오른 영재학교 입시…'삼전닉스 효과' 있을까

입력 2026.05.05 17:52

수정 2026.05.05 17:52

지면 A25

기사 스크랩

기사 스크랩

댓글

댓글

기사 공유

글자크기 조절

글자크기

고재연

기자 구독하기

6일부터 원서접수, 789명 선발

"이공계 선호로 경쟁 치열할 듯"

2027학년도 전국 영재학교 입시가 본격적으로 막을 올린다. 전국 8개 영재학교는 6일부터 13일까지 원서 접수를 한다.

올해는 이공계 선호 현상이 강해지면서 경쟁률이 높아질 것으로 보인다.

고재연 기자 yeon@hankyung.com

좋아요

싫어요

후속기사 원해요

ⓒ 한경닷컴, 무단전재 및 재배포 금지

한국경제 구독신청
한경프리미엄9 구독신청

고재연 기자

한국경제신문 정치부 기자입니다.

ADVERTISEMENT

이 시각 관심정보

AD`;

const SAMPLE_NEWS_RECOMMENDATION_TAIL = `정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.

독자들의 PICK!

중1딸 목욕 도와주는 남편, 부녀의 정? 성추행?

"KCM이 숨겼다"…절친 비도 놀란 13년 결혼생활의 비밀`;

const SAMPLE_NEWS_CHOSUN_INLINE_RELATED = `5일 광주 기아챔피언스필드에서 열린 KIA와 한화의 경기. 승리한 KIA 김도영, 이범호 감독이 기뻐하고 있다. 광주=박재만 기자 pjm@sportschosun.com/2026.05.05/ ▲ 최준희, '故 최진실' 떠올린 웨딩화보..'11살 연상' 남편 공개 ▲ “화장실서 시체 썩은내”..살인 혐의 유명 가수, 생방송서 증거 딱 잡혔다 ▲ 리주, 갑작스`;

const SAMPLE_NEWS_FULL_CONTENT_TAIL = `정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.

전체 내용보기`;

const SAMPLE_NEWS_YONHAPTV_TAIL = `정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.

[뉴스리뷰]

연합뉴스TV 기사문의 및 제보 : 카톡/라인 jebo23

윤솔(solemio@yna.co.kr)`;

const SAMPLE_NEWS_ENTITY_BODY = `&ldquo;정상 본문&rdquo; 첫 문단입니다.

반복 캡션입니다.

반복 캡션입니다.

둘째 문단입니다.`;

const SAMPLE_NEWS_MEDIA_FALLBACK_BODY = `브라우저가 video 태그를 지원하지 않습니다.

죄송하지만 다른 브라우저를 사용하여 주십시오.

브라우저가 오디오 태그를 지원하지 않습니다.

[앵커]

정상 본문 첫 문단입니다.`;

const SAMPLE_NEWS_SCRIPT_DATA_ARTICLE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta property="og:description" content="잘린 RSS 요약..">
  </head>
  <body>
    <script>
      window.__PRELOADED_STATE__ = {
        "news": {
          "article": {
            "paragraphs": [
              { "type": "paragraph", "content": "첫 번째 구조화 문단입니다." },
              { "type": "paragraph", "content": "두 번째 구조화 문단입니다." },
              { "type": "paragraph", "value": "세 번째 구조화 문단입니다." }
            ]
          }
        }
      };
    </script>
  </body>
</html>`;

const SAMPLE_NEWS_LEAD_CAPTION_BODY = `큰사진보기

▲ 맹수석 대전시교육감 예비후보가 학생들을 위한 '생활법률 3종 세트' 공약을 발표했다 ⓒ프레시안DB 관련사진보기

정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.`;

const SAMPLE_NEWS_YONHAP_LEAD_BODY = `백나리 기자

이유미 기자

전황 브리핑서 기여 촉구…미군이 '피격의혹' 한국 선박과 "소통중"
일본·호주·유럽의 역할 강화도 촉구…"이란과의 휴전 무너진 것 아니다"

전황 브리핑하는 헤그세스 미 국방장관
(워싱턴 로이터=연합뉴스 재판매 및 DB금지)

(워싱턴=연합뉴스) 백나리 이유미 특파원 = 정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.`;

const SAMPLE_NEWS_LEAD_BOILERPLATE_BODY = `김연숙 기자, 이영호 기자 =

(서울=연합뉴스)

[서울=뉴시스]

[곽재훈 기자(jhkwak@example.com)]

▲ 피트 헤그세스 미국 국방장관

(사진=연합뉴스)

(사진=AFC 홈페이지 캡처)

[AFP=연합뉴스 자료사진. 재판매 및 DB 금지]

(워싱턴 로이터=연합뉴스 재판매 및 DB금지)

*재판매 및 DB 금지

정부는 회의 결과를 토대로 후속 조치를 마련하겠다고 밝혔다.

(서울=연합뉴스) 김연숙 기자 = 정상 본문 첫 문단입니다.

이영호 기자 = 정상 본문 둘째 문단입니다.`;

const SAMPLE_NEWS_LEAD_IMAGE_CREDIT_BODY = `유토이미지

AP 뉴시스

ⓒ뉴시스

함께하는 사랑밭 제공

정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.`;

const SAMPLE_NEWS_LEAD_IMAGE_CAPTION_BODY = `현지 증권사 통해 국내 주식 거래

기존엔 실명-여권번호 등 노출

크게보기

서울 여의도 금융감독원 모습. 2018.4.17 뉴스1

정상 본문 첫 문단입니다.

정상 본문 둘째 문단입니다.`;

const SAMPLE_WEATHER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss>
  <channel>
    <item>
      <description>
        <body>
          <data>
            <hour>6</hour>
            <day>0</day>
            <temp>7</temp>
            <tmx>12</tmx>
            <tmn>3</tmn>
            <pop>20</pop>
            <wfKor>맑음</wfKor>
            <ws>2.4</ws>
            <wdKor>북동</wdKor>
          </data>
          <data>
            <hour>12</hour>
            <day>1</day>
            <temp>14</temp>
            <tmx>16</tmx>
            <tmn>8</tmn>
            <pop>60</pop>
            <wfKor>구름많음</wfKor>
            <ws>4.9</ws>
            <wdKor>남서</wdKor>
          </data>
        </body>
      </description>
    </item>
  </channel>
</rss>`;

async function request(base, pathname) {
  const response = await fetch(base + pathname);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${pathname} -> ${JSON.stringify(payload)}`);
  }
  return payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')
    ? payload.data
    : payload;
}

function createFakeFetch() {
  const stats = { total: 0 };
  const fakeFetch = async function fakeFetch(url, options = {}) {
    stats.total += 1;
    const source = String(url || '');
    const method = String(options?.method || 'GET').toUpperCase();
    if (source.includes('hr1-forecast') || source.includes('/weather/') || source.includes('weather.go.kr')) {
      return { ok: true, url: source, text: async () => SAMPLE_WEATHER_XML };
    }
    if (method === 'POST' && source.includes('news.google.com/_/DotsSplashUi/data/batchexecute')) {
      return { ok: true, url: source, text: async () => SAMPLE_GOOGLE_NEWS_BATCH_RESPONSE };
    }
    if (source.includes('news.google.com/articles/') || source.includes('news.google.com/rss/articles/')) {
      return { ok: true, url: source, text: async () => SAMPLE_GOOGLE_NEWS_WRAPPER_HTML };
    }
    if (source.includes('m.health.chosun.com/svc/news_view.html')) {
      return { ok: false, status: 404, url: source, text: async () => 'mobile wrapper should not be fetched directly' };
    }
    if (source.includes('health.chosun.com/site/data/html_dir/2026/05/04/2026050402115.html')) {
      return { ok: true, url: source, text: async () => SAMPLE_GOOGLE_NEWS_SOURCE_ARTICLE_HTML };
    }
    if (source.includes('example.com/news/')) {
      return { ok: true, url: source, text: async () => SAMPLE_NEWS_ARTICLE_HTML };
    }
    return { ok: true, url: source, text: async () => SAMPLE_NEWS_XML };
  };
  fakeFetch.stats = stats;
  return fakeFetch;
}

async function main() {
  process.env.BOARD_REPOSITORY_DRIVER = 'memory';
  const legacyPaths = resolveLegacyPaths(process.env, path.resolve(__dirname, '..'));

  const fakeFetch = createFakeFetch();
  const rssService = new RssService({
    newsMenuPath: legacyPaths.newsMenuPath,
    weatherMenuPath: legacyPaths.weatherMenuPath,
    fetchImpl: fakeFetch,
    cacheTtlMs: 1000,
    prefetchNewsTopicsOnMenu: false
  });

  const boardRepository = createBoardRepositoryFromEnv(process.env);
  const requestHandler = createRequestHandler({
    projectRoot: path.resolve(__dirname, '..'),
    assetManager: new AssetManager(legacyPaths.legacyTxtPath),
    boardRepository,
    attachmentRepository: createAttachmentRepository(path.resolve(__dirname, '..')),
    menuResolver: new MenuResolver(legacyPaths.menuFilePath),
    rssService
  });

  const weatherMenu = await rssService.listWeatherRegions();
  const weatherOverview = await rssService.getNationalWeatherFeed();
  const weatherFeed = await rssService.getWeatherFeed('1');
  const newsMenu = await rssService.listNewsTopics();
  const newsFeed = await rssService.getNewsTopicFeed('1');
  const newsArticleKeys = newsFeed.items.map((item) => item.articleKey || '').filter(Boolean);
  if (new Set(newsArticleKeys).size !== newsArticleKeys.length) {
    throw new Error(`aggregated news topic contains duplicate article keys: ${JSON.stringify(newsFeed.items.map((item) => ({ no: item.no, title: item.title, key: item.articleKey })))}`);
  }
  const duplicatedCachedNewsFeed = {
    ...newsFeed,
    items: [
      newsFeed.items[0],
      { ...newsFeed.items[0], no: 999 },
      ...newsFeed.items.slice(1)
    ]
  };
  await rssService.news._setCachedTopicFeed(rssService.news._getTopicFeedCacheKey('1'), duplicatedCachedNewsFeed);
  const repairedCachedNewsFeed = await rssService.getNewsTopicFeed('1');
  const repairedArticleKeys = repairedCachedNewsFeed.items.map((item) => item.articleKey || '').filter(Boolean);
  if (repairedCachedNewsFeed.items.length !== newsFeed.items.length || new Set(repairedArticleKeys).size !== repairedArticleKeys.length) {
    throw new Error(`cached duplicate news topic repair failed: ${JSON.stringify(repairedCachedNewsFeed.items.map((item) => ({ no: item.no, title: item.title, key: item.articleKey })))}`);
  }
  if (repairedCachedNewsFeed.items.some((item, index) => Number(item.no) !== index + 1)) {
    throw new Error(`cached duplicate news topic repair did not renumber items: ${JSON.stringify(repairedCachedNewsFeed.items.map((item) => item.no))}`);
  }
  await rssService.news._setCachedTopicFeed(rssService.news._getTopicFeedCacheKey('1'), newsFeed);
  const fetchCountAfterFirstNewsFeed = fakeFetch.stats.total;
  await rssService.getNewsTopicFeed('1');
  if (fakeFetch.stats.total !== fetchCountAfterFirstNewsFeed) {
    throw new Error(`aggregated news topic cache miss: ${fakeFetch.stats.total} != ${fetchCountAfterFirstNewsFeed}`);
  }
  const newsArticle = await rssService.getNewsArticle('1', '1');
  const googleNewsFeedItem = newsFeed.items.find((item) => /news\.google\.com\/rss\/articles\//i.test(String(item?.link || '')));
  const selectedArticle = newsFeed.items.find((item) => item.link === 'https://example.com/news/1');
  if (!selectedArticle?.articleKey) {
    throw new Error(`news article stable key missing: ${JSON.stringify(selectedArticle)}`);
  }
  if (!googleNewsFeedItem?.articleKey) {
    throw new Error(`google news article stable key missing: ${JSON.stringify(googleNewsFeedItem)}`);
  }
  const reorderedNewsFeed = {
    ...newsFeed,
    items: newsFeed.items.slice().reverse().map((item, index) => ({ ...item, no: index + 1 }))
  };
  await rssService.news._setCachedTopicFeed(rssService.news._getTopicFeedCacheKey('1'), reorderedNewsFeed);
  const stableArticle = await rssService.getNewsArticle('1', '1', {
    articleKey: selectedArticle.articleKey,
    link: selectedArticle.link
  });
  if (stableArticle.article?.link !== selectedArticle.link) {
    throw new Error(`stable news article lookup failed: ${stableArticle.article?.link} !== ${selectedArticle.link}`);
  }
  const googleNewsArticle = await rssService.getNewsArticle('1', String(googleNewsFeedItem.no), {
    articleKey: googleNewsFeedItem.articleKey,
    link: googleNewsFeedItem.link
  });
  const googleNewsBody = googleNewsArticle.article?.body || '';
  if (!googleNewsBody.includes('오랜 기간 마스크 착용으로 인해 영유아 언어능력이나 사회성이 저하될 우려가 있다는 의견도 이어졌다.')) {
    throw new Error(`google news article resolution failed: ${googleNewsBody}`);
  }
  if (googleNewsArticle.article?.link !== googleNewsFeedItem.link) {
    throw new Error(`google news original link was not preserved: ${googleNewsArticle.article?.link}`);
  }
  if (googleNewsArticle.article?.sourceLink !== SAMPLE_GOOGLE_NEWS_CANONICAL_URL) {
    throw new Error(`google news source link missing: ${googleNewsArticle.article?.sourceLink}`);
  }
  if (/헬스조선$/.test(googleNewsBody)) {
    throw new Error(`google news teaser body was not replaced: ${googleNewsBody}`);
  }
  if (/관련기사|헬스조선을 만나는 또다른 방법|PC버전|맨위로|기사 전체보기|저작권자|\/사진=클립아트코리아/.test(googleNewsBody)) {
    throw new Error(`google news canonical article cleanup failed: ${googleNewsBody}`);
  }
  const fallbackFetchStats = { mobileHits: 0, canonicalHits: 0 };
  const fallbackFetch = async (url, options = {}) => {
    const source = String(url || '');
    const method = String(options?.method || 'GET').toUpperCase();
    if (source.includes('hr1-forecast') || source.includes('/weather/') || source.includes('weather.go.kr')) {
      return { ok: true, url: source, text: async () => SAMPLE_WEATHER_XML };
    }
    if (method === 'POST' && source.includes('news.google.com/_/DotsSplashUi/data/batchexecute')) {
      return { ok: false, status: 500, url: source, text: async () => 'decode failed' };
    }
    if (source.includes('news.google.com/articles/') || source.includes('news.google.com/rss/articles/')) {
      fallbackFetchStats.mobileHits += 1;
      return { ok: true, url: SAMPLE_GOOGLE_NEWS_RESOLVED_MOBILE_URL, text: async () => SAMPLE_GOOGLE_NEWS_MOBILE_ARTICLE_HTML };
    }
    if (source.includes('health.chosun.com/site/data/html_dir/2026/05/04/2026050402115.html')) {
      fallbackFetchStats.canonicalHits += 1;
      return { ok: true, url: source, text: async () => SAMPLE_GOOGLE_NEWS_SOURCE_ARTICLE_HTML };
    }
    if (source.includes('example.com/news/')) {
      return { ok: true, url: source, text: async () => SAMPLE_NEWS_ARTICLE_HTML };
    }
    return { ok: true, url: source, text: async () => SAMPLE_NEWS_XML };
  };
  const fallbackRssService = new RssService({
    newsMenuPath: legacyPaths.newsMenuPath,
    weatherMenuPath: legacyPaths.weatherMenuPath,
    fetchImpl: fallbackFetch,
    cacheTtlMs: 1000,
    prefetchNewsTopicsOnMenu: false
  });
  const fallbackNewsFeed = await fallbackRssService.getNewsTopicFeed('1');
  const fallbackGoogleNewsFeedItem = fallbackNewsFeed.items.find((item) => /news\.google\.com\/rss\/articles\//i.test(String(item?.link || '')));
  const fallbackGoogleNewsArticle = await fallbackRssService.getNewsArticle('1', String(fallbackGoogleNewsFeedItem?.no || ''), {
    articleKey: fallbackGoogleNewsFeedItem?.articleKey,
    link: fallbackGoogleNewsFeedItem?.link
  });
  if (!String(fallbackGoogleNewsArticle.article?.body || '').includes('오랜 기간 마스크 착용으로 인해 영유아 언어능력이나 사회성이 저하될 우려가 있다는 의견도 이어졌다.')) {
    throw new Error(`google news canonical refetch fallback failed: ${fallbackGoogleNewsArticle.article?.body || ''}`);
  }
  if (fallbackGoogleNewsArticle.article?.sourceLink !== SAMPLE_GOOGLE_NEWS_CANONICAL_URL) {
    throw new Error(`google news canonical refetch source link failed: ${fallbackGoogleNewsArticle.article?.sourceLink}`);
  }
  if (fallbackFetchStats.mobileHits < 1 || fallbackFetchStats.canonicalHits < 1) {
    throw new Error(`google news canonical refetch path not exercised: ${JSON.stringify(fallbackFetchStats)}`);
  }
  let mismatchedKeyRejected = false;
  try {
    await rssService.getNewsArticle('1', '1', { articleKey: 'missing-news-article-key' });
  } catch (error) {
    mismatchedKeyRejected = Number(error.status || 0) === 404;
  }
  if (!mismatchedKeyRejected) {
    throw new Error('news article mismatched stable key was not rejected');
  }
  await rssService.news._setCachedTopicFeed(rssService.news._getTopicFeedCacheKey('1'), newsFeed);
  const heuristicPreferred = rssService.news._pickPreferredArticleBody('A'.repeat(500), 'B'.repeat(1082), '');
  if (heuristicPreferred.length !== 1082) {
    throw new Error(`news detail preference heuristic failed: ${heuristicPreferred.length}`);
  }
  const parsedBody = newsArticle.article?.body || '';
  if (!parsedBody.includes('다섯 번째 문단입니다.')) {
    throw new Error(`nested news article body parse failed: ${parsedBody}`);
  }
  if (parsedBody.includes('공유하기') || parsedBody.includes('연예 랭킹')) {
    throw new Error(`news article tail cleanup failed: ${parsedBody}`);
  }
  const noisyParsed = parseNewsArticleHtml(SAMPLE_NEWS_NOISY_ARTICLE_HTML);
  const noisyParsedBody = noisyParsed.body || '';
  if (!noisyParsedBody.includes('First clean paragraph.')) {
    throw new Error(`noisy news article parse lost valid content: ${noisyParsedBody}`);
  }
  if (/\\u[0-9a-fA-F]{4}|_spinTop|\$\(document\)\.ready/.test(noisyParsedBody)) {
    throw new Error(`noisy news article cleanup failed: ${noisyParsedBody}`);
  }
  const noisyPreferred = rssService.news._pickPreferredArticleBody(
    'Normal RSS summary body.',
    String.raw`\u201c\uc548 \ub0b4\ub9ac\uc790\u201d ... $(document).ready(function(){ _spinTopPickBest(spinTopParams, 1); }); ??? ????`,
    ''
  );
  if (noisyPreferred !== 'Normal RSS summary body.') {
    throw new Error(`news noisy detail fallback failed: ${noisyPreferred}`);
  }
  const sbsSanitizedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_SBS_TAIL);
  if (!sbsSanitizedBody.includes('정상 본문 둘째 문단입니다.')) {
    throw new Error(`SBS article tail cleanup lost valid content: ${sbsSanitizedBody}`);
  }
  if (/RSS 피드는 개인 리더|SBS 뉴스 앱 다운로드|전체 내용 확인하기|스브스프리미엄|무단 복제|무단복제|▲/.test(sbsSanitizedBody)) {
    throw new Error(`SBS article tail cleanup failed: ${sbsSanitizedBody}`);
  }
  const sbsSanitizedArticleBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_SBS_BODY);
  if (!sbsSanitizedArticleBody.startsWith('정상 본문 첫 문단입니다.')) {
    throw new Error(`SBS article lead cleanup failed: ${sbsSanitizedArticleBody}`);
  }
  if (!sbsSanitizedArticleBody.includes('정상 본문 둘째 문단입니다.')) {
    throw new Error(`SBS article lead cleanup lost valid content: ${sbsSanitizedArticleBody}`);
  }
  if (/RSS 피드는 개인 리더|SBS 뉴스 앱 다운로드|스브스프리미엄|무단 복제|무단복제|영상 시청/.test(sbsSanitizedArticleBody)) {
    throw new Error(`SBS article lead cleanup retained boilerplate: ${sbsSanitizedArticleBody}`);
  }
  if ((sbsSanitizedArticleBody.match(/정상 본문 첫 문단입니다\./g) || []).length !== 1) {
    throw new Error(`SBS article teaser dedupe failed: ${sbsSanitizedArticleBody}`);
  }
  const hankyungSanitizedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_HANKYUNG_BODY);
  if (!hankyungSanitizedBody.startsWith('6일부터 원서접수')) {
    throw new Error(`Hankyung article lead cleanup failed: ${hankyungSanitizedBody}`);
  }
  if (!hankyungSanitizedBody.includes('2027학년도 전국 영재학교 입시')) {
    throw new Error(`Hankyung article cleanup lost valid content: ${hankyungSanitizedBody}`);
  }
  if (/한경 PREMIUM|구독하기|입력 2026|수정 2026|지면 A25|기사 스크랩|댓글|기사 공유|글자크기|기자 구독하기|좋아요|싫어요|후속기사|구독신청|ADVERTISEMENT|이 시각 관심정보|한국경제신문 정치부|막 오른 영재학교/.test(hankyungSanitizedBody)) {
    throw new Error(`Hankyung article cleanup retained boilerplate: ${hankyungSanitizedBody}`);
  }
  const hankyungParsed = parseNewsArticleHtml(`<!doctype html><html lang="ko"><body><div class="article_body">${SAMPLE_NEWS_HANKYUNG_BODY.replace(/\n/g, '<br>')}</div></body></html>`);
  const hankyungParsedBody = hankyungParsed.body || '';
  if (!hankyungParsedBody.startsWith('6일부터 원서접수')) {
    throw new Error(`Hankyung article parser lead cleanup failed: ${hankyungParsedBody}`);
  }
  if (/한경 PREMIUM|기사 스크랩|글자크기|좋아요|구독신청|ADVERTISEMENT/.test(hankyungParsedBody)) {
    throw new Error(`Hankyung article parser cleanup retained boilerplate: ${hankyungParsedBody}`);
  }
  const recommendationSanitizedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_RECOMMENDATION_TAIL);
  if (/독자들의 PICK|KCM이 숨겼다|성추행/.test(recommendationSanitizedBody)) {
    throw new Error(`recommendation tail cleanup failed: ${recommendationSanitizedBody}`);
  }
  if (!recommendationSanitizedBody.includes('정상 본문 둘째 문단입니다.')) {
    throw new Error(`recommendation tail cleanup lost valid content: ${recommendationSanitizedBody}`);
  }
  const chosunInlineRelatedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_CHOSUN_INLINE_RELATED);
  if (/최준희|최진실|시체 썩은내|유명 가수|리주/.test(chosunInlineRelatedBody)) {
    throw new Error(`Chosun inline related-news cleanup failed: ${chosunInlineRelatedBody}`);
  }
  if (!chosunInlineRelatedBody.includes('KIA 김도영')) {
    throw new Error(`Chosun inline related-news cleanup lost valid caption: ${chosunInlineRelatedBody}`);
  }
  const fullContentSanitizedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_FULL_CONTENT_TAIL);
  if (/전체 내용보기/.test(fullContentSanitizedBody)) {
    throw new Error(`full content link cleanup failed: ${fullContentSanitizedBody}`);
  }
  const yonhapTvSanitizedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_YONHAPTV_TAIL);
  if (/\[뉴스리뷰\]|기사문의 및 제보|solemio@yna/.test(yonhapTvSanitizedBody)) {
    throw new Error(`Yonhap TV tail cleanup failed: ${yonhapTvSanitizedBody}`);
  }
  const entitySanitizedBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_ENTITY_BODY);
  if (/&ldquo;|&rdquo;/.test(entitySanitizedBody) || !entitySanitizedBody.includes('"정상 본문"')) {
    throw new Error(`HTML entity cleanup failed: ${entitySanitizedBody}`);
  }
  if ((entitySanitizedBody.match(/반복 캡션입니다\./g) || []).length !== 1) {
    throw new Error(`consecutive duplicate cleanup failed: ${entitySanitizedBody}`);
  }
  const mediaFallbackBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_MEDIA_FALLBACK_BODY);
  if (/브라우저가 .*태그를 지원하지|다른 브라우저/.test(mediaFallbackBody)) {
    throw new Error(`media fallback cleanup failed: ${mediaFallbackBody}`);
  }
  if (!mediaFallbackBody.startsWith('[앵커]')) {
    throw new Error(`media fallback cleanup lost article lead: ${mediaFallbackBody}`);
  }
  const scriptDataParsed = parseNewsArticleHtml(SAMPLE_NEWS_SCRIPT_DATA_ARTICLE_HTML);
  const scriptDataParsedBody = scriptDataParsed.body || '';
  if (!scriptDataParsedBody.includes('세 번째 구조화 문단입니다.')) {
    throw new Error(`script data article parse failed: ${scriptDataParsedBody}`);
  }
  if (/잘린 RSS 요약\.\./.test(scriptDataParsedBody)) {
    throw new Error(`script data article preferred teaser over structured body: ${scriptDataParsedBody}`);
  }
  const leadCaptionBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_LEAD_CAPTION_BODY);
  if (/큰사진보기|관련사진보기|ⓒ프레시안DB/.test(leadCaptionBody)) {
    throw new Error(`lead caption cleanup failed: ${leadCaptionBody}`);
  }
  if (!leadCaptionBody.startsWith('정상 본문 첫 문단입니다.')) {
    throw new Error(`lead caption cleanup lost article lead: ${leadCaptionBody}`);
  }
  const yonhapLeadBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_YONHAP_LEAD_BODY);
  if (/백나리 기자|이유미 기자|전황 브리핑하는 헤그세스 미 국방장관|로이터=연합뉴스 재판매/.test(yonhapLeadBody)) {
    throw new Error(`Yonhap lead cleanup failed: ${yonhapLeadBody}`);
  }
  if (!yonhapLeadBody.startsWith('전황 브리핑서 기여 촉구')) {
    throw new Error(`Yonhap lead cleanup lost deck: ${yonhapLeadBody}`);
  }
  const leadBoilerplateBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_LEAD_BOILERPLATE_BODY);
  if (/김연숙 기자|이영호 기자\s*=|\(서울=연합뉴스\)|\[서울=뉴시스\]|곽재훈 기자|피트 헤그세스 미국 국방장관|\(사진=연합뉴스\)|AFC 홈페이지 캡처|AFP=연합뉴스 자료사진|로이터=연합뉴스 재판매|\*재판매 및 DB 금지/.test(leadBoilerplateBody)) {
    throw new Error(`lead boilerplate cleanup failed: ${leadBoilerplateBody}`);
  }
  if (!leadBoilerplateBody.includes('정부는 회의 결과를 토대로 후속 조치를 마련하겠다고 밝혔다.')) {
    throw new Error(`lead boilerplate cleanup lost complete lead sentence: ${leadBoilerplateBody}`);
  }
  if (!leadBoilerplateBody.includes('정상 본문 첫 문단입니다.') || !leadBoilerplateBody.includes('정상 본문 둘째 문단입니다.')) {
    throw new Error(`lead boilerplate prefix cleanup lost article body: ${leadBoilerplateBody}`);
  }
  const leadImageCreditBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_LEAD_IMAGE_CREDIT_BODY);
  if (/유토이미지|AP 뉴시스|ⓒ뉴시스|함께하는 사랑밭 제공/.test(leadImageCreditBody)) {
    throw new Error(`lead image credit cleanup failed: ${leadImageCreditBody}`);
  }
  if (!leadImageCreditBody.startsWith('정상 본문 첫 문단입니다.')) {
    throw new Error(`lead image credit cleanup lost article lead: ${leadImageCreditBody}`);
  }
  const leadImageCaptionBody = rssService.news._sanitizeArticleText(SAMPLE_NEWS_LEAD_IMAGE_CAPTION_BODY);
  if (/크게보기|금융감독원 모습\. 2018\.4\.17 뉴스1/.test(leadImageCaptionBody)) {
    throw new Error(`lead image caption cleanup failed: ${leadImageCaptionBody}`);
  }
  if (!leadImageCaptionBody.startsWith('현지 증권사 통해 국내 주식 거래')) {
    throw new Error(`lead image caption cleanup lost deck: ${leadImageCaptionBody}`);
  }
  if (!leadImageCaptionBody.includes('정상 본문 첫 문단입니다.')) {
    throw new Error(`lead image caption cleanup lost article body: ${leadImageCaptionBody}`);
  }
  const photoNoiseBody = rssService.news._sanitizeArticleText('정상 본문 첫 문단입니다.\n사진 확대\n이미지 확대보기\n공유하기\n정상 본문 둘째 문단입니다.');
  if (/사진\s*확대|이미지\s*확대|공유하기/.test(photoNoiseBody)) {
    throw new Error(`photo article UI noise cleanup failed: ${photoNoiseBody}`);
  }

  // [LOG: 20260505_2325] Test for placeholder-only body (e.g. "(")
  const placeholderBody = rssService.news._sanitizeArticleText('(');
  if (placeholderBody !== '') {
    throw new Error(`placeholder-only body cleanup failed: expected empty, got "${placeholderBody}"`);
  }
  const placeholderBody2 = rssService.news._sanitizeArticleText(' )  ');
  if (placeholderBody2 !== '') {
    throw new Error(`placeholder-only body cleanup (extra spaces) failed: expected empty, got "${placeholderBody2}"`);
  }
  const placeholderNoisyPreferred = rssService.news._pickPreferredArticleBody(
    'Valid RSS summary content.',
    '(',
    ''
  );
  if (placeholderNoisyPreferred !== 'Valid RSS summary content.') {
    throw new Error(`news placeholder detail fallback failed: ${placeholderNoisyPreferred}`);
  }

  const server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const routedWeatherMenu = await request(base, '/api/services/weather');
    const routedWeatherOverview = await request(base, '/api/services/weather/all');
     const routedWeatherFeed = await request(base, '/api/services/weather/1');
     const routedNewsMenu = await request(base, '/api/services/news');
    const routedNewsFeed = await request(base, '/api/services/news/1');
    const routedNewsArticle = await request(base, `/api/services/news/1/1?key=${encodeURIComponent(routedNewsFeed.items[0].articleKey || '')}`);
    const routedGoogleItem = routedNewsFeed.items.find((item) => /news\.google\.com\/rss\/articles\//i.test(String(item?.link || '')));
    const routedGoogleArticle = await request(
      base,
      `/api/services/news/1/${encodeURIComponent(routedGoogleItem?.no || '')}?key=${encodeURIComponent(routedGoogleItem?.articleKey || '')}`
    );
    const routedParsedBody = routedNewsArticle.article?.body || '';
    if (!routedParsedBody.includes('다섯 번째 문단입니다.')) {
      throw new Error(`routed nested news article body parse failed: ${routedParsedBody}`);
    }
    if (routedParsedBody.includes('공유하기') || routedParsedBody.includes('연예 랭킹')) {
      throw new Error(`routed news article tail cleanup failed: ${routedParsedBody}`);
    }
    if (!String(routedGoogleArticle.article?.body || '').includes('오랜 기간 마스크 착용으로 인해 영유아 언어능력이나 사회성이 저하될 우려가 있다는 의견도 이어졌다.')) {
      throw new Error(`routed google news article resolution failed: ${routedGoogleArticle.article?.body || ''}`);
    }
    if (routedGoogleArticle.article?.sourceLink !== SAMPLE_GOOGLE_NEWS_CANONICAL_URL) {
      throw new Error(`routed google news source link missing: ${routedGoogleArticle.article?.sourceLink}`);
    }

    console.log(JSON.stringify({
      ok: true,
      weatherRegionCount: weatherMenu.items.length,
      weatherOverviewRegionCount: weatherOverview.regions.length,
      weatherOverviewSummary: weatherOverview.summary,
      weatherFirstRegion: weatherMenu.items[0].title,
      weatherFirstForecast: weatherFeed.items[0],
      newsTopicCount: newsMenu.items.length,
      newsFirstTopic: newsMenu.items[0].title,
      newsFirstHeadline: newsFeed.items[0].title,
      routedWeatherRegionCount: routedWeatherMenu.items.length,
      routedWeatherOverviewRegionCount: routedWeatherOverview.regions.length,
      routedWeatherOverviewFirstRegion: routedWeatherOverview.regions[0].title,
       routedWeatherFirstWeather: routedWeatherFeed.items[0].weather,
       routedNewsTopicCount: routedNewsMenu.items.length,
       routedNewsFirstDescription: routedNewsFeed.items[0].description,
       routedNewsFirstBodyLength: (routedNewsFeed.items[0].body || '').length,
       routedGoogleNewsSourceLink: routedGoogleArticle.article?.sourceLink || '',
       newsArticleBodyLength: parsedBody.length,
       googleNewsArticleBodyLength: googleNewsBody.length,
       routedNewsArticleBodyLength: routedParsedBody.length
     }, null, 2));
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
