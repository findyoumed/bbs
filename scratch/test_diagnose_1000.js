const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');
const { scoreArticleText } = require('../src/server/RssNewsArticleParserScoring');
const { isLikelyNoisyBody, sanitizeArticleText } = require('../src/server/RssNewsArticleSanitizer');

async function main() {
  const service = new RssNewsService({
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    // We will use standard fetch since there is a running dev server or external networks.
    fetchImpl: fetch
  });

  try {
    const topicDoor = '1';
    const articleNo = '1000';
    const key = '3d02eb958ed343ad76d8cda8f2fbbe86ce1f218c';

    console.log(`Fetching feed for topic: ${topicDoor}...`);
    const feed = await service.getNewsTopicFeed(topicDoor);
    console.log(`Feed loaded. Total items: ${feed?.items?.length || 0}`);

    const article = service._resolveNewsArticle(feed.items || [], articleNo, { key });
    if (!article) {
      console.log('Article 1000 not found in feed items. Listing first few items:');
      for (const item of (feed.items || []).slice(0, 5)) {
        console.log(`- no: ${item.no}, title: ${item.title}, link: ${item.link}`);
      }
      return;
    }

    console.log('\n--- Found Article ---');
    console.log(`Title: ${article.title}`);
    console.log(`Link: ${article.link}`);
    console.log(`Description: ${article.description}`);

    const detail = await service._fetchNewsArticleDetail(article.link);
    console.log('\n--- Detail Fetch Status ---');
    console.log(`Unavailable: ${detail?.unavailable}`);
    console.log(`Detail Source Link: ${detail?.sourceLink}`);

    const sanitized = sanitizeArticleText(detail?.body || '');
    console.log('\n--- Sanitized Content ---');
    console.log(JSON.stringify(sanitized));

    const score = scoreArticleText(sanitized, 'body');
    const hasPenaltyWords = /(기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가|본문으로\s*바로가기|전체메뉴)/.test(sanitized);
    const isNoisy = isLikelyNoisyBody(sanitized);

    console.log(`\nScore: ${score}`);
    console.log(`Has Penalty Words: ${hasPenaltyWords}`);
    console.log(`Is Likely Noisy: ${isNoisy}`);

  } catch (err) {
    console.error('Error occurred:', err);
  }
}

main();
