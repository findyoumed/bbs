import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { DOOR_ART } from './doorArtAssets.js';

// [LOG_ID: 20260714_1749] Improved Biorhythm UI with Perception rhythm, clean vertical alignment, scale guide, and responsive layouts.
// [LOG_ID: 20260623_1300] Restored GAME builders for biorhythm, fortune, and MBTI.
const MBTI_TYPES = [
  ['ISTJ', '청렴결백한 논리주의자', '사실에 근거해 책임감 있게 일을 처리하는 현실주의자입니다.'],
  ['ISFJ', '용감한 수호자', '주변 사람을 세심하게 챙기는 헌신적인 보호자입니다.'],
  ['INFJ', '선의의 옹호자', '깊은 통찰로 더 나은 세상을 위해 움직이는 이상주의자입니다.'],
  ['INTJ', '용의주도한 전략가', '독립적이고 분석적으로 목표를 향해 나아가는 전략가입니다.'],
  ['ISTP', '만능 재주꾼', '현실적인 문제를 침착하게 풀어내는 해결사입니다.'],
  ['ISFP', '호기심 많은 예술가', '자유로운 분위기와 현재의 순간을 소중히 여기는 예술가입니다.'],
  ['INFP', '열정적인 중재자', '사람과 세상의 가능성을 믿는 따뜻한 이상주의자입니다.'],
  ['INTP', '논리적인 사색가', '복잡한 문제를 즐겨 파고드는 독창적인 사색가입니다.'],
  ['ESTP', '모험을 즐기는 사업가', '순발력이 뛰어나고 현장에서 빛을 발하는 행동파입니다.'],
  ['ESFP', '자유로운 영혼의 연예인', '사람들과 어울리며 분위기를 밝게 만드는 엔터테이너입니다.'],
  ['ENFP', '재기발랄한 활동가', '새로운 가능성에 설레고 사람들에게 영감을 주는 자유인입니다.'],
  ['ENTP', '뜨거운 논쟁을 즐기는 변론가', '지적 도전과 틀을 깨는 아이디어를 즐기는 발명가입니다.'],
  ['ESTJ', '엄격한 관리자', '체계와 원칙으로 조직을 안정적으로 이끄는 관리자입니다.'],
  ['ESFJ', '사교적인 외교관', '배려와 협력을 중시하며 사람들을 살뜰히 챙기는 외교관입니다.'],
  ['ENFJ', '정의로운 사회운동가', '사람을 이끌고 격려하는 카리스마 있는 이타주의자입니다.'],
  ['ENTJ', '대담한 통솔자', '큰 그림을 그리고 사람들을 결집시키는 타고난 통솔자입니다.']
];
const ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

// [LOG_ID: 20260719_1600] 천리안 원전(온라인 철학관: BLOOD/SAJU) 재현 — 기존 바이오리듬/오늘의운세/MBTI와
// 동일하게 서버 데이터 없이 결정론적 알고리즘만으로 결과를 낸다.
const BLOOD_TYPES = [
  ['A', '섬세한 계획가', '신중하고 책임감이 강하며 원칙과 질서를 중요하게 여깁니다. 장점은 성실함과 꼼꼼한 준비성이고, 단점은 지나친 걱정과 완벽주의로 스트레스를 잘 받는다는 것입니다.'],
  ['B', '자유로운 탐구가', '호기심이 많고 자기 주관이 뚜렷하며 관심 분야에 몰입하는 힘이 강합니다. 장점은 독창성과 순발력이고, 단점은 마이페이스가 강해 주변과 부딪히기 쉽다는 것입니다.'],
  ['O', '타고난 리더', '목표 지향적이고 사교적이며 사람들을 이끄는 힘이 있습니다. 장점은 추진력과 포용력이고, 단점은 승부욕이 강해 고집스러워 보일 수 있다는 것입니다.'],
  ['AB', '이중적인 예술가', '이성과 감성을 오가며 다면적인 매력을 지닌 분석가입니다. 장점은 균형감각과 통찰력이고, 단점은 속마음을 잘 드러내지 않아 오해를 사기 쉽다는 것입니다.']
];
const COMPAT_MESSAGES = [
  '서로의 부족한 부분을 채워주는 궁합입니다. 대화를 많이 나눌수록 더 가까워집니다.',
  '티격태격하면서도 정이 쌓이는 사이입니다. 작은 배려가 큰 힘이 됩니다.',
  '가치관이 비슷해 편안한 궁합입니다. 다만 익숙해질수록 표현에 신경 쓰세요.',
  '함께 있으면 에너지가 배가되는 궁합입니다. 새로운 일을 함께 도모해보세요.',
  '천천히 알아갈수록 빛을 발하는 궁합입니다. 조급해하지 않는 것이 중요합니다.',
  '서로 다른 매력에 이끌리는 궁합입니다. 차이를 인정하면 오래갑니다.'
];
// [LOG_ID: 20260719_2300] 12개월과 1:1로 배정되도록 정확히 12개를 둔다(아래 buildTojeongAnsi의
// bijection 배정 로직 참고 — 8개였을 때는 4개월이 필연적으로 겹쳤다).
const TOJEONG_MESSAGES = [
  '한 걸음 물러나 기다리면 좋은 소식이 옵니다.',
  '적극적으로 나서면 좋은 결실을 맺습니다.',
  '작은 다툼을 조심하면 무난히 넘어갑니다.',
  '귀인의 도움으로 막힌 일이 풀립니다.',
  '재물운이 따르니 헛된 지출을 삼가세요.',
  '건강을 살피며 무리하지 않는 것이 좋습니다.',
  '새로운 인연이 찾아올 수 있는 시기입니다.',
  '꾸준함이 결실을 맺는 달입니다.',
  '여행이나 이동에 좋은 기운이 따르는 달입니다.',
  '문서나 계약과 관련해 신중함이 필요합니다.',
  '가족과 함께하는 시간이 큰 힘이 되는 달입니다.',
  '배움과 공부에 집중하면 좋은 결실이 있습니다.'
];

// [LOG_ID: 20260719_2300] 순수 양력 계산만으로 가능한 60갑자(육십갑자) — 음력 변환이 필요한
// 월주(月柱)·일주(전통 사주 4주)까지는 포함하지 않고, 연주(年柱)와 일진(日辰)만 반영한다.
const CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// 그레고리력 날짜 → 율리우스적일수(JDN). 표준 공식(Fliegel & Van Flandern, 1968).
function toJulianDayNumber(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

// 연주(年柱) 인덱스(0~59). (year-4)%60=0을 갑자로 두는 공식 — 1984(갑자)·2020(경자)·2024(갑진)
// 세 해로 교차검증했다(각각 널리 알려진 간지년).
function getYearGanjiIndex(year) {
  return ((year - 4) % 60 + 60) % 60;
}

// 일진(日辰) 인덱스(0~59) — JDN 기반. 오프셋 49는 통용되는 만세력 계산식을 참고했으나,
// 이 환경에서 실제 만세력과 대조 검증은 못 했다. 아래 buildFortuneAnsi가 화면에 계산된
// 일진을 그대로 노출하니, 실제 만세력과 비교해 어긋나면 이 오프셋만 고치면 된다.
const DAY_GANJI_OFFSET = 49;
function getDayGanjiIndex(date) {
  const jdn = toJulianDayNumber(date);
  return ((jdn + DAY_GANJI_OFFSET) % 60 + 60) % 60;
}

function ganjiText(index) {
  return `${CHEONGAN[index % 10]}${JIJI[index % 12]}`;
}

export function createAmusementAnsiBuilders(deps) {
  const { ANSI_BOLD, ANSI_RESET, ansiColor, buildTopHeader, fitCell, wrapAnsiText } = createAnsiBuilderUtils(deps);
  const c = (tone, text) => `${ansiColor(tone)}${text}${ANSI_RESET}`;
  const dateText = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const rhythm = (days, period) => Number((Math.sin((Math.PI * 2 * days) / period) * 100).toFixed(2));
  
  const row = (name, value, isMobile = false) => {
    const limit = isMobile ? 33.3 : 20;
    const count = Math.round(Math.abs(value) / limit);
    const maxCount = isMobile ? 3 : 5;
    
    // [LOG: 20260714_1806] 빈 눈금 셀은 .ansi-fg-0(투명)이 적용된 '■' 기호로 대체하여 
    // 브라우저 텍스트 자간/렌더링 엔진 편차와 무관하게 100% 동일한 물리 픽셀 너비를 유지하도록 강제한다.
    const emptyColor = 0;
    const fillColor = value >= 0 ? 11 : 13;
    
    const fillStr = '■';
    const emptyStr = '■';
    
    let leftBar = '';
    let rightBar = '';
    
    if (value > 0) {
      leftBar = c(emptyColor, emptyStr.repeat(maxCount));
      rightBar = c(fillColor, fillStr.repeat(count)) + c(emptyColor, emptyStr.repeat(maxCount - count));
    } else if (value < 0) {
      leftBar = c(emptyColor, emptyStr.repeat(maxCount - count)) + c(fillColor, fillStr.repeat(count));
      rightBar = c(emptyColor, emptyStr.repeat(maxCount));
    } else {
      leftBar = c(emptyColor, emptyStr.repeat(maxCount));
      rightBar = c(emptyColor, emptyStr.repeat(maxCount));
    }
    
    // 기준선 '│'는 채우기 컬러와 동일하게 렌더링
    const bar = `${leftBar}${c(fillColor, '│')}${rightBar}`;
    
    const status = value >= 80 ? '최고조 ▲' : value <= -80 ? '최저조 ▼' : Math.abs(value) < 15 ? '전환기 ◇' : value > 0 ? '상승 △' : '하강 ▽';
    const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    
    return `  ${c(14, fitCell(name, isMobile ? 3 : 4))} ${bar} ${c(15, fitCell(formattedValue, 8))} ${c(8, status)}`;
  };

  function buildBiorhythmIntroAnsi() {
    return [
      buildTopHeader(['오락실', '바이오리듬']), 
      c(15, '  태어난 날부터의 주기로 오늘의 컨디션을 가늠해 봅니다.'), 
      c(8, '  신체 23일 · 감성 28일 · 지성 33일 · 지각 38일 주기'), 
      '', 
      c(14, '  생년월일을 입력하세요.'), 
      c(11, '  입력 예) 1990-01-01 또는 19900101')
    ].join('\n');
  }
  
  function buildBiorhythmAnsi(birth, target = new Date()) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const days = Math.round((target.getTime() - birth.getTime()) / 86400000);
    
    const scaleGuide = isMobile 
      ? c(8, '      -100% 0     +100%') 
      : c(8, '       -100%     0         +100%');
      
    const parts = [
      buildTopHeader(['오락실', '바이오리듬']), 
      c(11, `${ANSI_BOLD}  ${dateText(birth)} 생${ANSI_RESET}  ${ansiColor(8)}오늘로 ${days.toLocaleString()}일째${ANSI_RESET}`), 
      '', 
      scaleGuide,
      row('신체', rhythm(days, 23), isMobile), 
      row('감성', rhythm(days, 28), isMobile), 
      row('지성', rhythm(days, 33), isMobile), 
      row('지각', rhythm(days, 38), isMobile), 
      '', 
      c(14, '  ── 향후 7일 추이 ──')
    ];
    
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(target.getTime() + i * 86400000);
      const d = days + i;
      const phy = rhythm(d, 23);
      const emo = rhythm(d, 28);
      const int = rhythm(d, 33);
      const per = rhythm(d, 38);
      
      if (isMobile) {
        const formatVal = (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`;
        parts.push(c(i === 0 ? 15 : 8, `  ${dateText(date).slice(5)}  신:${formatVal(phy)} 감:${formatVal(emo)} 지:${formatVal(int)} 각:${formatVal(per)}`));
      } else {
        const formatVal = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
        parts.push(c(i === 0 ? 15 : 8, `  ${dateText(date).slice(5)}  신체: ${fitCell(formatVal(phy), 8)}  감성: ${fitCell(formatVal(emo), 8)}  지성: ${fitCell(formatVal(int), 8)}  지각: ${fitCell(formatVal(per), 8)}`));
      }
    }
    return parts.join('\n');
  }
  
  function buildFortuneIntroAnsi() {
    return [buildTopHeader(['오락실', '오늘의 운세']), c(15, '  태어난 해의 띠와 오늘의 일진을 풀어 운세를 봅니다.'), c(8, '  십이지의 삼합·육합·육충·육해 관계를 사용합니다.'), '', c(14, '  태어난 연도(4자리)를 입력하세요.'), c(11, '  입력 예) 1990')].join('\n');
  }
  function buildFortuneAnsi(year, target = new Date()) {
    const animal = ZODIAC[((year - 4) % 12 + 12) % 12];
    // [LOG_ID: 20260719_2300] 임의 해시 대신 오늘 날짜의 실제 일진(60갑자, JDN 기반 순수 계산)을
    // 시드로 쓴다 — 사용자 요청("오늘의 운세도 정확하게"). 같은 해에 태어난 사람은 오늘 하루는
    // 모두 같은 결과를 보되(실제 오늘의 일진이 같으므로), 태어난 해(띠)가 다르면 결과가 갈린다.
    const yearZodiacIdx = ((year - 4) % 12 + 12) % 12;
    const dayGanjiIdx = getDayGanjiIndex(target);
    const dayGanjiStr = ganjiText(dayGanjiIdx);
    // [LOG_ID: 20260719_2330] 버그 수정 — 60은 5의 배수라 "yearZodiacIdx * 60"은 %5 연산에서
    // 항상 0으로 사라져, 띠가 달라도 결과가 절대 안 바뀌는 결함이 있었다(사용자 실측 발견:
    // 1975년생/토끼띠로 확인해보니 다른 띠와 별표 개수·문구가 전부 동일했음). 5와 서로소인
    // 7을 곱해 띠 인덱스가 실제로 시드에 반영되도록 고쳤다.
    const seed = (yearZodiacIdx * 7 + dayGanjiIdx) % 5;
    const scores = ['총운', '애정운', '금전운', '건강운'].map((label, index) => 1 + ((seed + index * 2) % 5));
    const messages = ['새로운 시작보다 마무리에 집중하세요.', '서두르지 않으면 무난하게 흘러갑니다.', '작은 행운이 숨어 있는 하루입니다.', '결단을 내리기 좋은 날입니다.', '귀인의 도움으로 일이 풀립니다.'];
    const parts = [buildTopHeader(['오락실', '오늘의 운세']), c(11, `${ANSI_BOLD}  ${year}년생 ${animal}띠${ANSI_RESET}  ${ansiColor(8)}${dateText(target)} (오늘의 일진: ${dayGanjiStr}일)${ANSI_RESET}`), ''];
    ['총운', '애정운', '금전운', '건강운'].forEach((label, index) => parts.push(`  ${c(14, fitCell(label, 7))}${c(14, '★'.repeat(scores[index]))}${c(8, '☆'.repeat(5 - scores[index]))}  ${c(15, messages[scores[index] - 1])}`));
    return parts.join('\n');
  }
  function buildMbtiListAnsi() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const parts = [buildTopHeader(['오락실', 'MBTI']), c(15, '  성격유형을 선택하면 특징을 보여드립니다.')];
    wrapAnsiText('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.', targetCols - 2)
      .forEach((line) => parts.push(c(8, `  ${line}`)));
    parts.push('');
    MBTI_TYPES.forEach(([code, nick], index) => parts.push(`  ${c(14, `${String(index + 1).padStart(2, ' ')}.`)} ${c(11, fitCell(code, 5))}${c(15, nick)}`));
    return parts.join('\n');
  }
  function findMbtiType(input) {
    const value = String(input || '').trim().toUpperCase();
    const index = /^\d+$/.test(value) ? Number(value) - 1 : MBTI_TYPES.findIndex(([code]) => code === value);
    return MBTI_TYPES[index] ? { code: MBTI_TYPES[index][0], nick: MBTI_TYPES[index][1], desc: MBTI_TYPES[index][2] } : null;
  }
  function buildMbtiDetailAnsi(type) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    return [buildTopHeader(['오락실', `MBTI ${type.code}`]), c(11, `${ANSI_BOLD}  ${type.code}${ANSI_RESET}  ${ansiColor(14)}${type.nick}${ANSI_RESET}`), c(8, `  ${'─'.repeat(targetCols - 28)}`), ...wrapAnsiText(type.desc, targetCols - 10).map((line) => c(15, `  ${line}`)), '', c(8, '  다른 유형을 보려면 번호/코드를 입력하세요.')].join('\n');
  }
  function buildBloodIntroAnsi() {
    return [buildTopHeader(['오락실', '혈액형 성격진단']), c(15, '  혈액형으로 성격의 특성과 장단점을 알아봅니다.'), '', c(14, '  혈액형을 입력하세요.'), c(11, '  입력 예) A, B, O, AB')].join('\n');
  }
  function findBloodType(input) {
    const value = String(input || '').trim().toUpperCase();
    const found = BLOOD_TYPES.find(([code]) => code === value);
    return found ? { code: found[0], nick: found[1], desc: found[2] } : null;
  }
  function buildBloodAnsi(type) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    return [buildTopHeader(['오락실', `혈액형 ${type.code}형`]), c(11, `${ANSI_BOLD}  ${type.code}형${ANSI_RESET}  ${ansiColor(14)}${type.nick}${ANSI_RESET}`), c(8, `  ${'─'.repeat(targetCols - 28)}`), ...wrapAnsiText(type.desc, targetCols - 10).map((line) => c(15, `  ${line}`)), '', c(8, '  다른 혈액형을 보려면 A/B/O/AB를 입력하세요.')].join('\n');
  }

  function buildCompatIntroAnsi() {
    return [buildTopHeader(['오락실', '궁합']), c(15, '  두 사람의 생년월일로 궁합을 봅니다.'), '', c(14, '  첫 번째 사람의 생년월일을 입력하세요.'), c(11, '  입력 예) 1990-01-01 또는 19900101')].join('\n');
  }
  function buildCompatIntro2Ansi(birth1) {
    const animal1 = ZODIAC[((birth1.getFullYear() - 4) % 12 + 12) % 12];
    return [buildTopHeader(['오락실', '궁합']), c(11, `${ANSI_BOLD}  ${dateText(birth1)}생 ${animal1}띠${ANSI_RESET}`), '', c(14, '  두 번째 사람의 생년월일을 입력하세요.'), c(11, '  입력 예) 1995-05-05 또는 19950505')].join('\n');
  }
  function buildCompatAnsi(birth1, birth2) {
    const animal1 = ZODIAC[((birth1.getFullYear() - 4) % 12 + 12) % 12];
    const animal2 = ZODIAC[((birth2.getFullYear() - 4) % 12 + 12) % 12];
    const seed = Math.abs(Math.round((birth1.getTime() - birth2.getTime()) / 86400000)) % 41;
    const score = 60 + seed;
    const message = COMPAT_MESSAGES[seed % COMPAT_MESSAGES.length];
    const parts = [
      buildTopHeader(['오락실', '궁합']),
      c(11, `${ANSI_BOLD}  ${dateText(birth1)}생 ${animal1}띠${ANSI_RESET}  ${ansiColor(15)}×${ANSI_RESET}  ${ansiColor(11)}${ANSI_BOLD}${dateText(birth2)}생 ${animal2}띠${ANSI_RESET}`),
      '',
      `  ${c(14, '궁합 점수')} ${c(9, ANSI_BOLD + String(score) + '점' + ANSI_RESET)}  ${c(11, '★'.repeat(Math.round(score / 20)))}${c(8, '☆'.repeat(5 - Math.round(score / 20)))}`,
      '',
      c(15, `  ${message}`)
    ];
    return parts.join('\n');
  }

  function buildTojeongIntroAnsi() {
    return [buildTopHeader(['오락실', '토정비결']), c(15, '  생년월일로 올해 열두 달의 운세를 풀어봅니다.'), '', c(14, '  생년월일을 입력하세요.'), c(11, '  입력 예) 1990-01-01 또는 19900101')].join('\n');
  }
  function buildTojeongAnsi(birth, target = new Date()) {
    const animal = ZODIAC[((birth.getFullYear() - 4) % 12 + 12) % 12];
    const year = target.getFullYear();
    // [LOG_ID: 20260719_2300] 임의 해시 대신 태어난 해와 보는 해의 실제 연주(年柱, 60갑자)를
    // 시드로 쓴다 — 사용자 요청("토정비결도 정확하게"). TOJEONG_MESSAGES가 정확히 12개라
    // (personYearSeed + month - 1) % 12는 1~12월에 서로 다른 문구를 하나씩 배정하는 전단사라,
    // 같은 사람·같은 해 안에서는 두 달이 같은 문구를 받는 일이 없다(이전엔 8개 문구로 4개월이 겹쳤다).
    const birthGanjiIdx = getYearGanjiIndex(birth.getFullYear());
    const targetGanjiIdx = getYearGanjiIndex(year);
    const targetGanjiStr = ganjiText(targetGanjiIdx);
    const personYearSeed = (birthGanjiIdx + targetGanjiIdx) % TOJEONG_MESSAGES.length;
    const parts = [buildTopHeader(['오락실', '토정비결']), c(11, `${ANSI_BOLD}  ${dateText(birth)}생 ${animal}띠${ANSI_RESET}  ${ansiColor(8)}${year}년(${targetGanjiStr}년) 신수${ANSI_RESET}`), ''];
    for (let month = 1; month <= 12; month += 1) {
      const seed = (personYearSeed + month - 1) % TOJEONG_MESSAGES.length;
      parts.push(`  ${c(14, fitCell(`${String(month).padStart(2, ' ')}월`, 4))}${c(15, TOJEONG_MESSAGES[seed])}`);
    }
    return parts.join('\n');
  }

  function buildRetroArtListAnsi() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const nameWidth = isMobile ? 14 : 24;
    const descWidth = isMobile ? 0 : 44;
    const rows = DOOR_ART.map((item, index) => {
      const nameCell = `  ${c(14, `${index + 1}.`)} ${c(15, fitCell(item.name, nameWidth))}`;
      return descWidth > 0 ? `${nameCell} ${c(8, fitCell(item.desc, descWidth))}` : nameCell;
    });
    const introLines = wrapAnsiText('90년대 PC통신·도스 시절 접속 화면을 원본 그대로 보여드립니다.', targetCols - 2)
      .map((line) => c(15, `  ${line}`));
    const subLines = wrapAnsiText(`(하늘소·나우누리 원본 수록분, ${DOOR_ART.length}종)`, targetCols - 2)
      .map((line) => c(8, `  ${line}`));
    return [buildTopHeader(['오락실', '추억의 접속화면']), ...introLines, ...subLines, '', ...rows, '', c(11, '  번호를 입력하세요.')].join('\n');
  }
  function buildRetroArtViewAnsi(item) {
    return [buildTopHeader({ leftLabel: 'GAME', centerLabel: item.name }), item.art].join('\n');
  }
  return { buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, findMbtiType, buildBloodIntroAnsi, buildBloodAnsi, findBloodType, buildCompatIntroAnsi, buildCompatIntro2Ansi, buildCompatAnsi, buildTojeongIntroAnsi, buildTojeongAnsi, buildRetroArtListAnsi, buildRetroArtViewAnsi };
}
