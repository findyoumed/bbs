// [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" 재현 — 오락실 게임 5종의 순수 로직.
// DOM/ANSI 의존이 전혀 없는 plain export 모듈이라 단독 단위검증이 가능하다.
// (오목 OMOK / 오델로 OTH / 숫자야구 BASE / 영어단어맞추기 WORD / 숫자판맞추기 16P)

// ── 오목 (15x15, 1=흑=사용자 선공, 2=백=컴퓨터) ─────────────────────────────
export const OMOK_SIZE = 15;

export function createOmokState() {
  return { board: new Array(OMOK_SIZE * OMOK_SIZE).fill(0), moves: 0, status: 'play', last: null, lastCpu: null };
}

const inOmok = (x, y) => x >= 0 && x < OMOK_SIZE && y >= 0 && y < OMOK_SIZE;
const OMOK_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

// 착수점 기준 4방향 양쪽 연속 카운트 ≥5 (장목 허용 — 원전 천리안도 흑 금수 규칙 없음)
export function omokCheckWin(board, x, y) {
  const who = board[y * OMOK_SIZE + x];
  if (!who) return false;
  for (const [dx, dy] of OMOK_DIRS) {
    let count = 1;
    for (const sign of [1, -1]) {
      let cx = x + dx * sign, cy = y + dy * sign;
      while (inOmok(cx, cy) && board[cy * OMOK_SIZE + cx] === who) { count++; cx += dx * sign; cy += dy * sign; }
    }
    if (count >= 5) return true;
  }
  return false;
}

// (x,y)에 who의 돌을 놓았다고 가정한 4방향 패턴 점수 합.
// 5연=1e6 > 열린4=1e5 > 닫힌4=5e4 > 열린3=1e4 순 — 수비 가중 0.9를 곱해도 서열이 유지되어
// "상대 5연/열린4 차단"이 "자기 열린3 만들기"보다 항상 우선한다.
function omokPatternScore(count, open) {
  if (count >= 5) return 1e6;
  if (count === 4) return open === 2 ? 1e5 : open === 1 ? 5e4 : 0;
  if (count === 3) return open === 2 ? 1e4 : open === 1 ? 1e3 : 0;
  if (count === 2) return open === 2 ? 500 : open === 1 ? 100 : 0;
  return open === 2 ? 50 : 10;
}

function omokEvalFor(board, x, y, who) {
  let total = 0;
  for (const [dx, dy] of OMOK_DIRS) {
    let count = 1, open = 0;
    for (const sign of [1, -1]) {
      let cx = x + dx * sign, cy = y + dy * sign;
      while (inOmok(cx, cy) && board[cy * OMOK_SIZE + cx] === who) { count++; cx += dx * sign; cy += dy * sign; }
      if (inOmok(cx, cy) && board[cy * OMOK_SIZE + cx] === 0) open++;
    }
    total += omokPatternScore(count, open);
  }
  return total;
}

// [LOG_ID: 20260720_1800] 렌주룰 33/44 금수를 시도했으나(20260720_1500) 백(컴퓨터)에게는
// 적용하지 않아 컴퓨터가 이중 위협을 자유롭게 쌓을 수 있었고, 실제로 33이 아니라 44(양쪽
// 열린4)를 만들어 승리하는 사례가 나왔다(사용자 실측: H5 착수로 두 대각선이 동시에 열린4).
// 33만 있고 44는 없는 반쪽 규칙이 오히려 불공평하다는 사용자 판단으로 금수 규칙 자체를
// 제거하고 순수 5목(자유오목)으로 되돌린다 — 장목도 이미 허용 중이었으므로(omokCheckWin)
// 이제 흑/백 모두 규칙 없이 대칭이다.

export function omokBestMove(board) {
  const center = Math.floor(OMOK_SIZE / 2);
  if (board.every((v) => v === 0)) return { x: center, y: center };
  // 후보: 기존 돌에서 체비쇼프 거리 2 이내의 빈 칸 (전칸 탐색 대비 수십 배 절약)
  const candidates = new Set();
  for (let y = 0; y < OMOK_SIZE; y++) {
    for (let x = 0; x < OMOK_SIZE; x++) {
      if (board[y * OMOK_SIZE + x] === 0) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const cx = x + dx, cy = y + dy;
          if (inOmok(cx, cy) && board[cy * OMOK_SIZE + cx] === 0) candidates.add(cy * OMOK_SIZE + cx);
        }
      }
    }
  }
  let best = null, bestScore = -Infinity;
  for (const idx of candidates) {
    const x = idx % OMOK_SIZE, y = Math.floor(idx / OMOK_SIZE);
    const score = omokEvalFor(board, x, y, 2) + omokEvalFor(board, x, y, 1) * 0.9
      - (Math.abs(x - center) + Math.abs(y - center)) * 0.5 + Math.random();
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best;
}

// ── 오델로 (8x8, 1=흑=사용자 선공, 2=백=컴퓨터) ─────────────────────────────
export const OTH_SIZE = 8;
const OTH_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function createOthelloState() {
  const board = new Array(OTH_SIZE * OTH_SIZE).fill(0);
  board[3 * 8 + 3] = 2; board[3 * 8 + 4] = 1; // d4=백 e4=흑
  board[4 * 8 + 3] = 1; board[4 * 8 + 4] = 2; // d5=흑 e5=백
  return { board, status: 'play', lastCpu: null, passMsg: '' };
}

// idx에 player가 두면 뒤집힐 칸들의 배열 (길이 0 = 비합법수)
export function othelloFlipsFor(board, idx, player) {
  if (board[idx] !== 0) return [];
  const x0 = idx % OTH_SIZE, y0 = Math.floor(idx / OTH_SIZE), opp = 3 - player, flips = [];
  for (const [dx, dy] of OTH_DIRS) {
    const line = [];
    let x = x0 + dx, y = y0 + dy;
    while (x >= 0 && x < OTH_SIZE && y >= 0 && y < OTH_SIZE && board[y * OTH_SIZE + x] === opp) {
      line.push(y * OTH_SIZE + x); x += dx; y += dy;
    }
    if (line.length && x >= 0 && x < OTH_SIZE && y >= 0 && y < OTH_SIZE && board[y * OTH_SIZE + x] === player) flips.push(...line);
  }
  return flips;
}

export function othelloLegalMoves(board, player) {
  const moves = [];
  for (let idx = 0; idx < board.length; idx++) {
    const flips = othelloFlipsFor(board, idx, player);
    if (flips.length) moves.push({ idx, flips });
  }
  return moves;
}

export function othelloApply(board, idx, player, flips) {
  board[idx] = player;
  for (const f of flips) board[f] = player;
}

// 귀(모서리) 최우선, 귀 옆 X/C칸 회피 — 고전 위치 가중치 + 뒤집는 수의 그리디
const OTH_WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 3, 1, 1, 3, -2, 10,
  5, -2, 1, 1, 1, 1, -2, 5,
  5, -2, 1, 1, 1, 1, -2, 5,
  10, -2, 3, 1, 1, 3, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100
];

export function othelloBestMove(board) {
  const moves = othelloLegalMoves(board, 2);
  if (!moves.length) return null;
  let best = null, bestScore = -Infinity;
  for (const move of moves) {
    const score = OTH_WEIGHTS[move.idx] + 2 * move.flips.length + Math.random();
    if (score > bestScore) { bestScore = score; best = move; }
  }
  return best;
}

export function othelloCount(board) {
  let black = 0, white = 0;
  for (const v of board) { if (v === 1) black++; else if (v === 2) white++; }
  return { black, white };
}

// ── 숫자야구 (서로 다른 3자리, 선두 0 금지, 9회 한도) ────────────────────────
export const BASEBALL_MAX_TRIES = 9;

export function createBaseballState() {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const first = digits.splice(Math.floor(Math.random() * digits.length), 1)[0];
  digits.push('0');
  const second = digits.splice(Math.floor(Math.random() * digits.length), 1)[0];
  const third = digits.splice(Math.floor(Math.random() * digits.length), 1)[0];
  return { answer: first + second + third, tries: [], status: 'play' };
}

export function baseballJudge(answer, guess) {
  let strike = 0, ball = 0;
  for (let i = 0; i < 3; i++) {
    if (guess[i] === answer[i]) strike++;
    else if (answer.includes(guess[i])) ball++;
  }
  return { strike, ball };
}

// ── 영어단어 맞추기 (책 6.14.1 HANGMAN — [8/10] 실패 카운트, 정답 공개 시 뜻도 함께) ──
export const HANGMAN_MAX_WRONG = 10;

export const HANGMAN_WORDS = [
  ['ABILITY', '능력'], ['ABSENCE', '부재'], ['ACADEMY', '학원'], ['ACCOUNT', '계좌'], ['ADDRESS', '주소'],
  ['ADVANCE', '전진'], ['ADVICE', '충고'], ['AIRPORT', '공항'], ['ANCIENT', '고대의'], ['ANIMAL', '동물'],
  ['ANSWER', '대답'], ['ARTICLE', '기사'], ['ATTITUDE', '태도'], ['AUTUMN', '가을'], ['AVENUE', '큰길'],
  ['BALANCE', '균형'], ['BANQUET', '연회'], ['BATTERY', '전지'], ['BEAUTY', '아름다움'], ['BENEFIT', '이익'],
  ['BICYCLE', '자전거'], ['BLANKET', '담요'], ['BORDER', '국경'], ['BOTTLE', '병'], ['BRANCH', '나뭇가지'],
  ['BREAKFAST', '아침식사'], ['BRIDGE', '다리'], ['BUDGET', '예산'], ['BUTTON', '단추'], ['CABBAGE', '양배추'],
  ['CAMERA', '사진기'], ['CAPTAIN', '선장'], ['CAREER', '경력'], ['CASTLE', '성'], ['CEILING', '천장'],
  ['CENTURY', '세기'], ['CHANNEL', '채널'], ['CHAPTER', '장(章)'], ['CHARITY', '자선'], ['CHICKEN', '닭'],
  ['CHIMNEY', '굴뚝'], ['CIRCLE', '원'], ['CITIZEN', '시민'], ['CLIMATE', '기후'], ['COLLEGE', '대학'],
  ['COMFORT', '위안'], ['COMPANY', '회사'], ['COMPUTER', '컴퓨터'], ['CONCERT', '연주회'], ['COTTON', '목화'],
  ['COUNTRY', '나라'], ['COURAGE', '용기'], ['COUSIN', '사촌'], ['CULTURE', '문화'], ['CURTAIN', '커튼'],
  ['CUSTOM', '관습'], ['DANGER', '위험'], ['DECADE', '십 년'], ['DEGREE', '정도'], ['DESERT', '사막'],
  ['DESIGN', '설계'], ['DESSERT', '후식'], ['DIAMOND', '금강석'], ['DINNER', '저녁식사'], ['DOCTOR', '의사'],
  ['DOLPHIN', '돌고래'], ['DRAGON', '용'], ['DRAWER', '서랍'], ['ECONOMY', '경제'], ['EFFORT', '노력'],
  ['ENGINE', '기관'], ['EXAMPLE', '보기'], ['EXPERT', '전문가'], ['FACTORY', '공장'], ['FAMILY', '가족'],
  ['FARMER', '농부'], ['FEATHER', '깃털'], ['FESTIVAL', '축제'], ['FINGER', '손가락'], ['FLOWER', '꽃'],
  ['FOREST', '숲'], ['FORTUNE', '행운'], ['FREEDOM', '자유'], ['FRIEND', '친구'], ['FUTURE', '미래'],
  ['GALLERY', '화랑'], ['GARDEN', '정원'], ['GESTURE', '몸짓'], ['GLACIER', '빙하'], ['GRAMMAR', '문법'],
  ['GUITAR', '기타'], ['HARBOR', '항구'], ['HARVEST', '수확'], ['HEALTH', '건강'], ['HEAVEN', '천국'],
  ['HISTORY', '역사'], ['HOLIDAY', '휴일'], ['HONESTY', '정직'], ['HORIZON', '지평선'], ['HUSBAND', '남편'],
  ['ISLAND', '섬'], ['JOURNAL', '일지'], ['JOURNEY', '여행'], ['JUSTICE', '정의'], ['KITCHEN', '부엌'],
  ['KNOWLEDGE', '지식'], ['LADDER', '사다리'], ['LANGUAGE', '언어'], ['LAWYER', '변호사'], ['LEATHER', '가죽'],
  ['LETTER', '편지'], ['LIBRARY', '도서관'], ['LUGGAGE', '짐'], ['MACHINE', '기계'], ['MAGAZINE', '잡지'],
  ['MANNER', '예의'], ['MARKET', '시장'], ['MEDICINE', '약'], ['MEMBER', '회원'], ['MEMORY', '기억'],
  ['MESSAGE', '전갈'], ['MINUTE', '분(分)'], ['MIRACLE', '기적'], ['MIRROR', '거울'], ['MODERN', '현대의'],
  ['MOMENT', '순간'], ['MONKEY', '원숭이'], ['MORNING', '아침'], ['MOUNTAIN', '산'], ['MUSEUM', '박물관'],
  ['MUSIC', '음악'], ['MYSTERY', '수수께끼'], ['NATION', '국가'], ['NATURE', '자연'], ['NEEDLE', '바늘'],
  ['NEIGHBOR', '이웃'], ['NETWORK', '통신망'], ['NUMBER', '숫자'], ['OBJECT', '물건'], ['OCEAN', '대양'],
  ['OFFICE', '사무실'], ['ORANGE', '귤'], ['ORCHARD', '과수원'], ['PACKAGE', '소포'], ['PALACE', '궁전'],
  ['PARENT', '부모'], ['PARTNER', '동반자'], ['PASSION', '열정'], ['PATIENT', '환자'], ['PATTERN', '무늬'],
  ['PEOPLE', '사람들'], ['PEPPER', '후추'], ['PICTURE', '그림'], ['PIGEON', '비둘기'], ['PLANET', '행성'],
  ['POCKET', '주머니'], ['POETRY', '시(詩)'], ['POLICE', '경찰'], ['POVERTY', '가난'], ['PRESENT', '선물'],
  ['PRINCE', '왕자'], ['PROBLEM', '문제'], ['PROMISE', '약속'], ['PURPOSE', '목적'], ['PYRAMID', '피라미드'],
  ['QUALITY', '품질'], ['QUESTION', '질문'], ['RABBIT', '토끼'], ['RAINBOW', '무지개'], ['REASON', '이유'],
  ['RECIPE', '조리법'], ['RESCUE', '구조'], ['RESULT', '결과'], ['RIBBON', '리본'], ['SCHOLAR', '학자'],
  ['SCHOOL', '학교'], ['SCIENCE', '과학'], ['SEASON', '계절'], ['SECRET', '비밀'], ['SHADOW', '그림자'],
  ['SILENCE', '침묵'], ['SILVER', '은'], ['SISTER', '자매'], ['SOCIETY', '사회'], ['SOLDIER', '군인'],
  ['SPIRIT', '정신'], ['SPRING', '봄'], ['SQUARE', '광장'], ['STATION', '역'], ['STOMACH', '위장'],
  ['STRANGER', '낯선 사람'], ['STREET', '거리'], ['STUDENT', '학생'], ['SUBJECT', '과목'], ['SUCCESS', '성공'],
  ['SUMMER', '여름'], ['SUNSET', '해질녘'], ['SYSTEM', '체계'], ['TALENT', '재능'], ['TEACHER', '선생님'],
  ['TEMPLE', '사원'], ['THEATER', '극장'], ['THUNDER', '천둥'], ['TICKET', '표'], ['TONGUE', '혀'],
  ['TRAVEL', '여행하다'], ['TREASURE', '보물'], ['TRIANGLE', '삼각형'], ['TROUBLE', '곤란'], ['TUNNEL', '터널'],
  ['UMBRELLA', '우산'], ['UNIFORM', '제복'], ['VALLEY', '골짜기'], ['VICTORY', '승리'], ['VILLAGE', '마을'],
  ['VOLCANO', '화산'], ['VOYAGE', '항해'], ['WEALTH', '부(富)'], ['WEATHER', '날씨'], ['WEEKEND', '주말'],
  ['WELCOME', '환영'], ['WINDOW', '창문'], ['WINTER', '겨울'], ['WISDOM', '지혜'], ['WONDER', '경이'],
  ['WORKER', '노동자'], ['WRITER', '작가'], ['YELLOW', '노랑'], ['ZEBRA', '얼룩말'], ['ZOOLOGY', '동물학']
];

export function createHangmanState() {
  const [word, meaning] = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
  return { word, meaning, guessed: [], wrong: 0, maxWrong: HANGMAN_MAX_WRONG, status: 'play' };
}

// 반환: 'already' | 'hit' | 'miss'. 상태(guessed/wrong/status)는 st를 직접 갱신한다.
export function hangmanApply(st, letter) {
  const upper = String(letter || '').toUpperCase();
  if (st.guessed.includes(upper)) return 'already';
  st.guessed.push(upper);
  if (st.word.includes(upper)) {
    if ([...st.word].every((ch) => st.guessed.includes(ch))) st.status = 'win';
    return 'hit';
  }
  st.wrong++;
  if (st.wrong >= st.maxWrong) st.status = 'lose';
  return 'miss';
}

// 책 원전 스타일: 맞춘 글자는 소문자로, 못 맞춘 글자는 '.'로 표기 (예: ce..e....)
export function hangmanMasked(st) {
  return [...st.word].map((ch) => (st.guessed.includes(ch) ? ch.toLowerCase() : '.')).join('');
}

// ── 숫자판 맞추기 (4x4 15퍼즐, 0=빈칸) ──────────────────────────────────────
const PUZZLE15_SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

function puzzle15Neighbors(blankIdx) {
  const x = blankIdx % 4, y = Math.floor(blankIdx / 4), result = [];
  if (x > 0) result.push(blankIdx - 1);
  if (x < 3) result.push(blankIdx + 1);
  if (y > 0) result.push(blankIdx - 4);
  if (y < 3) result.push(blankIdx + 4);
  return result;
}

export function puzzle15IsSolved(tiles) {
  return tiles.every((v, i) => v === PUZZLE15_SOLVED[i]);
}

// 완성 상태에서 합법 이동만 200회 수행해 섞는다 → 가해성(풀 수 있음)이 항상 보장된다.
export function createPuzzle15State() {
  const tiles = [...PUZZLE15_SOLVED];
  let blank = 15, prev = -1;
  for (let i = 0; i < 200 || puzzle15IsSolved(tiles); i++) {
    const options = puzzle15Neighbors(blank).filter((idx) => idx !== prev);
    const pick = options[Math.floor(Math.random() * options.length)];
    tiles[blank] = tiles[pick];
    tiles[pick] = 0;
    prev = blank;
    blank = pick;
  }
  return { tiles, moves: 0, status: 'play' };
}

// num 타일이 빈칸과 인접하면 교환. 반환: 이동 성공 여부. 완성 시 st.status='win'.
export function puzzle15Apply(st, num) {
  const tileIdx = st.tiles.indexOf(num);
  const blankIdx = st.tiles.indexOf(0);
  if (tileIdx < 0 || !puzzle15Neighbors(blankIdx).includes(tileIdx)) return false;
  st.tiles[blankIdx] = num;
  st.tiles[tileIdx] = 0;
  st.moves++;
  if (puzzle15IsSolved(st.tiles)) st.status = 'win';
  return true;
}
