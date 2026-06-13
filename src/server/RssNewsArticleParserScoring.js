'use strict';

const {
  looksLikeWidgetNoise,
  normalizePlainText
} = require('./RssNewsArticleParserText');

function refineArticleText(value) {
  const rawSource = String(value || '');
  let source = normalizePlainText(rawSource);
  if (!source) {
    return '';
  }

  source = stripEmbeddedWidgetNoise(source);
  source = trimArticleLead(source);
  source = trimArticleTail(source);
  source = stripEmbeddedWidgetNoise(source);
  source = normalizePlainText(source);

  if (!source || looksLikeWidgetNoise(rawSource, source)) {
    return '';
  }

  return source;
}

function trimArticleLead(source) {
  const text = String(source || '').trim();
  const metadataTrimmed = trimArticleLeadByMetadata(text);
  if (metadataTrimmed && metadataTrimmed !== text) {
    return metadataTrimmed;
  }

  const reporterMatch = text.match(/\[[^\]\n]{0,120}\uAE30\uC790[^\]\n]{0,120}\]/);
  if (reporterMatch && reporterMatch.index > 0 && reporterMatch.index <= 180) {
    return text.slice(reporterMatch.index);
  }

  const newsisReporterMatch = text.match(/\[[^\]\n]{1,80}=뉴시스\]\s+[^\n]{1,60}\s+기자\s*=/);
  if (newsisReporterMatch && newsisReporterMatch.index > 0 && newsisReporterMatch.index <= 900) {
    return text.slice(newsisReporterMatch.index);
  }

  const yonhapReporterMatch = text.match(/\([^\)\n]{1,80}=연합뉴스\)\s+[^\n]{1,60}\s+기자\s*=/);
  if (yonhapReporterMatch && yonhapReporterMatch.index > 0 && yonhapReporterMatch.index <= 1200) {
    return text.slice(yonhapReporterMatch.index);
  }

  return text;
}

function trimArticleLeadByMetadata(source) {
  const text = String(source || '').trim();
  const lines = text
    .split('\n')
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (lines.length < 4) {
    return text;
  }

  const metadataIndex = lines.findIndex((line, index) => index <= 35 && isArticleLeadMetadataLine(line));
  if (metadataIndex < 0) {
    return text;
  }

  let startIndex = metadataIndex + 1;
  while (startIndex < lines.length) {
    const current = lines[startIndex];
    const next = lines[startIndex + 1] || '';
    if (
      isArticleLeadMetadataLine(current)
      || isArticleLeadSkippableLine(current)
      || isShortStandaloneAuthorLine(current, next)
    ) {
      startIndex += 1;
      continue;
    }
    break;
  }

  const bodyLines = lines.slice(startIndex);
  if (!bodyLines.some((line) => line.length >= 20)) {
    return text;
  }

  return bodyLines.join('\n').trim();
}

function isArticleLeadMetadataLine(line) {
  const text = String(line || '').trim();
  return /^(?:\uAE30\uC0AC\s*)?(?:\uC785\uB825|\uC218\uC815|\uCD5C\uC885\uC218\uC815|\uB4F1\uB85D|\uC1A1\uACE0|\uC2B9\uC778)\s*[:：]?\s*\d{4}[.-]\d{1,2}[.-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/i.test(text)
    || /^\d{4}[.-]\d{1,2}[.-]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?$/.test(text);
}

function isArticleLeadSkippableLine(line) {
  const text = String(line || '').trim();
  if (!text) {
    return true;
  }

  const patterns = [
    /^\uC9C0\uBA74\s+[A-Z]?\d+$/i,
    /^\uAE30\uC0AC\s*\uC2A4\uD06C\uB7A9$/i,
    /^\uB313\uAE00(?:\s*\d+)?$/i,
    /^\uAE30\uC0AC\s*\uACF5\uC720$/i,
    /^\uAE00\uC790\uD06C\uAE30(?:\s*\uC870\uC808)?$/i,
    /^\uAE30\uC790\s*\uAD6C\uB3C5\uD558\uAE30$/i,
    /^\uAD6C\uB3C5\uD558\uAE30$/i,
    /^\uD55C\uACBD\s*PREMIUM\s*9?$/i,
    /^AI\uB97C\s*\uB118\uC5B4\uC11C\uB294\s*\uC131\uACF5\uD22C\uC790,?$/i,
    /^\uD55C\uACBD\s*\uD504\uB9AC\uBBF8\uC5C4\s*9?$/i,
    /^(?:\uC815\uCE58|\uC0AC\uD68C|\uACBD\uC81C|\uAD6D\uC81C|\uC9C0\uC5ED|\uC2A4\uD3EC\uCE20|\uC5F0\uC608|\uC624\uD53C\uB2C8\uC5B8|\uD14C\uD06C|BIO\s*Insight)$/i
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function isShortStandaloneAuthorLine(line, nextLine) {
  const text = String(line || '').trim();
  const next = String(nextLine || '').trim();
  if (!text || text.length > 12 || /\s/.test(text)) {
    return false;
  }
  return /^[\uAC00-\uD7A3]{2,6}$/.test(text) && /^\uAE30\uC790\s*\uAD6C\uB3C5\uD558\uAE30$/i.test(next);
}

function trimArticleTail(source) {
  const text = String(source || '').trim();
  const patterns = [
    /\n{1,2}\s*Copyright\b[\s\S]*$/i,
    /\n{1,2}\s*\uBB34\uB2E8 \uC804\uC7AC[\s\S]*$/i,
    /\n{1,2}\s*\uC7AC\uBC30\uD3EC \uBC0F AI\uD559\uC2B5 \uC774\uC6A9 \uAE08\uC9C0[\s\S]*$/i,
    /\n{1,2}\s*\uACF5\uC720\uD558\uAE30[\s\S]*$/i,
    /\n{1,2}\s*(\uC5F0\uC608 \uB7AD\uD0B9|\uD574\uC678 \uD1A0\uD53D|\uC5F0\uC608\uB274\uC2A4\uB294 \uAD00\uC2EC\uC788\uAC8C \uBCF8 \uAE30\uC0AC)[\s\S]*$/i,
    /\n{1,2}\s*\/?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[\s\S]*$/i,
    /\n{1,2}\s*[^\n]{0,40}\uAE30\uC790\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[\s\S]*$/i,
    /\n{1,2}\s*◎\s*공감언론\s*뉴시스[\s\S]*$/i,
    /\n{1,2}\s*\[\s*\uC0AC\uC9C4\s*\][\s\S]*$/i,
    /\n{1,2}\s*\uC88B\uC544\uC694\s*\n\s*\uC2EB\uC5B4\uC694[\s\S]*$/i,
    /\n{1,2}\s*\uD6C4\uC18D\uAE30\uC0AC\s*\uC6D0\uD574\uC694[\s\S]*$/i,
    /\n{1,2}\s*\uC804\uCCB4\s*\uB0B4\uC6A9\uBCF4\uAE30[\s\S]*$/i,
    /\n{1,2}\s*(?:\uB3C5\uC790\uB4E4\uC758\s*PICK!?|\uB9CE\uC774\s*\uBCF8\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uC2E4\uC2DC\uAC04\s*\uC778\uAE30\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uC778\uAE30\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uCD94\uCC9C\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uC774\s*\uC2DC\uAC01\s*\uCD94\uCC9C\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uB2F9\uC2E0\uC774\s*\uC88B\uC544\uD560\s*\uB9CC\uD55C\s*(?:\uB274\uC2A4|\uAE30\uC0AC))[\s\S]*$/i,
    /\n{1,2}\s*\[\uB274\uC2A4\uB9AC\uBDF0\][\s\S]*$/i,
    /\n{1,2}\s*\uC5F0\uD569\uB274\uC2A4TV\s*\uAE30\uC0AC\uBB38\uC758\s*\uBC0F\s*\uC81C\uBCF4\s*:[\s\S]*$/i,
    /\n{1,2}\s*(?:\uD55C\uAD6D\uACBD\uC81C|\uD55C\uACBD\uD504\uB9AC\uBBF8\uC5C49)\s*\uAD6C\uB3C5\uC2E0\uCCAD[\s\S]*$/i,
    /\n{1,2}\s*\uC774\s*\uC2DC\uAC01\s*\uAD00\uC2EC\uC815\uBCF4[\s\S]*$/i,
    /\n{1,2}\s*ADVERTISEMENT[\s\S]*$/i,
    /\n{1,2}\s*AD\s*\n[\s\S]*$/i,
    /[ⓒ©][^\n]{0,120}\uBB34\uB2E8\s*\uC804\uC7AC[\s\S]*$/i,
    /\uBB34\uB2E8\s*\uC804\uC7AC[\s\S]*$/i,
    /\$\(document\)\.ready\([\s\S]*$/i,
    /\bspinTopParams\b[\s\S]*$/i,
    /\b_spinTop[A-Za-z]*\b[\s\S]*$/i,
    /\n{0,2}\s*function\s+draw_contents[A-Za-z0-9_]*\s*\([\s\S]*$/i,
    /\n{0,2}\s*function\s+draw_[A-Za-z0-9_]*related\s*\([\s\S]*$/i,
    /\n{0,2}\s*var\s+clickStatistics_[A-Za-z0-9_]*\s*=[\s\S]*$/i,
    /\n{0,2}\s*var\s+contbox[A-Za-z0-9_]*_html\s*=[\s\S]*$/i,
    /\n{0,2}\s*if\s*\(\s*\$\(["']#contbox[A-Za-z0-9_]*["']\)[\s\S]*$/i,
    /\n{1,2}\s*(\uC624\uB298\uC758 \uCD94\uCC9C\uC601\uC0C1|\uC9C0\uAE08 \uB728\uB294 \uB274\uC2A4)[\s\S]*$/i
  ];

  let cutIndex = text.length;
  patterns.forEach((pattern) => {
    const match = text.match(pattern);
    if (match && typeof match.index === 'number') {
      cutIndex = Math.min(cutIndex, match.index);
    }
  });

  return text.slice(0, cutIndex).trim();
}

function stripEmbeddedWidgetNoise(source) {
  const text = String(source || '').trim();
  if (!text) {
    return '';
  }

  const patterns = [
    /\s+\$\(document\)\.ready\([\s\S]*$/i,
    /\s+spinTopParams[\s\S]*$/i,
    /\s+_spinTop[A-Za-z]*[\s\S]*$/i,
    /\s+function\s+draw_contents[A-Za-z0-9_]*\s*\([\s\S]*$/i,
    /\s+function\s+draw_[A-Za-z0-9_]*related\s*\([\s\S]*$/i,
    /\s+var\s+clickStatistics_[A-Za-z0-9_]*\s*=[\s\S]*$/i,
    /\s+var\s+contbox[A-Za-z0-9_]*_html\s*=[\s\S]*$/i,
    /\s+if\s*\(\s*\$\(["']#contbox[A-Za-z0-9_]*["']\)[\s\S]*$/i,
    /\n{1,2}\s*\uC88B\uC544\uC694\s*\n\s*\uC2EB\uC5B4\uC694[\s\S]*$/i,
    /\n{1,2}\s*\uD6C4\uC18D\uAE30\uC0AC\s*\uC6D0\uD574\uC694[\s\S]*$/i,
    /\n{1,2}\s*\uC804\uCCB4\s*\uB0B4\uC6A9\uBCF4\uAE30[\s\S]*$/i,
    /\n{1,2}\s*(?:\uB3C5\uC790\uB4E4\uC758\s*PICK!?|\uB9CE\uC774\s*\uBCF8\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uC2E4\uC2DC\uAC04\s*\uC778\uAE30\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uC778\uAE30\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uCD94\uCC9C\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uC774\s*\uC2DC\uAC01\s*\uCD94\uCC9C\s*(?:\uB274\uC2A4|\uAE30\uC0AC)|\uB2F9\uC2E0\uC774\s*\uC88B\uC544\uD560\s*\uB9CC\uD55C\s*(?:\uB274\uC2A4|\uAE30\uC0AC))[\s\S]*$/i,
    /\n{1,2}\s*\[\uB274\uC2A4\uB9AC\uBDF0\][\s\S]*$/i,
    /\n{1,2}\s*\uC5F0\uD569\uB274\uC2A4TV\s*\uAE30\uC0AC\uBB38\uC758\s*\uBC0F\s*\uC81C\uBCF4\s*:[\s\S]*$/i,
    /\n{1,2}\s*(?:\uD55C\uAD6D\uACBD\uC81C|\uD55C\uACBD\uD504\uB9AC\uBBF8\uC5C49)\s*\uAD6C\uB3C5\uC2E0\uCCAD[\s\S]*$/i,
    /\n{1,2}\s*\uC774\s*\uC2DC\uAC01\s*\uAD00\uC2EC\uC815\uBCF4[\s\S]*$/i,
    /\n{1,2}\s*ADVERTISEMENT[\s\S]*$/i,
    /\n{1,2}\s*(\uC624\uB298\uC758 \uCD94\uCC9C\uC601\uC0C1|\uC9C0\uAE08 \uB728\uB294 \uB274\uC2A4)[\s\S]*$/i
  ];

  let cutIndex = text.length;
  patterns.forEach((pattern) => {
    const match = text.match(pattern);
    if (match && typeof match.index === 'number') {
      cutIndex = Math.min(cutIndex, match.index);
    }
  });

  return text.slice(0, cutIndex).trim();
}

function chooseBestArticleBody(candidates) {
  const scored = candidates
    .map((entry) => ({ ...entry, score: scoreArticleText(entry.text, entry.source) }))
    .filter((entry) => entry.text && entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.text || '';
}

function scoreArticleText(text, sourceType = 'body') {
  const source = normalizePlainText(text);
  if (!source) {
    return 0;
  }

  if (looksLikeWidgetNoise(text, source)) {
    return 0;
  }

  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const length = source.length;
  const avgLine = lines.length ? (length / lines.length) : 0;
  const paragraphCount = lines.filter((line) => line.length >= 20).length;
  const penalty = /(\uB85C\uADF8\uC778|\uD68C\uC6D0\uAC00\uC785|\uAD11\uACE0|\uAE30\uC790 \uAD6C\uB3C5|\uAE30\uC0AC\uC81C\uBCF4|\uBB34\uB2E8\s*\uC804\uC7AC|\uC7AC\uBC30\uD3EC \uAE08\uC9C0|\uC804\uCCB4\uBA54\uB274|\uBCF8\uBB38\uC73C\uB85C \uBC14\uB85C\uAC00\uAE30|\uACF5\uC720\uD558\uAE30|\uAE00\uC790\uD06C\uAE30|\uAE30\uC0AC\s*\uC2A4\uD06C\uB7A9|\uD55C\uACBD\s*PREMIUM|\uD6C4\uC18D\uAE30\uC0AC|\uAD6C\uB3C5\uC2E0\uCCAD|ADVERTISEMENT|\uB3C5\uC790\uB4E4\uC758\s*PICK|\uC804\uCCB4\s*\uB0B4\uC6A9\uBCF4\uAE30|\uAE30\uC0AC\uBB38\uC758\s*\uBC0F\s*\uC81C\uBCF4)/.test(source) ? 520 : 0;
  const teaserPenalty = looksLikeTruncatedTeaser(source)
    ? (length <= 320 ? 1100 : 420)
    : (paragraphCount <= 1 && length < 160 ? 240 : 0);
  const sourceBonus = sourceType === 'jsonld'
    ? 2400
    : sourceType === 'structured'
      ? 2200
      : sourceType === 'script'
        ? 2100
    : sourceType === 'container'
      ? 1600
      : sourceType === 'article'
        ? 1200
        : 0;

  // [LOG: 20260613_1212] 마침표/물음표/느낌표 등 문장 종결 부호가 전혀 없는 단순 뉴스 제목/링크 목록에 강력한 감점을 주어 진짜 기사 본문이 선택되도록 필터링을 보강함.
  const sentenceCount = (source.match(/[.!?]/g) || []).length;
  const sentencePenalty = sentenceCount === 0 ? 1500 : 0;

  return sourceBonus + length + (avgLine * 6) + (paragraphCount * 12) - penalty - teaserPenalty - sentencePenalty;
}

function looksLikeTruncatedTeaser(value) {
  const text = String(value || '').trim();
  return text.length <= 420 && /(?:\.{2,}|…|···)\s*$/.test(text);
}

module.exports = {
  chooseBestArticleBody,
  refineArticleText
};
