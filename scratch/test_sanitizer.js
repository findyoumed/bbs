'use strict';

const fs = require('fs');
const path = require('path');

const Sanitizer = require('../src/server/RssNewsArticleSanitizer');

const inputBody = `카오 노조가 10일 첫 부분 파업에 들어갔다. 카카오 창사 이래 첫 파업이다.

전국화학섬유식품산업노동조합 카카오지회는 이날 오전 10시부터 부분 파업에 돌입했으며 오후 3시까지 이뤄진다. 이날 부분 파업에 참여하는 법인은 카카오 본사와 카카오페이, 카카오엔터프라이즈, 디케이테크인, 엑스엘게임즈 등 5곳이다.
이날 정오부터 오후 1시까지는 휴식 시간이므로 총 4시간 동안 부분 파업이 이뤄지는 셈이다.
카카오 노조원들은 이날 성남 사옥인 판교아지트 일대를 행진할 예정이다.
이번 카카오 노조 파업은 성과급 보상 구조가 주된 이유로 꼽힌다.
허환주 기자`;

// We will test each function from RssNewsArticleSanitizer
// Let's print the result of each step
const step1 = trimKnownArticleLeadNoise(inputBody);
console.log('--- Step 1: trimKnownArticleLeadNoise ---\n', step1);

const step2 = stripKnownArticleBoilerplateLines(step1);
console.log('\n--- Step 2: stripKnownArticleBoilerplateLines ---\n', step2);

const step3 = trimKnownArticleTailNoise(step2);
console.log('\n--- Step 3: trimKnownArticleTailNoise ---\n', step3);

const step4 = trimInlineRelatedHeadlineNoise(step3);
console.log('\n--- Step 4: trimInlineRelatedHeadlineNoise ---\n', step4);

// Helper functions (copied from RssNewsArticleSanitizer.js to execute inline)
function trimInlineRelatedHeadlineNoise(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const markerPattern = /\s+▲\s+/g;
  let match;
  while ((match = markerPattern.exec(text)) !== null) {
    const markerIndex = match.index;
    if (markerIndex < 24) continue;
    const tail = text.slice(markerIndex + match[0].length).trim();
    const hasAnotherHeadlineMarker = /\s+▲\s+/.test(tail);
    const looksLikeHeadlineTeaser = /[.…]{2,}|["'“”‘’]|(?:공개|잡혔다|갑작스|충격|논란|고백|결혼|남편|아내|살인|혐의|생방송)/.test(tail);
    if (hasAnotherHeadlineMarker || looksLikeHeadlineTeaser) {
      return text.slice(0, markerIndex).trim();
    }
  }
  return text;
}

function trimKnownArticleLeadNoise(value) {
  return value; // Simplified or direct
}

function stripKnownArticleBoilerplateLines(value) {
  const lines = String(value || '').split('\n');
  const filtered = [];
  const boilerplatePatterns = [
    /무단\s*복제/i,
    /무단복제/i,
    /재배포\s*금지/i
  ];
  for (let index = 0; index < lines.length; index += 1) {
    let normalizedLine = String(lines[index] || '').replace(/\s+/g, ' ').trim();
    let cutIndex = normalizedLine.length;
    boilerplatePatterns.forEach((pattern) => {
      const match = normalizedLine.match(pattern);
      if (match && typeof match.index === 'number') {
        console.log(`[stripKnownArticleBoilerplateLines] Line matched boilerplate pattern: ${pattern} at index ${match.index} in line: "${normalizedLine}"`);
        cutIndex = Math.min(cutIndex, match.index);
      }
    });
    if (cutIndex !== normalizedLine.length) {
      const preserved = normalizedLine.slice(0, cutIndex).trim();
      if (preserved.length >= 12) {
        filtered.push(preserved);
      }
      continue;
    }
    filtered.push(normalizedLine);
  }
  return filtered.join('\n');
}

function trimKnownArticleTailNoise(value) {
  const text = String(value || '').trim();
  const patterns = [
    /무단\s*전재[\s\S]*$/i,
    /무단\s*복제\s*(?:및\s*재배포)?\s*금지[\s\S]*$/i
  ];
  const minTailIndex = Math.max(0, Math.floor(text.length * 0.15));
  let cutIndex = text.length;
  patterns.forEach((pattern) => {
    const match = text.match(pattern);
    if (match && typeof match.index === 'number' && match.index >= minTailIndex) {
      console.log(`[trimKnownArticleTailNoise] Matched pattern: ${pattern} at index ${match.index}`);
      cutIndex = Math.min(cutIndex, match.index);
    }
  });
  return text.slice(0, cutIndex).trim();
}
