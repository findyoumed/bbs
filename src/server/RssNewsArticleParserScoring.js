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

  if (!source || looksLikeWidgetNoise(rawSource, source) || looksLikeListNoise(source)) {
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

// [LOG: 20260616_1145] 뉴스 목록 카드/추천 칼럼 영역에서 추출된 텍스트 노이즈를 식별하여 걸러내는 헬퍼 함수
function looksLikeListNoise(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return false;
  }

  // 1. 텍스트 마지막에 날짜/시간 정보가 붙은 목록성 레이아웃 검출 (예: "11시간 전", "8분 전", "2026-06-13")
  if (/(?:\d{1,2}\s*(?:시간|분|일|달)\s*전|\d{4}[.-]\d{1,2}[.-]\d{1,2})\s*$/i.test(normalized)) {
    return true;
  }

  // 2. 문장 종결 부호가 거의 없는 매우 짧은 한 줄짜리 링크 텍스트인 경우
  // 단, [속보]나 [Breaking] 등의 키워드가 포함된 경우는 실제 짧은 속보 기사일 수 있으므로 제외
  const length = normalized.length;
  const sentenceCount = (normalized.match(/[.!?]/g) || []).length;
  const hasBreakingNewsKeyword = /\[\s*(속보|Breaking|포토)\s*\]/i.test(normalized);

  if (length < 150 && !hasBreakingNewsKeyword) {
    const lines = normalized.split('\n').filter(Boolean);
    if (lines.length <= 1 && sentenceCount <= 1) {
      if (!/[.!?]["']?\s*$/.test(normalized)) {
        return true;
      }
    }
  }

  return false;
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

  // [LOG: 20260616_1145] 위젯 노이즈나 뉴스 카드 목록 노이즈인 경우 점수를 0점으로 즉시 기각함
  if (looksLikeWidgetNoise(text, source) || looksLikeListNoise(source)) {
    return 0;
  }

  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const length = source.length;
  const avgLine = lines.length ? Math.min(80, length / lines.length) : 0;
  const paragraphCount = lines.filter((line) => line.length >= 20).length;
  // [LOG: 20260616_1205] 동아일보의 재생/슬라이더 문구(기사 읽기, 재생 중이에요, 왼쪽으로, 오른쪽으로) 및 [LOG: 20260616_1220] 펼치기/접기, 요약, 구글 검색 선호 매체 포함 시 감점 처리하도록 보강
  const penalty = /(\uB85C\uADF8\uC778|\uD68C\uC6D0\uAC00\uC785|\uAD11\uACE0|\uAE30\uC0AC\s*\uAD6C\uB3C5|\uAE30\uC0AC\uC81C\uBCF4|\uBB34\uB2E8\s*\uC804\uC7AC|\uC7AC\uBC30\uD3EC \uAE08\uC9C0|\uC804\uCCB4\uBA54\uB274|\uBCF8\uBB38\uC73C\uB85C \uBC14\uB85C\uAC00\uAE30|\uACF5\uC720\uD558\uAE30|\uAE00\uC790\uD06C\uAE30|\uAE30\uC0AC\s*\uC2A4\uD06C\uB7A9|\uD55C\uACBD\s*PREMIUM|\uD6C4\uC18D\uAE30\uC0AC|\uAD6C\uB3C5\uC2E0\uCCAD|ADVERTISEMENT|\uB3C5\uC790\uB4E4\uC758\s*PICK|\uC804\uCCB4\s*\uB0B4\uC6A9\uBCF4\uAE30|\uAE30\uC0AC\uBB38\uC758\s*\uBC0F\s*\uC81C\uBCF4|기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가)/.test(source) ? 520 : 0;
  const teaserPenalty = looksLikeTruncatedTeaser(source)
    ? (length <= 320 ? 1100 : 420)
    : (paragraphCount <= 1 && length < 160 ? 240 : 0);
  const sourceBonus = sourceType === 'container'
    ? 2000
    : sourceType === 'structured'
      ? 1900
      : sourceType === 'script'
        ? 1850
        : sourceType === 'jsonld'
          ? 1800
          : sourceType === 'article'
            ? 1600
            : 0;

  // [LOG: 20260616_1145] 속보 키워드가 포함된 경우에는 마침표/종결부호 미비 페널티를 면제함
  const hasBreakingNewsKeyword = /\[\s*(속보|Breaking|포토)\s*\]/i.test(source);
  const sentenceCount = (source.match(/[.!?]/g) || []).length;
  const sentencePenalty = (sentenceCount === 0 && !hasBreakingNewsKeyword) ? 1500 : 0;

  // [LOG: 20260613_1218] 줄바꿈이 유실된 채 긴 본문이 통째로 뭉쳐진 후보(JSON-LD 등)에 대해 감점을 주고, 단락 개수에 대한 가중치를 대폭 상향함.
  const newlineCount = (source.match(/\n/g) || []).length;
  const newlinePenalty = (length >= 200 && newlineCount <= 1) ? 600 : 0;

  return sourceBonus + length + (avgLine * 6) + (paragraphCount * 80) - penalty - teaserPenalty - sentencePenalty - newlinePenalty;
}

function looksLikeTruncatedTeaser(value) {
  const text = String(value || '').trim();
  return text.length <= 420 && /(?:\.{2,}|…|···)\s*$/.test(text);
}

module.exports = {
  chooseBestArticleBody,
  refineArticleText,
  scoreArticleText
};
