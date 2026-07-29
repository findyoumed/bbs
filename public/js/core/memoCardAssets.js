/**
 * [LOG_ID: 20260719_1200] 하이텔 (10)-3 축하카드/그림엽서(vmail) · 천리안 그림엽서(GWMAIL) 재현용
 * ASCII 카드 아트. 이모지는 터미널 폰트에서 폭이 불안정(2칸/tofu)하므로 ASCII·박스문자만 쓴다.
 * 각 art 줄은 표시폭 ≤ 32칸으로 맞춰, 뷰(buildMemoViewAnsi)가 44/80칸에 가운데 정렬해도 안 넘친다.
 *
 * 카드는 별도 테이블 없이 쪽지 content 맨 앞에 `[CARD:key]` 마커로 저장되고, 쪽지 보기 화면이
 * 이 마커를 감지해 아트를 렌더한 뒤 마커를 지운 본문을 이어 보여준다.
 */
export const MEMO_CARDS = {
  birthday: {
    label: '생일 축하',
    color: 14, // 노랑
    art: [
      '  *   .   *   .   *   .   *',
      '     H A P P Y',
      '   B I R T H D A Y',
      '',
      '      __|__|__|__',
      '     |==========|',
      '     |__________|',
      '       |  |  |',
      '',
      '  생일을 진심으로 축하합니다!'
    ]
  },
  congrats: {
    label: '축하합니다',
    color: 13, // 분홍
    art: [
      '   \\  |  /   \\  |  /',
      '    \\ | /     \\ | /',
      '  --- * ---  --- * ---',
      '    / | \\     / | \\',
      '   /  |  \\   /  |  \\',
      '',
      '   C O N G R A T S !',
      '',
      '    축하합니다!'
    ]
  },
  thanks: {
    label: '감사합니다',
    color: 10, // 초록
    art: [
      '   .-"""""""""""""-.',
      '  /   T H A N K S   \\',
      ' |                   |',
      ' |     ( ^   ^ )     |',
      ' |      \\  v  /      |',
      '  \\      \'---\'      /',
      '   \'-.._______..-\'',
      '',
      '   고맙습니다!'
    ]
  },
  xmas: {
    label: '성탄 축하',
    color: 12, // 빨강
    art: [
      '         *',
      '        /.\\',
      '       /..o\\',
      '      /o....\\',
      '     /...o..o\\',
      '    /..o......\\',
      '   /____________\\',
      '        |__|',
      '',
      '  Merry Christmas!',
      '  성탄을 축하합니다.'
    ]
  }
};

/**
 * 축하카드 선택 목록(1부터). 쓰기 흐름의 카드 선택 단계와 뷰 렌더가 같은 순서를 공유한다.
 */
export const MEMO_CARD_KEYS = Object.keys(MEMO_CARDS);

// [LOG_ID: 20260729_0100] MEMO_CARDS[key]는 일반 객체 리터럴이라 프로토타입 체인까지 조회한다 —
// 쪽지 content는 서버가 자유 텍스트로 그대로 저장하므로(validateMemoInput은 길이만 본다),
// 누구든 다른 회원에게 `[CARD:__proto__]`(또는 constructor/toString 등 Object.prototype이
// 실제로 갖고 있는 이름) 마커가 붙은 쪽지를 보낼 수 있다. 그러면 여기서 Object.prototype이
// (참값이라 `|| null`을 통과해) 그대로 반환되고, buildMemoViewAnsi의 `card.art.forEach(...)`가
// art가 없는 Object.prototype에서 TypeError로 죽어 그 쪽지를 열람하는 순간 화면이 깨졌다
// (실측 재현: getMemoCard('__proto__') === Object.prototype). hasOwnProperty로 실제 정의된
// 카드 키인지 먼저 확인한다.
export function getMemoCard(key) {
  const normalized = String(key || '').trim();
  return Object.prototype.hasOwnProperty.call(MEMO_CARDS, normalized) ? MEMO_CARDS[normalized] : null;
}
