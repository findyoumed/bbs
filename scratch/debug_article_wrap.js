const { createAnsiBuilderUtils } = require('../public/js/core/ansiBuilderUtils');

// Production isWideChar implementation from public/js/core/ansiRenderUtils.js
function isWideChar(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return (cp >= 0x3400 && cp <= 0x4DBF) // CJK Unified Ideographs Extension A
    || (cp >= 0x4E00 && cp <= 0x9FFF) // CJK Unified Ideographs (Hanja)
    || (cp >= 0xF900 && cp <= 0xFAFF) // CJK Compatibility Ideographs
    || (cp >= 0xAC00 && cp <= 0xD7A3) // Hangul Syllables
    || (cp >= 0x1100 && cp <= 0x11FF) // Hangul Jamo
    || (cp >= 0x3130 && cp <= 0x318F) // Hangul Compatibility Jamo
    || (cp >= 0x3000 && cp <= 0x303F) // CJK Symbols and Punctuation
    || (cp >= 0x3200 && cp <= 0x32FF) // CJK Enclosed Letters and Months (e.g. ㈜)
    || (cp >= 0x3300 && cp <= 0x33FF) // CJK Compatibility (e.g. ㎞, ㎡)
    || (cp >= 0xFE30 && cp <= 0xFE4F) // CJK Compatibility Forms
    || (cp >= 0xFF01 && cp <= 0xFF60) // Full-width Forms
    || (cp >= 0x3040 && cp <= 0x309F) // Hiragana
    || (cp >= 0x30A0 && cp <= 0x30FF) // Katakana
    || (cp === 0x203B) // Reference Mark (※)
    || (cp >= 0x25A0 && cp <= 0x27BF); // Geometric shapes, Dingbats (excludes Box Drawings)
}

function displayWidth(text) {
  let width = 0;
  for (const ch of String(text || '')) {
    width += isWideChar(ch) ? 2 : 1;
  }
  return width;
}

const mockDeps = {
  displayWidth,
  isWideChar
};

const text = "■ 진행: 김종원, 윤태진 앵커 ■ 대담: 송지원 변호사, 이경민 변호사 --------------------------------------------------------------- ※ 자세한 내용은 동영상으로 확인하실 수 있습니다.";

function run() {
  const { wrapAnsiText } = createAnsiBuilderUtils(mockDeps);
  
  console.log('Original Text Length:', text.length);
  console.log('Original Display Width:', displayWidth(text));

  // Print character by character detail
  console.log('--- Char Analysis ---');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const cp = ch.codePointAt(0);
    const wide = isWideChar(ch);
    const width = wide ? 2 : 1;
    console.log(`Char [${ch}] (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) -> isWideChar: ${wide} (width: ${width})`);
  }

  const lines = wrapAnsiText(text, 80);
  console.log('--- Wrapped Lines (Width: 80) ---');
  lines.forEach((line, i) => {
    const w = displayWidth(line);
    console.log(`Line ${i} (Width: ${w}): "${line}"`);
    if (w > 80) {
      console.log(`[ALERT] Line exceeds 80 columns!`);
    }
  });
}

run();
