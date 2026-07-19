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
const ZODIAC_HANJA = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// [LOG_ID: 20260718_2355] "오늘의 운세" 안내 문구가 "십이지의 삼합·육합·육충·육해 관계를 사용합니다"라고
// 적어놓고도 실제로는 (생년+오늘 날짜) 해시값 하나로 점수를 뽑는 가짜 로직이었다(사용자 지적:
// "오늘의 운세 정확해?"). 실제 십이지 관계표를 만들어 안내 문구와 동작을 일치시킨다.
// 인덱스는 ZODIAC 배열과 동일(0=쥐~11=돼지).
const SAMHAP_GROUPS = [[8, 0, 4], [5, 9, 1], [2, 6, 10], [11, 3, 7]]; // 신자진·사유축·인오술·해묘미
const YUKHAP_PAIRS = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; // 자축·인해·묘술·진유·사신·오미
const YUKCHUNG_PAIRS = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]; // 자오·축미·인신·묘유·진술·사해
const YUKHAE_PAIRS = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]; // 자미·축오·인사·묘진·신해·유술

// 그레고리력 날짜 → 율리우스일(JDN). Fliegel & Van Flandern 공식(0시 기준, 소수부 없음).
function toJulianDayNumber(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

// 오늘의 일진(지지)만 필요하므로 60갑자 전체가 아니라 12지지 순환만 구한다.
// [LOG_ID: 20260718_2355] 오프셋(+1) 검증: 2026-07-18은 실제 만세력 기준 "계사(癸巳)일"(지지=사=뱀)로
// 여러 출처(fateengineering.site, 중부일보 2026-07-18자 오늘의 운세 기사)에 공통 기재되어 있다.
// JDN(2026-07-18)=2461240 → (2461240+1)%12=5=뱀(사) — 정확히 일치, 이 오프셋이 맞다.
function getDayBranchIndex(date) {
  const jdn = toJulianDayNumber(date);
  return ((jdn + 1) % 12 + 12) % 12;
}

function findPair(pairs, a, b) {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function getZodiacRelation(yearBranchIndex, dayBranchIndex) {
  if (yearBranchIndex === dayBranchIndex) return '비화';
  if (SAMHAP_GROUPS.some((group) => group.includes(yearBranchIndex) && group.includes(dayBranchIndex))) return '삼합';
  if (findPair(YUKHAP_PAIRS, yearBranchIndex, dayBranchIndex)) return '육합';
  if (findPair(YUKCHUNG_PAIRS, yearBranchIndex, dayBranchIndex)) return '육충';
  if (findPair(YUKHAE_PAIRS, yearBranchIndex, dayBranchIndex)) return '육해';
  return '평운';
}

const ZODIAC_RELATION_INFO = {
  삼합: { score: 5, summary: '삼합(대길) — 귀인의 도움으로 만사가 순조롭게 풀리는 길일입니다.' },
  육합: { score: 4, summary: '육합(길) — 협력과 화합이 잘 되어 무난히 좋은 하루입니다.' },
  평운: { score: 3, summary: '평운 — 특별한 충돌 없이 무난하게 흘러가는 하루입니다.' },
  비화: { score: 3, summary: '비화 — 오늘은 본래 성향이 그대로 드러나는 평이한 날입니다.' },
  육충: { score: 2, summary: '육충(주의) — 다툼과 조급함을 조심해야 하는 날입니다.' },
  육해: { score: 1, summary: '육해(흉) — 구설수와 오해에 휘말리지 않도록 조심하세요.' }
};

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
    const yearBranchIndex = ((year - 4) % 12 + 12) % 12;
    const animal = ZODIAC[yearBranchIndex];
    // [LOG_ID: 20260718_2355] 띠(연지)와 오늘의 일진(일지) 사이의 실제 십이지 관계(삼합·육합·
    // 육충·육해·비화·평운)로 운세 등급을 정한다 — 예전엔 안내 문구만 이렇게 써놓고 실제로는
    // (생년+오늘 날짜) 해시 하나로 점수를 뽑는 가짜 로직이었다(사용자 지적: "오늘의 운세 정확해?").
    const dayBranchIndex = getDayBranchIndex(target);
    const relation = getZodiacRelation(yearBranchIndex, dayBranchIndex);
    const { score: baseScore, summary } = ZODIAC_RELATION_INFO[relation];
    const seed = year * 31 + target.getFullYear() * 13 + target.getMonth() + target.getDate();
    const messages = ['새로운 시작보다 마무리에 집중하세요.', '서두르지 않으면 무난하게 흘러갑니다.', '작은 행운이 숨어 있는 하루입니다.', '결단을 내리기 좋은 날입니다.', '귀인의 도움으로 일이 풀립니다.'];
    // 총운/애정운/금전운/건강운은 관계로 정해진 기본 점수를 중심으로 날짜별 편차(-1~+1)만 준다 —
    // 네 항목이 서로 무관한 값이 아니라 오늘의 실제 관계를 중심으로 갈리도록.
    const scores = ['총운', '애정운', '금전운', '건강운'].map((label, index) => {
      const variation = ((seed + index * 7) % 3) - 1;
      return Math.min(5, Math.max(1, baseScore + variation));
    });
    const parts = [
      buildTopHeader(['오락실', '오늘의 운세']),
      c(11, `${ANSI_BOLD}  ${year}년생 ${animal}띠${ANSI_RESET}  ${ansiColor(8)}${dateText(target)}${ANSI_RESET}`),
      c(14, `  오늘의 일진: ${ZODIAC[dayBranchIndex]}(${ZODIAC_HANJA[dayBranchIndex]})날 — ${animal}띠와 ${relation}`),
      c(15, `  ${summary}`),
      ''
    ];
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
  return { buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, findMbtiType, buildRetroArtListAnsi, buildRetroArtViewAnsi };
}
