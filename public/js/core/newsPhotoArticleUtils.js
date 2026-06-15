// [LOG: 20260615_1651] Add video-related keywords and YouTube link bypass in newsPhotoArticleUtils.js
const PHOTO_NEWS_CATEGORY_PATTERN = /(^|\s)(\uD3EC\uD1A0|N\uC0F7|photo|gallery|video)(\s|$)/i;
const PHOTO_NEWS_LABEL_PATTERN = /^\s*(?:[\[【(<]\s*(\uD3EC\uD1A0|N\uC0F7|photo|\uC0AC\uC9C4|\uC601\uC0C1|\uB3D9\uC601\uC0C1|video)\s*(\uB274\uC2A4)?\s*[\]】)>:：\-]|\s*(\uD3EC\uD1A0\uB274\uC2A4|N\uC0F7|\uC0AC\uC9C4|\uC601\uC0C1|\uB3D9\uC601\uC0C1)\s*[:：\-])/i;
const PHOTO_NEWS_PHRASE_PATTERN = /(\uD3EC\uD1A0\s*\uB274\uC2A4|\uD3EC\uD1A0\uB274\uC2A4|N\uC0F7|photo\s*news|\uC0AC\uC9C4\s*\uB274\uC2A4|\uC0AC\uC9C4\uB274\uC2A4|video\s*news|\uC601\uC0C1\uB274\uC2A4|\uB3D9\uC601\uC0C1\uB274\uC2A4)/i;
const PHOTO_NEWS_LINK_PATTERN = /(?:^|[\/_])(photo|photos|picture|pictures|gallery|video|videos|vod|clip)(?:[\/_]|$)/i;

function normalizePhotoNewsText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function shouldDisplayNewsArticleImage(article) {
  if (!article || !String(article.imageUrl || '').trim()) {
    return false;
  }

  // 유튜브 등 비디오 임베드 URL이 imageUrl인 경우 영상 재생을 위해 무조건 보여준다.
  const imageUrl = String(article.imageUrl).toLowerCase();
  if (imageUrl.includes('youtube.com/') || imageUrl.includes('youtu.be/') || imageUrl.includes('youtube-nocookie.com/')) {
    return true;
  }

  const category = normalizePhotoNewsText(article.categoryTitle || article.categoryName || article.sectionTitle);
  if (PHOTO_NEWS_CATEGORY_PATTERN.test(category)) {
    return true;
  }

  const title = normalizePhotoNewsText(article.title);
  if (PHOTO_NEWS_LABEL_PATTERN.test(title) || PHOTO_NEWS_PHRASE_PATTERN.test(title)) {
    return true;
  }

  const link = String(article.link || '').trim();
  return PHOTO_NEWS_LINK_PATTERN.test(link);
}
