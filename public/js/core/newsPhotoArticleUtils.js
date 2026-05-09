const PHOTO_NEWS_CATEGORY_PATTERN = /(^|\s)(\uD3EC\uD1A0|N\uC0F7|photo|gallery)(\s|$)/i;
const PHOTO_NEWS_LABEL_PATTERN = /^\s*(?:[\[【(<]\s*(\uD3EC\uD1A0|N\uC0F7|photo)\s*(\uB274\uC2A4)?\s*[\]】)>:：\-]|\s*(\uD3EC\uD1A0\uB274\uC2A4|N\uC0F7)\s*[:：\-])/i;
const PHOTO_NEWS_PHRASE_PATTERN = /(\uD3EC\uD1A0\s*\uB274\uC2A4|\uD3EC\uD1A0\uB274\uC2A4|N\uC0F7|photo\s*news)/i;
const PHOTO_NEWS_LINK_PATTERN = /\/(photo|photos|picture|pictures|gallery)(\/|$)/i;

function normalizePhotoNewsText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function shouldDisplayNewsArticleImage(article) {
  if (!article || !String(article.imageUrl || '').trim()) {
    return false;
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
