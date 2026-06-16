const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');
const { scoreArticleText } = require('../src/server/RssNewsArticleParserScoring');
const { isLikelyNoisyBody, sanitizeArticleText } = require('../src/server/RssNewsArticleSanitizer');

async function main() {
  const service = new RssNewsService({
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch
  });

  try {
    const topicDoor = '1';
    const articleNo = '410';
    const key = '3b39fa7b6c7753d83c955b53ca04a4c660be97e1';

    console.log(`Fetching feed for topic: ${topicDoor}...`);
    const feed = await service.getNewsTopicFeed(topicDoor);
    console.log(`Feed loaded. Total items: ${feed?.items?.length || 0}`);

    const article = service._resolveNewsArticle(feed.items || [], articleNo, { key });
    if (!article) {
      console.log('Article 410 not found in feed items.');
      return;
    }

    console.log('\n--- Found Article ---');
    console.log(`Title: ${article.title}`);
    console.log(`Link: ${article.link}`);
    console.log(`No: ${article.no}`);

    const detail = await service._fetchNewsArticleDetail(article.link);
    console.log('\n--- Detail Fetch Status ---');
    console.log(`Unavailable: ${detail?.unavailable}`);

    const sanitized = sanitizeArticleText(detail?.body || '');
    const score = scoreArticleText(sanitized, 'body');
    const isNoisy = isLikelyNoisyBody(sanitized);

    console.log(`Score: ${score}`);
    console.log(`Is Likely Noisy: ${isNoisy}`);

    const res = await service.getNewsArticle(topicDoor, articleNo, { key });
    console.log('\n--- Service Response ---');
    console.log(`detailFetched: ${res?.article?.detailFetched}`);
    console.log(`Body Length: ${res?.article?.body?.length}`);

  } catch (err) {
    console.error('Error occurred:', err);
  }
}

main();
