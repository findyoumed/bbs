'use strict';

const mockService = {
  _normalize(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFKC')
      .trim();
  }
};

function normalizeNewsDedupeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function originalNormalizeNewsDedupeTitle(service, item) {
  let title = service._normalize(item?.title || '');
  const sourceTitle = service._normalize(item?.sourceTitle || item?.author || '');

  if (title && sourceTitle) {
    const escapedSource = escapeRegExp(sourceTitle);
    title = title
      .replace(new RegExp(`^\\[?\\s*${escapedSource}\\s*\\]?\\s*(?:[:|\\-]\\s*)?`, 'i'), '')
      .replace(new RegExp(`\\s*(?:[:|\\-]\\s*)${escapedSource}$`, 'i'), '')
      .trim();
  }

  return normalizeNewsDedupeText(title);
}

function newNormalizeNewsDedupeTitle(service, item) {
  let title = service._normalize(item?.title || '');
  const sourceTitle = service._normalize(item?.sourceTitle || item?.author || '');

  // 1. Remove bracketed media prefixes at the very beginning
  title = title.replace(/^\[[^\]]+\]\s*/i, '');
  title = title.replace(/^\([^)]+\)\s*/i, '');

  // 2. Remove standard brackets / keywords like (종합), [종합], (상보), (1보), [1보]
  title = title.replace(/\s*[([](?:종합|상보|속보|단독|포토|영상|\d+보|종합\d+보)[)\]]/gi, '');

  // 3. Remove sourceTitle prefix or suffix if available
  if (title && sourceTitle) {
    const escapedSource = escapeRegExp(sourceTitle);
    title = title
      .replace(new RegExp(`^\\[?\\s*${escapedSource}\\s*\\]?\\s*(?:[:|\\-]\\s*)?`, 'i'), '')
      .replace(new RegExp(`\\s*(?:[:|\\-]\\s*)${escapedSource}$`, 'i'), '')
      .trim();
  }

  // 4. Forcefully strip common Korean media name patterns at the end
  title = title.replace(/\s*[-—|•/]\s*[A-Za-z0-9가-힣\s]+(?:뉴스|tv|신문|일보|경제|포커스|데일리|타임즈|타임스|코리아|닷컴|net|한민족센터)?$/i, '');

  // 5. Apply normal dedupe text normalization
  let clean = normalizeNewsDedupeText(title);

  // 6. Strip all whitespace and punctuation symbols
  clean = clean.replace(/[\s\Q!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~…“”’‘『』「」〈〉\E]/g, '');

  return clean;
}

const testCases = [
  {
    desc: 'Case 1: Spacing and brackets',
    items: [
      { title: '"체코 승리 걸었다 돈 날려"…오현규 부모 식당 \'별점테러\' 공분 - JTBC', sourceTitle: 'JTBC' },
      { title: '[영상] "체코 승리 걸었다 돈 날려"... 오현규 부모 식당 \'별점테러\' 공분', sourceTitle: 'JTBC' }
    ]
  },
  {
    desc: 'Case 2: Different media names and brackets',
    items: [
      { title: '李대통령, G7 정상회의 참석차 프랑스로… 에비앙 도착 - KBS 뉴스', sourceTitle: 'KBS 뉴스' },
      { title: '李대통령, G7정상회의 참석차 프랑스 에비앙 도착 - 연합뉴스', sourceTitle: '연합뉴스' },
      { title: '李대통령, G7 정상회의 참석차 에비앙 도착 (종합) - 뉴시스', sourceTitle: '뉴시스' }
    ]
  }
];

console.log('--- RUNNING DEDUPE TITLE NORMALIZATION TEST ---');
testCases.forEach((tc) => {
  console.log(`\nTesting: ${tc.desc}`);
  tc.items.forEach((item, idx) => {
    const origKey = originalNormalizeNewsDedupeTitle(mockService, item);
    const newKey = newNormalizeNewsDedupeTitle(mockService, item);
    console.log(`  Item ${idx + 1}: "${item.title}"`);
    console.log(`    Original Dedupe Key: "${origKey}"`);
    console.log(`    New Dedupe Key:      "${newKey}"`);
  });
});
