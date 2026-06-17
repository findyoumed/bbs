'use strict';

const { decodeHtmlEntities } = require('./RssNewsArticleParserText');

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[/:|,-]+\s*$/g, '').trim();
}

// [LOG: 20260617_1830] Robust URL normalizer to ensure reliable article key pairing.
// Preserves content IDs in query strings while stripping known tracking parameters.
function normalizeUrl(value) {
  let source = String(value || '').trim();
  if (!source) return '';

  try {
    const url = new URL(source);
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
    url.hash = '';

    const toRemove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'oc', 'hl', 'gl', 'ceid', 'plink', 'cooper'
    ];
    toRemove.forEach(p => url.searchParams.delete(p));
    url.searchParams.sort();

    return url.toString()
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '')
      .trim();
  } catch (e) {
    return source
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '')
      .trim();
  }
}

function buildAuthor(src, aut) {
  const source = normalize(src);
  const author = normalize(aut);
  if (!source) {
    return author;
  }
  if (!author || /^[/:|,-]+$/.test(author)) {
    return source;
  }

  const clean = author.replace(new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*[/|:-]\\s*|\\s+)?`, 'i'), '').trim();
  const normalized = normalize(clean);
  return (!normalized || normalized.toLowerCase() === source.toLowerCase()) ? source : `${source}/${normalized}`;
}

function pickPreferredArticleBody(feedBody, detailBody, detailDescription) {
  const cleanFeedBody = sanitizeArticleText(feedBody);
  const cleanDetailBody = sanitizeArticleText(detailBody);
  const cleanDetailDescription = sanitizeArticleText(detailDescription);
  // [LOG: 20260613_1241] If actual detail body meets min length and is NOT noisy, prioritize it over feed to preserve paragraph structures
  if (cleanDetailBody && cleanDetailBody.length >= 100 && !isLikelyNoisyBody(cleanDetailBody)) {
    return cleanDetailBody;
  }
  if (cleanFeedBody && (!cleanDetailBody || isLikelyNoisyBody(cleanDetailBody))) {
    return cleanFeedBody;
  }
  return pickArticleBody([cleanDetailBody, cleanFeedBody, cleanDetailDescription]);
}

function pickArticleBody(values) {
  return (values || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0] || '';
}

// [LOG: 20260617_0930] Support optional title parameter to prune identical lead headings
function sanitizeArticleText(value, title = '') {
  const normalized = decodeHtmlEntities(String(value || ''))
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\[%%(?:IMAGE|MEDIA)\d+%%\]/gi, '') // [LOG: 20260613_1243] 이미지 및 미디어 플레이스홀더 [%%IMAGE1%%], [%%MEDIA1%%] 등 제거
    .trim();
  // [LOG: 20260613_1212] 마침표(.), 물음표(?), 느낌표(!) 바로 뒤에 공백이나 개행 없이 한글이 붙어오는 경우(예: '꺼졌다.이') 띄어쓰기를 보정해 줌.
  const spacingFixed = normalized.replace(/([.!?])([가-힣])/g, '$1 $2');
  if (!spacingFixed) {
    return '';
  }

  const leadTrimmed = trimKnownArticleLeadNoise(spacingFixed);
  const strippedLines = stripKnownArticleBoilerplateLines(leadTrimmed);
  const trimmedTail = trimKnownArticleTailNoise(strippedLines);
  const inlineTrimmed = trimInlineRelatedHeadlineNoise(trimmedTail);
  const dedupedLead = dedupeLeadingTeaserLines(inlineTrimmed);
  const dedupedAdjacent = dedupeConsecutiveLines(dedupedLead);
  
  // [LOG: 20260617_0930] Strip title duplicates from the start of final text block
  let finalLines = dedupedAdjacent.split('\n');
  if (title && finalLines.length > 0) {
    const coreTitle = String(title).split(/\s+[-|]\s+/)[0].trim();
    if (coreTitle) {
      const cleanCore = coreTitle.replace(/\s+/g, '').toLowerCase();
      let firstLineIndex = -1;
      for (let i = 0; i < finalLines.length; i++) {
        if (finalLines[i].trim()) {
          firstLineIndex = i;
          break;
        }
      }
      if (firstLineIndex !== -1) {
        const firstLineClean = finalLines[firstLineIndex].replace(/\s+/g, '').toLowerCase();
        if (firstLineClean === cleanCore || (firstLineClean.length >= 10 && (cleanCore.includes(firstLineClean) || firstLineClean.includes(cleanCore)))) {
          finalLines[firstLineIndex] = '';
        }
      }
    }
  }

  // [LOG: 20260505_2325] Filter out meaningless placeholders like "(" or ")".
  const final = finalLines.join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (final === '(' || final === ')' || final === '[속보]' || final === '[]') {
    return '';
  }
  return final;
}

// [LOG: 20260505_1935] Cut inline related-news teasers appended to short photo captions.
function trimInlineRelatedHeadlineNoise(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const markerPattern = /\s+▲\s+/g;
  let match;
  while ((match = markerPattern.exec(text)) !== null) {
    const markerIndex = match.index;
    if (markerIndex < 24) {
      continue;
    }

    const tail = text.slice(markerIndex + match[0].length).trim();
    const hasAnotherHeadlineMarker = /\s+▲\s+/.test(tail);
    const looksLikeHeadlineTeaser = /[.…]{2,}|["'“”‘’]|(?:공개|잡혔다|갑작스|충격|논란|고백|결혼|남편|아내|살인|혐의|생방송)/.test(tail);
    if (hasAnotherHeadlineMarker || looksLikeHeadlineTeaser) {
      return text.slice(0, markerIndex).trim();
    }
  }

  return text;
}

// [LOG: 20260616_1228] Trim publisher UI blocks before the first real article paragraph.
function trimKnownArticleLeadNoise(value) {
  let cleanText = String(value || '').trim();
  
  // [LOG: 20260616_1228] Remove leading inline metadata/navigation chains directly to protect trailing article sentences
  const leadInlineBoilerplate = /^\s*(?:기사\s*읽기|요약|기사를\s*재생\s*중이에요|구글\s*검색\s*선호\s*매체로\s*추가|펼치기\/접기|왼쪽으로|오른쪽으로|[\s\-|/])+/gi;
  cleanText = cleanText.replace(leadInlineBoilerplate, '').trim();

  if (!cleanText) {
    return '';
  }

  const lines = cleanText
    .split('\n')
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (lines.length < 4) {
    return cleanText;
  }

  const metadataIndex = lines.findIndex((line, index) => index <= 35 && isArticleLeadMetadataLine(line));
  if (metadataIndex < 0) {
    return cleanText;
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
    return cleanText;
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

function stripKnownArticleBoilerplateLines(value) {
  const lines = String(value || '').split('\n');
  const filtered = [];
  let previousBlank = false;
  let stopAtTail = false;

  const prefixPatterns = [
    /^\([가-힣]{2,5}=\uC5F0\uD569\uB274\uC2A4\)\s*(?:[\uAC00-\uD7A3]{2,6}\s*(?:기자|특파원)\s*[=＝]\s*)?/i,
    /^\[[가-힣]{2,5}=\uB274\uC2DC\uC2A4\]\s*/i,
    /^(?:[\uAC00-\uD7A3]{2,6}\s*(?:기자|특파원)(?:,\s*)?)+\s*[=＝]\s*/i
  ];

  const boilerplatePatterns = [
    // [LOG: 20260617_0930] General UI navigation, share, scrap and scroll templates
    /^(이전|다음)\s*기사보기$/i,
    /^기사\s*스크랩(?:하기)?$/i,
    /^다른\s*공유\s*찾기$/i,
    /^본문\s*글씨\s*(키우기|줄이기)$/i,
    /^스크롤\s*이동\s*상태바$/i,
    /^[^\n]{1,30}기자$/i,
    /^(?:<|\[)?저작권자\s*(?:\(c\)|[ⓒ©]|&copy;)?.*$/i,
    /RSS\s*피드는\s*개인\s*리더\s*이용\s*목적으로\s*허용/i,
    /피드를\s*이용한\s*게시\s*등의\s*무단\s*복제/i,
    /(?:▶\s*)?SBS\s*뉴스\s*앱\s*다운로드/i,
    /(?:▶\s*)?뉴스에\s*지식을\s*담다\s*-\s*스브스프리미엄\s*앱\s*다운로드/i,
    /(?:▶\s*)?이\s*기사의\s*전체\s*내용\s*확인하기/i,
    /^등록\s+\d{4}[.-]\d{2}[.-]\d{2}\s+\d{1,2}:\d{2}:\d{2}$/i,
    /^(?:기사\s*)?(?:입력|수정|최종수정|등록|송고|승인)\s*[:：]?\s*\d{4}[.-]\d{1,2}[.-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/i,
    /^지면\s+[A-Z]?\d+$/i,
    /^(작게|크게)$/i,
    /^(구독|구독중|구독하기|이전|다음|닫기|공유|공유하기|인쇄|프린트)$/i,
    /^한경\s*PREMIUM\s*9?$/i,
    /^AI를\s*넘어서는\s*성공투자,?$/i,
    /^한경\s*프리미엄\s*9?$/i,
    /^기사\s*스크랩$/i,
    /^댓글(?:\s*\d+)?$/i,
    /^기사\s*공유$/i,
    /^글자크기(?:\s*조절)?$/i,
    /^기자\s*구독하기$/i,
    /^큰사진보기$/i,
    /^크게보기$/i,
    /^관련사진보기$/i,
    /^브라우저가\s*(?:video|오디오)\s*태그를\s*지원하지\s*않습니다\.?$/i,
    /^죄송하지만\s*다른\s*브라우저를\s*사용하여\s*주십시오\.?$/i,
    /^좋아요$/i,
    /^싫어요$/i,
    /^후속기사\s*원해요$/i,
    /^전체\s*내용보기$/i,
    /^독자들의\s*PICK!?$/i,
    /^(?:많이\s*본|실시간\s*인기|인기|추천)\s*(?:뉴스|기사)$/i,
    /^이\s*시각\s*추천\s*(?:뉴스|기사)$/i,
    /^당신이\s*좋아할\s*만한\s*(?:뉴스|기사)$/i,
    /^\[뉴스리뷰\]$/i,
    /^연합뉴스TV\s*기사문의\s*및\s*제보\s*:/i,
    /^[가-힣]{2,8}\([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\)$/i,
    /^(?:한국경제|한경프리미엄9)\s*구독신청$/i,
    /^ADVERTISEMENT$/i,
    /^AD$/i,
    /^이\s*시각\s*관심정보$/i,
    /^(?:사진|이미지)\s*(?:확대|확대보기|크게보기|보기|저장)$/i,
    // [LOG: 20260616_1205] 동아일보의 기사 재생 문구 제거 패턴 추가
    /^(?:기사(?:를)?\s*)?(?:읽어주기|본문\s*듣기|읽기|재생\s*중이에요)$/i,
    // [LOG: 20260616_1205] 동아일보 슬라이더 내비게이션 및 추천 검색 키워드 보일러플레이트 제거
    /^(?:왼쪽|오른쪽)으로$/i,
    /^(?:6·3\s*지방선거|부동산\s*경매|호르무즈\s*해협|백도빈\s*다이어트|감자튀김\s*당뇨|정치를\s*부탁해|가상자산\s*해킹|중장년\s*세대)$/i,
    /^홈플러스\s*정상화\s*약속\s*이행\s*촉구\s*정부·여당이\s*나서라$/i,
    /^\[Mandatory Credit:[^\]]+\]$/i,
    /^\[[^\]\n]{1,160}=(?:연합뉴스|뉴시스)\]$/i,
    /^(?:ⓒ\s*)?(?:연합뉴스|뉴시스|뉴스1|유토이미지)$/i,
    /^(?:AP|AFP|로이터|REUTERS)\s+(?:연합뉴스|뉴시스|뉴스1)$/i,
    /^(?:[가-힣]{2,6}\s+){1,3}(?:기자|특파원)$/i,
    /^\([^\)]*(?:로이터|AP|AFP|연합뉴스)\s*=\s*[^\)]*재판매\s*(?:및\s*DB)?금지\)$/i,
    /^[▲△]\s*[^\n]{0,220}(?:ⓒ|관련사진보기|재판매\s*(?:및\s*DB)?금지)/i,
    /^(?:\[[^\]\n]{1,80}\]\s*)?[^\n]{0,220}사진은[^\n]{0,220}(?:\[[^\]]+\]|ⓒ[^\n]+)?$/i,
    /^[^\n]{0,220}\[(?:연합뉴스|뉴시스|AP|AFP|로이터)[^\]]*\]$/i,
    /[ⓒ©]\s*SBS\s*&\s*SBS\s*i/i,
    /◎\s*공감언론\s*뉴시스/i,
    /무단\s*복제/i,
    /무단복제/i,
    /재배포\s*금지/i,
    /^▲+$/i,
    /^(?:▶\s*)?영상\s*시청$/i,
    /^youtube$/i,
    /^유튜브로\s*보기$/i,
    // [LOG: 20260616_1220] 펼치기/접기, 요약, 구글 검색 선호 매체로 추가 제거패턴 추가
    /^(?:펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가)$/i,
    // [LOG: 20260617_2159] Avoid deleting complete paragraphs starting with ▲/△. Restrict to short captions (<60 chars) with no sentence terminators.
    /^[▲△]\s*(?![^.!?]*[.!?])[^\n]{1,60}$/,
    /^\([가-힣]{2,5}=\uC5F0\uD569\uB274\uC2A4\)\$/,
    /^\[[\uAC00-\uD7A3]{2,6}\s*\uAE30\uC790\([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\)\]$/i,
    /^\[[\uAC00-\uD7A3]{2,10}\s*(?:스타투데이|포토|자료사진)\]$/i,
    /^\(사진=[^\)]+\)$/i,
    /\*재판매\s*및\s*DB\s*금지/i,
    /재판매\s*(?:및\s*DB)?\s*금지/i,
    /^(?:제보\s*[:：]|제보는\s*카카오톡)/i,
    /^(?:[\uAC00-\uD7A3]{2,6}\s*\uAE30\uC790(?:,\s*)?)+\s*[=＝]\s*$/
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (stopAtTail) {
      continue;
    }

    let normalizedLine = String(line || '').replace(/\s+/g, ' ').trim();
    if (!normalizedLine) {
      if (!previousBlank && filtered.length > 0) {
        filtered.push('');
      }
      previousBlank = true;
      continue;
    }

    // [LOG: 20260505_2325] Remove leading agency/reporter tags from the start of the line.
    let prefixChanged = true;
    while (prefixChanged) {
      prefixChanged = false;
      for (const pattern of prefixPatterns) {
        const match = normalizedLine.match(pattern);
        if (match && match.index === 0) {
          normalizedLine = normalizedLine.slice(match[0].length).trim();
          prefixChanged = true;
          break;
        }
      }
    }

    if (!normalizedLine) {
      previousBlank = filtered.length > 0 && filtered[filtered.length - 1] === '';
      continue;
    }

    const nextNormalizedLine = String(lines[index + 1] || '').replace(/\s+/g, ' ').trim();
    const nextMeaningfulLine = findNextMeaningfulLine(lines, index + 1);

    if (isKnownArticleTailStartLine(normalizedLine)) {
      stopAtTail = true;
      continue;
    }

    if (shouldSkipPhotoCaptionPair(normalizedLine, nextNormalizedLine)) {
      previousBlank = filtered.length > 0 && filtered[filtered.length - 1] === '';
      index += 1;
      continue;
    }

    if (filtered.length === 0 && shouldSkipLeadPhotoCaptionLine(normalizedLine, nextMeaningfulLine)) {
      previousBlank = filtered.length > 0 && filtered[filtered.length - 1] === '';
      continue;
    }

    if (filtered.length <= 4 && shouldSkipLeadImageCreditLine(normalizedLine, nextMeaningfulLine)) {
      previousBlank = filtered.length > 0 && filtered[filtered.length - 1] === '';
      continue;
    }

    let cutIndex = normalizedLine.length;
    boilerplatePatterns.forEach((pattern) => {
      const match = normalizedLine.match(pattern);
      if (match && typeof match.index === 'number') {
        cutIndex = Math.min(cutIndex, match.index);
      }
    });

    if (cutIndex !== normalizedLine.length) {
      const preserved = normalizedLine.slice(0, cutIndex).trim();
      // [LOG: 20260617_1745] Discard partial slices containing residual copyright/contact noise
      const hasNoise = /저작권자|무단\s*전재|재배포\s*금지|제보|카카오톡|okjebo/i.test(preserved);
      if (preserved.length >= 12 && !hasNoise) {
        filtered.push(preserved);
        previousBlank = false;
        continue;
      }
      previousBlank = filtered.length > 0 && filtered[filtered.length - 1] === '';
      continue;
    }

    filtered.push(normalizedLine);
    previousBlank = false;
  }

  while (filtered.length > 0 && filtered[0] === '') {
    filtered.shift();
  }
  while (filtered.length > 0 && filtered[filtered.length - 1] === '') {
    filtered.pop();
  }

  return filtered.join('\n');
}

function shouldSkipPhotoCaptionPair(line, nextLine) {
  const current = String(line || '').trim();
  const next = String(nextLine || '').trim();
  if (!current || !next || current.length > 80) {
    return false;
  }

  return /^\([^\)]*(?:로이터|AP|AFP|연합뉴스)\s*=\s*[^\)]*재판매\s*(?:및\s*DB)?금지\)$/i.test(next)
    && !/[.!?]$/.test(current);
}

function shouldSkipLeadPhotoCaptionLine(line, nextLine) {
  const current = String(line || '').trim();
  const next = String(nextLine || '').trim();
  if (!current || !next || current.length > 220 || next.length < 40) {
    return false;
  }

  if (!/(?:\/|\s)(?:사진|사진제공|자료사진)\s*=\s*[^\n]{2,80}$/i.test(current)) {
    return false;
  }

  return /[.!?…다요죠]\s*$/.test(next) || next.length >= 60;
}

function shouldSkipLeadImageCreditLine(line, nextLine) {
  const current = String(line || '').replace(/\s+/g, ' ').trim();
  const next = String(nextLine || '').replace(/\s+/g, ' ').trim();
  if (!current || !next || current.length > 180 || next.length < 12) {
    return false;
  }

  if (!(/[.!?…다요죠]\s*$/.test(next) || next.length >= 60)) {
    return false;
  }

  if (/^(?:[가-힣A-Z0-9][^\n]{0,40}\s+)?제공$/i.test(current)) {
    return true;
  }

  return /^[^\n]{4,180}\.\s*[^\n]{0,40}\s+(?:제공|뉴스1|연합뉴스|뉴시스|유토이미지)$/i.test(current);
}

function isKnownArticleTailStartLine(line) {
  const text = String(line || '').trim();
  if (!text) {
    return false;
  }

  const patterns = [
    /^전체\s*내용보기$/i,
    /^기사\s*전체보기$/i,
    /^관련기사$/i,
    /^독자들의\s*PICK!?$/i,
    /^(?:많이\s*본|실시간\s*인기|인기|추천)\s*(?:뉴스|기사)$/i,
    /^이\s*시각\s*추천\s*(?:뉴스|기사)$/i,
    /^당신이\s*좋아할\s*만한\s*(?:뉴스|기사)$/i,
    /^\[뉴스리뷰\]$/i,
    /^연합뉴스TV\s*기사문의\s*및\s*제보\s*:/i,
    /^좋아요$/i,
    /^후속기사\s*원해요$/i,
    /^헬스조선을\s*만나는\s*또다른\s*방법$/i,
    /^PC버전$/i,
    /^맨위로\s*[↑↗↥]?\s*$/i,
    /^저작권자$/i,
    /^(?:한국경제|한경프리미엄9)\s*구독신청$/i,
    /^이\s*시각\s*관심정보$/i,
    /^ADVERTISEMENT$/i,
    /^AD$/i
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function dedupeLeadingTeaserLines(value) {
  const lines = String(value || '').split('\n');
  if (lines.length < 2) {
    return String(value || '').trim();
  }

  const result = [];
  for (let index = 0; index < lines.length; index += 1) {
    const current = String(lines[index] || '').trim();
    if (!current) {
      result.push('');
      continue;
    }

    const next = findNextMeaningfulLine(lines, index + 1);
    if (isDuplicateTeaserLine(current, next)) {
      continue;
    }

    result.push(current);
  }

  return result.join('\n').trim();
}

function findNextMeaningfulLine(lines, startIndex) {
  for (let index = Number(startIndex) || 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trim();
    if (line) {
      return line;
    }
  }
  return '';
}

function isDuplicateTeaserLine(current, next) {
  const left = String(current || '').trim();
  const right = String(next || '').trim();
  if (!left || !right) {
    return false;
  }
  if (!/[.…]{1,3}$/.test(left)) {
    return false;
  }

  const teaser = left.replace(/[.…]{1,3}$/g, '').trim();
  if (teaser.length < 12) {
    return false;
  }

  return commonPrefixLength(teaser, right) >= 12;
}

function commonPrefixLength(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const limit = Math.min(a.length, b.length);
  let count = 0;
  while (count < limit && a[count] === b[count]) {
    count += 1;
  }
  return count;
}

function trimKnownArticleTailNoise(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const patterns = [
    /RSS\s*피드는\s*개인\s*리더\s*이용\s*목적으로\s*허용[\s\S]*$/i,
    /(?:▶\s*)?이\s*기사의\s*전체\s*내용\s*확인하기[\s\S]*$/i,
    /(?:▶\s*)?SBS\s*뉴스\s*앱\s*다운로드[\s\S]*$/i,
    /(?:▶\s*)?뉴스에\s*지식을\s*담다\s*-\s*스브스프리미엄\s*앱\s*다운로드[\s\S]*$/i,
    /[ⓒ©]\s*SBS\s*&\s*SBS\s*i[\s\S]*$/i,
    /◎\s*공감언론\s*뉴시스[\s\S]*$/i,
    /\n{1,2}\s*[^\n]{0,40}기자\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[\s\S]*$/i,
    /\n{1,2}\s*좋아요\s*\n\s*싫어요[\s\S]*$/i,
    /\n{1,2}\s*후속기사\s*원해요[\s\S]*$/i,
    /\n{1,2}\s*전체\s*내용보기[\s\S]*$/i,
    /\n{1,2}\s*기사\s*전체보기[\s\S]*$/i,
    /\n{1,2}\s*관련기사[\s\S]*$/i,
    /\n{1,2}\s*(?:독자들의\s*PICK!?|많이\s*본\s*(?:뉴스|기사)|실시간\s*인기\s*(?:뉴스|기사)|인기\s*(?:뉴스|기사)|추천\s*(?:뉴스|기사)|이\s*시각\s*추천\s*(?:뉴스|기사)|당신이\s*좋아할\s*만한\s*(?:뉴스|기사))[\s\S]*$/i,
    /\n{1,2}\s*\[뉴스리뷰\][\s\S]*$/i,
    /\n{1,2}\s*연합뉴스TV\s*기사문의\s*및\s*제보\s*:[\s\S]*$/i,
    /\n{1,2}\s*헬스조선을\s*만나는\s*또다른\s*방법[\s\S]*$/i,
    /\n{1,2}\s*PC버전[\s\S]*$/i,
    /\n{1,2}\s*맨위로\s*[↑↗↥]?\s*[\s\S]*$/i,
    /\n{1,2}\s*[<\[(]?저작권자[\s\S]*$/i,
    /\n{1,2}\s*(?:한국경제|한경프리미엄9)\s*구독신청[\s\S]*$/i,
    /\n{1,2}\s*이\s*시각\s*관심정보[\s\S]*$/i,
    /\n{1,2}\s*ADVERTISEMENT[\s\S]*$/i,
    /\n{1,2}\s*AD\s*\n[\s\S]*$/i,
    /[ⓒ©][^\n]{0,120}무단\s*전재[\s\S]*$/i,
    /무단\s*전재[\s\S]*$/i,
    /무단\s*복제\s*(?:및\s*재배포)?\s*금지[\s\S]*$/i,
    /▲\s*$/i
  ];

  const minTailIndex = Math.max(0, Math.floor(text.length * 0.15));
  let cutIndex = text.length;

  patterns.forEach((pattern) => {
    const match = text.match(pattern);
    if (match && typeof match.index === 'number' && match.index >= minTailIndex) {
      cutIndex = Math.min(cutIndex, match.index);
    }
  });

  if (cutIndex !== text.length) {
    // [LOG: 20260617_2159] Backtrack to the start of the matched line to prune the entire noisy line,
    // but only if that segment is short noise. If it contains a complete sentence or is long,
    // just cut at the match index to avoid content loss.
    const lastNewline = text.lastIndexOf('\n', cutIndex);
    const lineStartIndex = lastNewline >= 0 ? lastNewline + 1 : 0;
    const prefixOnLine = text.slice(lineStartIndex, cutIndex).trim();

    if (prefixOnLine.length < 15 && !/[.!?]/.test(prefixOnLine)) {
      cutIndex = lastNewline >= 0 ? lastNewline : 0;
    }
  }

  return text.slice(0, cutIndex).trim();
}

function dedupeConsecutiveLines(value) {
  const lines = String(value || '').split('\n');
  const result = [];
  let previousMeaningful = '';

  lines.forEach((line) => {
    const current = String(line || '').trim();
    if (!current) {
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      return;
    }

    if (current === previousMeaningful) {
      return;
    }

    result.push(current);
    previousMeaningful = current;
  });

  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop();
  }

  return result.join('\n').trim();
}

function isLikelyNoisyBody(value) {
  const source = String(value || '');
  if (!source) {
    return false;
  }
  // [LOG: 20260617_0930] Add generic UI buttons, resize elements, scrap triggers, and navigation blocks
  return /(\\u[0-9a-fA-F]{4}|\$\(document\)\.ready|spinTopParams|_spinTop|\uC624\uB298\uC758 \uCD94\uCC9C\uC601\uC0C1|\uC9C0\uAE08 \uB728\uB294 \uB274\uC2A4|\uC88B\uC544\uC694|\uCF54\uBA58\uD2B8|\uB313\uAE00|\uACF5\uC720\uD558\uAE30|\uC804\uCCB4\uBA54\uB274|\uBCF8\uBB38\uC73C\uB85C \uBC14\uB85C\uAC00\uAE30|\uAE00\uC790\uD06C\uAE30|\uAE30\uC0AC \uC77D\uC5B4\uC8FC\uAE30|기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가|이전\s*기사보기|다음\s*기사보기|기사\s*스크랩(?:하기)?|다른\s*공유\s*찾기|본문\s*글씨\s*(?:키우기|줄이기)|스크롤\s*이동\s*상태바|\uC0AC\uC9C4\s*\uD655\uB300|\uC774\uBBF8\uC9C0\s*\uD655\uB300|\uD070\uC0AC\uC9C4\uBCF4\uAE30|\uAD00\uB828\uC0AC\uC9C4\uBCF4\uAE30|\uCE74\uCE74\uC624\uD1A1|\uD398\uC774\uC2A4\uBD81\uBA54\uC2E0\uC800|\uBCF5\uC0AC|\uB3C5\uC790\uB4E4\uC758\s*PICK|\uC804\uCCB4\s*\uB0B4\uC6A9\uBCF4\uAE30|\uAE30\uC0AC\uBB38\uC758\s*\uBC0F\s*\uC81C\uBCF4|\uC7AC\uD310\uB9E4\s*(?:\uBC0F\s*DB)?\uAE08\uC9C0|video\s*\uD0DC\uADF8\uB97C\s*\uC9C0\uC6D0\uD558\uC9C0|\uC624\uB514\uC624\s*\uD0DC\uADF8\uB97C\s*\uC9C0\uC6D0\uD558\uC9C0|^[\(\)\[\]\s]+$)/.test(source);
}

module.exports = {
  buildAuthor,
  isLikelyNoisyBody,
  normalize,
  normalizeUrl,
  pickArticleBody,
  pickPreferredArticleBody,
  sanitizeArticleText
};
