// [LOG_ID: 20260716_2200] 한글 자판 입력을 QWERTY 키로 되돌리는 공용 변환.
// 회원가입 ID/이메일 영문 가드(signupEmailForm.js)와 모든 마스킹(비밀번호) 입력의 영문 전용
// 가드(appEventsCommandInput.js)가 함께 사용한다. 두 곳에 흩어져 있던 맵을 한 곳으로 모은다.

const HANGUL_INITIAL_KEYS = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g'];
const HANGUL_MEDIAL_KEYS = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l'];
const HANGUL_FINAL_KEYS = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g'];
const HANGUL_COMPAT_KEYS = {
  'ㄱ': 'r', 'ㄲ': 'R', 'ㄳ': 'rt', 'ㄴ': 's', 'ㄵ': 'sw', 'ㄶ': 'sg', 'ㄷ': 'e', 'ㄸ': 'E',
  'ㄹ': 'f', 'ㄺ': 'fr', 'ㄻ': 'fa', 'ㄼ': 'fq', 'ㄽ': 'ft', 'ㄾ': 'fx', 'ㄿ': 'fv', 'ㅀ': 'fg',
  'ㅁ': 'a', 'ㅂ': 'q', 'ㅃ': 'Q', 'ㅄ': 'qt', 'ㅅ': 't', 'ㅆ': 'T', 'ㅇ': 'd', 'ㅈ': 'w',
  'ㅉ': 'W', 'ㅊ': 'c', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅍ': 'v', 'ㅎ': 'g',
  'ㅏ': 'k', 'ㅐ': 'o', 'ㅑ': 'i', 'ㅒ': 'O', 'ㅓ': 'j', 'ㅔ': 'p', 'ㅕ': 'u', 'ㅖ': 'P',
  'ㅗ': 'h', 'ㅘ': 'hk', 'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅛ': 'y', 'ㅜ': 'n', 'ㅝ': 'nj', 'ㅞ': 'np',
  'ㅟ': 'nl', 'ㅠ': 'b', 'ㅡ': 'm', 'ㅢ': 'ml', 'ㅣ': 'l'
};

/**
 * 완성형 한글(가~힣)·호환 자모(ㄱ~ㅣ)를 두벌식 자판에서 눌린 QWERTY 키 문자열로 되돌린다.
 * 그 외 문자는 NFKC 정규화만 거쳐 그대로 둔다.
 */
export function convertHangulToKeyboardText(value) {
  return Array.from(String(value || '')).map((char) => {
    if (Object.prototype.hasOwnProperty.call(HANGUL_COMPAT_KEYS, char)) {
      return HANGUL_COMPAT_KEYS[char];
    }

    const code = char.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) {
      return char.normalize('NFKC');
    }

    const syllableIndex = code - 0xAC00;
    const initialIndex = Math.floor(syllableIndex / 588);
    const medialIndex = Math.floor((syllableIndex % 588) / 28);
    const finalIndex = syllableIndex % 28;
    return `${HANGUL_INITIAL_KEYS[initialIndex] || ''}${HANGUL_MEDIAL_KEYS[medialIndex] || ''}${HANGUL_FINAL_KEYS[finalIndex] || ''}`;
  }).join('');
}

/**
 * 비밀번호 등 마스킹 입력용: 한글 자판을 QWERTY로 되돌린 뒤, 출력 가능한 ASCII(공백 제외)만 남긴다.
 * 한글 모드로 입력해도 실제 누른 영문/숫자/특수문자가 그대로 들어가고, 한글은 사라진다.
 */
export function toAsciiPasswordInput(value) {
  return convertHangulToKeyboardText(value).replace(/[^\x21-\x7E]/g, '');
}
