import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { DOOR_ART } from './doorArtAssets.js';

// [LOG_ID: 20260714_1749] Improved Biorhythm UI with Perception rhythm, clean vertical alignment, scale guide, and responsive layouts.
// [LOG_ID: 20260623_1300] Restored GAME builders for biorhythm, fortune, and MBTI.
const MBTI_TYPES = [
  [
    'ISTJ',
    '청렴결백한 논리주의자',
    '사실과 규범에 충실하며 강한 책임감으로 업무를 신뢰성 있게 완수합니다.',
    '철저한 준비성, 높은 집중력, 현실적 문제 해결 능력과 약속 준수',
    '변화나 예외 상황에 보수적일 수 있고 감정 표현이 다소 서툽니다.',
    '회계사, 행정가, 감정평가사, 엔지니어, 공무원'
  ],
  [
    'ISFJ',
    '용감한 수호자',
    '주변 사람들을 묵묵히 챙기고 다정하며 헌신적인 사랑을 실천합니다.',
    '세심한 배려심, 뛰어난 기억력, 안정감을 주는 포근한 인품',
    '남의 부탁을 잘 거절하지 못해 스스로 피로를 쌓기 쉽습니다.',
    '간호사, 교사, 사회복지사, 인사 담당자, 고객 지원'
  ],
  [
    'INFJ',
    '선의의 옹호자',
    '깊은 통찰력과 강한 신념으로 더 따뜻한 세상을 꿈꾸는 이상주의자입니다.',
    '사람의 본질을 파악하는 직관, 헌신적 행동력, 경청과 조언',
    '완벽주의로 스스로 지치거나 속마음을 쉽게 털어놓지 않습니다.',
    '심리상담사, 작가, 인문학 연구원, 멘토, 기획자'
  ],
  [
    'INTJ',
    '용의주도한 전략가',
    '철저한 비전과 독창적 아이디어로 목표를 달성하는 지적 전략가입니다.',
    '장기적 비전 설계, 높은 독립성, 논리적 판단과 효율성 추구',
    '타인의 감정에 무심해 보일 수 있고 타협을 원치 않을 때가 있습니다.',
    '데이터 분석가, 시스템 아키텍트, 경영 전략가, 연구원'
  ],
  [
    'ISTP',
    '만능 재주꾼',
    '상황 파악이 빠르고 도구나 시스템 조작에 뛰어난 실용적 해결사입니다.',
    '위기 대처 능력, 침착함, 효율적인 객관적 문제 분석',
    '장기 계획보다 즉흥적이며 감정적인 대화에 서툽니다.',
    '엔지니어, 파일럿, 데이터 테스터, 정비사, 응급구조사'
  ],
  [
    'ISFP',
    '호기심 많은 예술가',
    '온화한 성품과 미적 감각으로 현재의 순수한 가치를 즐기는 감성파입니다.',
    '풍부한 예술적 감수성, 겸손함, 타인의 자율성 존중',
    '충돌을 피해 유보하거나 미래 기획에 결단력이 다소 부족합니다.',
    '디자이너, 화가, 음악가, 수의사, 플로리스트'
  ],
  [
    'INFP',
    '열정적인 중재자',
    '깊은 내면의 신념과 무한한 가능성을 바탕으로 세상을 바라봅니다.',
    '공감 능력, 독창적 창의성, 진정성 있는 인격과 포용력',
    '현실적인 업무 처리에 스트레스를 받고 자기 비판에 빠지기 쉽습니다.',
    '작가, 번역가, 상담가, 컨텐츠 기획자, 예술가'
  ],
  [
    'INTP',
    '논리적인 사색가',
    '지적 호기심이 왕성하며 원리와 이론 탐구에 깊이 몰두합니다.',
    '창의적 원리 분석, 편견 없는 탐구심, 복잡한 문제 해독',
    '사소한 일상 처리를 귀찮아하거나 자기 생각 속에 갇힐 수 있습니다.',
    '프로그래머, 수학자, 철학자, 연구원, 물리학자'
  ],
  [
    'ESTP',
    '모험을 즐기는 사업가',
    '관찰력이 예리하고 문제 발생 시 현장에서 바로 행동하는 수완가입니다.',
    '빠른 상황 판단, 뛰어난 친화력, 순발력과 정면 돌파력',
    '인내심이 부족해 규칙이나 이론 수업을 지루해합니다.',
    '마케터, 영업 전문가, 스포츠 감독, 자산관리사'
  ],
  [
    'ESFP',
    '자유로운 영혼의 연예인',
    '주위 사람들에게 즐거움과 에너지를 불어넣는 다정한 분위기 메이커입니다.',
    '넘치는 사교성, 미적 감각, 긍정적인 삶의 태도',
    '장기적인 대책 없이 유흥이나 즉흥적 지출에 빠질 수 있습니다.',
    '이벤트 기획자, 배우, 여행 가이드, 뷰티 디렉터'
  ],
  [
    'ENFP',
    '재기발랄한 활동가',
    '창의적 상상력과 활기찬 에너지로 사람들과 유대를 맺는 자유인입니다.',
    '열정적인 의사소통, 새로운 아이디어 창출, 높은 공감대 형성',
    '마무리가 약하거나 쉽게 흥미를 잃어 열정이 이동하기 쉽습니다.',
    '카피라이터, 크리에이터, 홍보 전문가, 강사'
  ],
  [
    'ENTP',
    '뜨거운 논쟁을 즐기는 변론가',
    '두뇌 회전이 빠르고 정형화된 틀을 깨뜨리는 발명가형 논객입니다.',
    '다방면의 지식 활용, 거침없는 기획력, 지적 변론 능력',
    '일상적 루틴을 지루해하며 타인의 기분을 건드릴 때가 있습니다.',
    '벤처 창업가, 변호사, 컨설턴트, 정치인, 기획자'
  ],
  [
    'ESTJ',
    '엄격한 관리자',
    '체계적인 질서와 현실적 가치를 바탕으로 조직을 추진력 있게 이끕니다.',
    '우수한 조직 관리, 과감한 결정력, 높은 책임감과 실행력',
    '융통성이 부족해 보일 수 있고 남의 감정을 단정 짓기 쉽습니다.',
    '경영자, 프로젝트 매니저, 경찰, 군인, 총무'
  ],
  [
    'ESFJ',
    '사교적인 외교관',
    '동료와 조화를 이루며 따뜻한 관심으로 주위를 돌보는 외교관입니다.',
    '훌륭한 협동심, 세심한 서비스 정신, 조화로운 분위기 조성',
    '비판에 취약하며 남의 인정에 지나치게 연연할 수 있습니다.',
    '승무원, 호텔리어, 초등교사, HR 매니저, 이벤트 MC'
  ],
  [
    'ENFJ',
    '정의로운 사회운동가',
    '타인의 성장을 돕고 선한 영향력으로 집단을 이끄는 리더입니다.',
    '강력한 리더십, 타인에 대한 동기부여, 뛰어난 언변과 포용',
    '타인의 문제를 자기 일처럼 안고 괴로워하기 쉽습니다.',
    '교육자, 연설가, 비영리단체 이사, 인사 컨설턴트'
  ],
  [
    'ENTJ',
    '대담한 통솔자',
    '원대한 비전과 단호한 결단력으로 목표를 정복하는 타고난 지도자입니다.',
    '전략적 리더십, 논리적 비판 및 구조화 능률, 도전 정신',
    '타인의 성과에 가혹할 수 있고 지배하려는 경향이 있습니다.',
    'CEO, 경영 컨설턴트, 투자전문가, 대형 사업가'
  ]
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
const COMPAT_DETAILS = [
  [
    '천생연분의 보완 궁합',
    '서로의 부족한 부분을 완벽히 채워주어 함께 있을 때 마음에 커다란 안정이 찾아오는 이상적인 관계입니다.',
    '서로를 향한 은은하고 깊은 신뢰감이 형성되어 특별히 노력하지 않아도 편안함과 강한 인연의 기운이 이어집니다.',
    '너무 익숙해진 나머지 서로의 배려를 당연하게 여길 수 있으니 감사함을 수시로 표현해야 합니다.',
    '주말이나 여유로운 날에 함께 조용한 카페를 방문하거나 산책을 하며 깊은 대화를 나누어 보세요.'
  ],
  [
    '열정 넘치는 시너지 궁합',
    '서로의 독창적인 생각을 인지하고 응원하며 함께 있으면 의욕과 긍정적 에너지가 솟구치는 관계입니다.',
    '서로의 도전 의식을 자극하고 함께 목표를 세워 달성할 때 폭발적인 시너지와 큰 기쁨을 누릴 수 있습니다.',
    '성격이 급해질 경우 결정 시점에서 마찰이 생길 수 있으므로 한 발짝 양보하는 여유가 필요합니다.',
    '새로운 취미 활동이나 여행, 혹은 공동 프로젝트를 함께 시작해 보면 관계가 더욱 돈독해집니다.'
  ],
  [
    '서로에게 물드는 편안한 궁합',
    '가치관과 기호가 매우 유사하여 별도의 적응 기간 없이 처음부터 오랫동안 알고 지낸 친구처럼 편안함을 느낍니다.',
    '말하지 않아도 서로의 기분과 의도를 쉽게 파악할 수 있는 이심전심의 정서적 유대감이 단단합니다.',
    '관계가 지나치게 평탄하여 다소 자극이나 흥미가 떨어질 수 있으니 소소한 이벤트가 도움을 줍니다.',
    '가끔은 서로의 예상 범위를 벗어나는 깜짝 선물이나 새로운 맛집 탐방으로 신선함을 더해 보세요.'
  ],
  [
    '반전 매력의 자극적인 궁합',
    '서로 완전히 다른 가치관과 매력을 가지고 있어 마법처럼 강한 호기심과 호감을 느끼는 인연입니다.',
    '상대방을 통해 내가 알지 못했던 새로운 세상을 접하게 되며 강렬한 인상과 신선한 자극을 받습니다.',
    '생각의 차이로 인해 조그만 오해가 큰 다툼으로 번질 수 있으므로 서로의 다름을 적극 인정해야 합니다.',
    '상대방의 개인적인 취향이나 주관을 비판하지 말고 있는 그대로 수용해 주는 공감 태도가 필수적입니다.'
  ],
  [
    '은은하게 깊어지는 대기만성 궁합',
    '첫눈에 불꽃이 튀기보다는 시간을 두고 천천히 알아갈수록 보석처럼 가치가 빛나는 은은한 인연입니다.',
    '시간이 흘러 신뢰가 굳건해질수록 어떠한 시련에도 흔들리지 않는 굳건한 정신적 동반자가 됩니다.',
    '초반에 서두르거나 조급하게 성격 차이를 극복하려 들면 서로 부담을 느낄 수 있습니다.',
    '서로의 속도에 맞추어 천천히 마음을 열 수 있도록 충분한 시간을 주고 기다려 주는 것이 가장 좋습니다.'
  ],
  [
    '티격태격 정이 깊어지는 궁합',
    '솔직 담백한 유머와 소소한 밀당 속에서 깊은 정과 미운 정이 두텁게 쌓이는 매력적인 관계입니다.',
    '서로에게 장난을 치면서도 결정적인 순간에는 누구보다 서로의 편이 되어주는 든든한 의리가 존재합니다.',
    '감정이 고조되었을 때 뱉는 직설적인 말이 상처가 될 수 있으니 화가 날 때 말을 조심해야 합니다.',
    '서로의 자존심을 긁는 발언을 피하고 다툰 직후에는 맛있는 음식이나 가벼운 유머로 즉시 풀어주세요.'
  ],
  [
    '서로를 이끄는 성장의 궁합',
    '서로의 성장을 돕고 조언을 주고받으며 보다 나은 사람으로 발전하도록 돕는 멘토 같은 관계입니다.',
    '상대방의 뛰어난 장점을 닮고 싶어지며 함께함으로써 삶의 지평이 넓어지는 건설적인 결합입니다.',
    '상대방을 가르치려 들거나 지적하려는 태도는 반발을 살 수 있으므로 따뜻한 격려가 우선입니다.',
    '서로의 성취를 마음껏 칭찬해 주고 힘든 일이 있을 때 무조건적인 편이 되어주는 지지자가 되어주세요.'
  ],
  [
    '마음이 통하는 이심전심 궁합',
    '눈빛만 봐도 서로의 의도를 읽어내는 높은 정서적 교감과 깊은 공감대를 자랑하는 인연입니다.',
    '서로의 슬픔과 기쁨을 내 일처럼 느끼며 영혼이 통하는 듯한 깊은 위안과 안식처가 되어줍니다.',
    '상대방이 내 마음을 알아서 다 알 것이라 지레짐작하여 필요한 표현을 생략하는 것은 금물입니다.',
    '아무리 가까운 사이라도 고마움과 미안함, 사랑의 표현을 아끼지 말고 정기적으로 전해 보세요.'
  ]
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
  
  // [LOG_ID: 20260723_0948] 기본 BBS 헤더 골격 복원 및 천리안 270p 책 흐름 일치 생년월일 입력 질의 위치 조정
  const row = (name, value, isMobile = false) => {
    const limit = isMobile ? 33.3 : 20;
    const count = Math.round(Math.abs(value) / limit);
    const maxCount = isMobile ? 3 : 5;

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

    const bar = `${leftBar}${c(fillColor, '│')}${rightBar}`;
    const status = value >= 80 ? '최고조 ▲' : value <= -80 ? '최저조 ▼' : Math.abs(value) < 15 ? '전환기 ◇' : value > 0 ? '상승 △' : '하강 ▽';
    const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

    return `  ${c(14, fitCell(name, isMobile ? 3 : 4))} ${bar} ${c(15, fitCell(formattedValue, 8))} ${c(8, status)}`;
  };

  function getBiorhythmSummary(phy, emo, int, per) {
    const avg = (phy + emo + int + per) / 4;
    const criticalCount = [phy, emo, int, per].filter((v) => Math.abs(v) < 15).length;

    if (criticalCount >= 2) {
      return '주요 리듬이 교차하는 위험/전환기입니다. 중요한 판단이나 돌발 행동에 유의하세요.';
    }
    if (avg >= 50) {
      return '신체와 정신의 컨디션이 전반적으로 우수합니다. 과감한 도전과 활동에 좋은 날입니다.';
    }
    if (avg <= -40) {
      return '에너지 소모가 큰 시기입니다. 무리한 충돌이나 무리한 일정을 피하고 휴식을 취하세요.';
    }
    if (phy >= 70 && emo >= 70) {
      return '체력과 기분이 매우 좋습니다. 대인관계 및 야외 활동에서 활약을 기대할 수 있습니다.';
    }
    if (int >= 70) {
      return '지적 판단력과 집중력이 뛰어난 날입니다. 학습, 연구, 계획 수립에 최적입니다.';
    }
    return '안정적인 컨디션을 유지하고 있습니다. 평소의 페이스대로 차분히 하루를 보내세요.';
  }

  // [LOG_ID: 20260723_1027] 순수 ANSI 본문 렌더링 (쌩 HTML 태그 노출 100% 완전 제거)
  function buildBiorhythmIntroAnsi() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const header = buildTopHeader(['오락실', '생체 리듬 서비스']);

    if (isMobile) {
      return [
        header,
        c(15, '+---------------------------------------+'),
        c(15, '|  [ 생체 리듬 서비스 (BIORYTHM) ]      |'),
        c(15, '|  자신의 생년월일을 입력하시면 신체,  |'),
        c(15, '|  감성, 지성 4대 파형 차트를 봅니다.  |'),
        c(15, '+---------------------------------------+'),
        '',
        c(14, '■ 신체 리듬 (P - Physical, 23일)'),
        c(14, '■ 감성 리듬 (E - Emotional, 28일)'),
        c(14, '■ 지성 리듬 (I - Intellect, 33일)'),
        ''
      ].join('\n');
    }

    return [
      header,
      c(15, '+------------------------------------------------------------+'),
      c(15, '|  [ 생체 리듬 서비스 (BIORYTHM) ]                           |'),
      c(15, '|  태어난 날부터의 주기로 컨디션을 파악하는 서비스입니다.    |'),
      c(15, '|  신체, 감성, 지성 4대 파형 차트를 2D로 렌더링합니다.       |'),
      c(15, '+------------------------------------------------------------+'),
      '',
      c(14, '■ 신체 리듬 (P - Physical, 23일) : 체력, 피로도, 인내심'),
      c(14, '■ 감성 리듬 (E - Emotional, 28일): 기분, 감수성, 정신안정'),
      c(14, '■ 지성 리듬 (I - Intellect, 33일) : 사고력, 집중력, 판단력'),
      ''
    ].join('\n');
  }

  function buildBiorhythmAnsi(birth, target = new Date(), userName = '사용자') {
    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const birthFormatted = `${birth.getFullYear()}/${String(birth.getMonth() + 1).padStart(2, '0')}/${String(birth.getDate()).padStart(2, '0')}`;
    const getDaysForDate = (dObj) => Math.round((dObj.getTime() - birth.getTime()) / 86400000);

    const parts = [
      buildTopHeader(['오락실', '생체 리듬 서비스']),
      c(15, `  생 일 : ${birthFormatted}(양)   <${year}년 ${month}월>   ${userName}님의 신체리듬`),
      ''
    ];

    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    let dayOfWeekLine = '     ';
    for (let day = 1; day <= daysInMonth; day++) {
      const dObj = new Date(year, month - 1, day);
      // 한글 요일(2칸) + 반각 공백 1칸 = 총 3칸
      dayOfWeekLine += daysOfWeek[dObj.getDay()] + ' ';
    }
    parts.push(c(11, dayOfWeekLine));

    for (let yLevel = 5; yLevel >= -5; yLevel--) {
      let line = '';
      const label = yLevel >= 0 ? ` ${yLevel} : ` : `${yLevel} : `;

      if (yLevel === 0) {
        let zeroLine = ' 0-';
        for (let day = 1; day <= daysInMonth; day++) {
          const dObj = new Date(year, month - 1, day);
          const elapsed = getDaysForDate(dObj);
          const pVal = Math.round(rhythm(elapsed, 23) / 100 * 5);
          const eVal = Math.round(rhythm(elapsed, 28) / 100 * 5);
          const iVal = Math.round(rhythm(elapsed, 33) / 100 * 5);

          const matches = [];
          if (pVal === 0) matches.push('P');
          if (eVal === 0) matches.push('E');
          if (iVal === 0) matches.push('I');

          let char = '-';
          if (matches.length > 1) char = '*';
          else if (matches.length === 1) char = matches[0];

          // 문자 1칸 + 대시 2칸 = 총 3칸
          zeroLine += char + '--';
        }
        parts.push(c(15, zeroLine));
        continue;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dObj = new Date(year, month - 1, day);
        const elapsed = getDaysForDate(dObj);
        const pVal = Math.round(rhythm(elapsed, 23) / 100 * 5);
        const eVal = Math.round(rhythm(elapsed, 28) / 100 * 5);
        const iVal = Math.round(rhythm(elapsed, 33) / 100 * 5);

        const matches = [];
        if (pVal === yLevel) matches.push('P');
        if (eVal === yLevel) matches.push('E');
        if (iVal === yLevel) matches.push('I');

        let char = ' ';
        if (matches.length > 1) {
          char = '*';
        } else if (matches.length === 1) {
          char = matches[0];
        } else {
          char = (day % 7 === 1) ? ':' : ' ';
        }
        // 문자 1칸 + 반각 공백 2칸 = 총 3칸
        line += char + '  ';
      }

      parts.push(c(14, label + line));
    }

    let dateNumberLine = '     ';
    for (let day = 1; day <= daysInMonth; day++) {
      if (day % 2 === 1) {
        // 날짜 2자리 + 반각 공백 1칸 = 총 3칸
        dateNumberLine += String(day).padStart(2, ' ') + ' ';
      } else {
        // 짝수 날짜는 공백 3칸 = 총 3칸
        dateNumberLine += '   ';
      }
    }
    parts.push(c(11, dateNumberLine));
    parts.push('');
    parts.push(c(8, '  [범례] P:신체(23일)  E:감성(28일)  I:지성(33일)  *:중첩'));

    return parts.join('\n');
  }
  
  function buildFortuneIntroAnsi() {
    return [buildTopHeader(['오락실', '오늘의 운세']), c(15, '  태어난 해의 띠와 오늘의 일진을 풀어 운세를 봅니다.'), c(8, '  십이지의 삼합·육합·육충·육해 관계를 사용합니다.'), '', c(14, '  태어난 연도(4자리)를 입력하세요.'), c(11, '  입력 예) 1990')].join('\n');
  }
  function buildFortuneAnsi(year, target = new Date()) {
    const animal = ZODIAC[((year - 4) % 12 + 12) % 12];
    // [LOG_ID: 20260723_1116] 태어난 해(띠) + 오늘 일진(60갑자) 기반의 정밀 운세 알고리즘
    const yearZodiacIdx = ((year - 4) % 12 + 12) % 12;
    const dayGanjiIdx = getDayGanjiIndex(target);
    const dayGanjiStr = ganjiText(dayGanjiIdx);

    // 항목별 고유 소수 가중치를 적용하여 각 운세별 점수가 더욱 다채롭게 분산되도록 함 (1~5점)
    const itemMultipliers = [7, 13, 19, 23];
    const scores = itemMultipliers.map((mult) => 1 + ((yearZodiacIdx * mult + dayGanjiIdx * 3 + mult) % 5));

    // 풍부한 15종 운세 문구 풀 (점수대별 맞춤 문구 제공)
    const messagePool = [
      // 1~2점 (주의/신중)
      [
        '서두르지 말고 충전을 취하는 것이 유리합니다.',
        '무리한 확장보다는 내실을 다질 때입니다.',
        '작은 언행도 신중하게 가다듬으세요.'
      ],
      // 3점 (무난/보통)
      [
        '새로운 시작보다 마무리에 집중하세요.',
        '평소대로 솔직하고 담담하게 임하면 무난합니다.',
        '지인과의 대화 속에 소소한 힌트가 있습니다.'
      ],
      // 4점 (길운/상승)
      [
        '작은 행운이 숨어 있어 기분이 밝아집니다.',
        '그동안의 노력이 결실을 맺기 시작합니다.',
        '소신껏 행동하면 좋은 결과가 따라옵니다.'
      ],
      // 5점 (대길/최상)
      [
        '귀인의 도움으로 꼬였던 일이 시원하게 풀립니다.',
        '행운의 바람이 불어오니 결단을 내리기 좋습니다.',
        '뜻밖의 기쁨과 함께 능력을 발휘할 날입니다.'
      ]
    ];

    const getMessage = (score, itemIdx) => {
      let poolIdx = score <= 2 ? 0 : score === 3 ? 1 : score === 4 ? 2 : 3;
      const subIdx = (yearZodiacIdx + dayGanjiIdx + itemIdx) % messagePool[poolIdx].length;
      return messagePool[poolIdx][subIdx];
    };

    const parts = [
      buildTopHeader(['오락실', '오늘의 운세']),
      c(11, `${ANSI_BOLD}  ${year}년생 ${animal}띠${ANSI_RESET}  ${ansiColor(8)}${dateText(target)} (오늘의 일진: ${dayGanjiStr}일)${ANSI_RESET}`),
      ''
    ];

    // 별표 표시: 채운 별(★)과 빈 공간(ㆍ전각점) 모두 전각 2셀+공백 1셀(=3셀)로 폭을 100% 동일 고정
    // 픽셀 폰트에서도 채워진 별(★)과 빈 자리(ㆍ)가 확실하게 시각적 차이를 보이도록 전각점 사용
    ['총운', '애정운', '금전운', '건강운'].forEach((label, index) => {
      const score = scores[index];
      let starStr = '';
      for (let i = 0; i < 5; i++) {
        if (i < score) {
          starStr += c(11, ANSI_BOLD + '★ ' + ANSI_RESET);
        } else {
          starStr += c(8, 'ㆍ ');
        }
      }
      const msg = getMessage(score, index);
      parts.push(`  ${c(14, fitCell(label, 7))}${starStr}  ${c(15, msg)}`);
    });

    return parts.join('\n');
  }
const MBTI_QUESTIONS = [
  {
    dim: 'EI',
    opt1Key: 'E', opt2Key: 'I',
    title: '사람들과 어울릴 때 나의 에너지는?',
    opt1: '새로운 사람들을 만나 이야기하며 에너지를 얻는다.',
    opt2: '혼자만의 시간에 조용히 쉬면서 에너지를 충전한다.'
  },
  {
    dim: 'EI',
    opt1Key: 'E', opt2Key: 'I',
    title: '생각을 정리하고 표현하는 방식은?',
    opt1: '대화를 나누면서 생각을 구체화하고 말로 먼저 표현한다.',
    opt2: '속으로 생각을 충분히 정립한 뒤에 말로 전달한다.'
  },
  {
    dim: 'EI',
    opt1Key: 'E', opt2Key: 'I',
    title: '대인관계의 스타일은?',
    opt1: '넓고 다양한 사람들과 두루두루 친하게 지낸다.',
    opt2: '소수의 사람들과 깊고 진솔하게 교류한다.'
  },
  {
    dim: 'SN',
    opt1Key: 'S', opt2Key: 'N',
    title: '정보를 이해하고 받아들일 때?',
    opt1: '눈으로 확인 가능한 구체적인 사실과 경험적 데이터를 중시한다.',
    opt2: '숨겨진 의미, 전체적 흐름, 그리고 미래의 가능성을 중시한다.'
  },
  {
    dim: 'SN',
    opt1Key: 'S', opt2Key: 'N',
    title: '일을 처리할 때 선호하는 접근법은?',
    opt1: '이미 검증된 확실한 순서와 매뉴얼을 따른다.',
    opt2: '새로운 아이디어와 독창적인 방식을 시도한다.'
  },
  {
    dim: 'SN',
    opt1Key: 'S', opt2Key: 'N',
    title: '대화나 설명을 들을 때?',
    opt1: '명확하고 직관적인 사실 위주의 설명을 선호한다.',
    opt2: '상상력을 자극하는 은유와 비유적 표현을 선호한다.'
  },
  {
    dim: 'TF',
    opt1Key: 'T', opt2Key: 'F',
    title: '중요한 판단을 내릴 때 최우선 기준은?',
    opt1: '객관적 논리, 원칙, 그리고 원인 분석',
    opt2: '인간관계, 주변 사람의 감정, 그리고 공감'
  },
  {
    dim: 'TF',
    opt1Key: 'T', opt2Key: 'F',
    title: '친구가 고민을 털어놓을 때 나의 반응은?',
    opt1: '문제 상황을 객관적으로 분석하고 해결책을 제시한다.',
    opt2: '친구의 마음에 먼저 깊이 공감해주고 따뜻하게 위로한다.'
  },
  {
    dim: 'TF',
    opt1Key: 'T', opt2Key: 'F',
    title: '피드백이나 평가를 줄 때?',
    opt1: '냉정하더라도 정확하고 솔직한 진단을 내린다.',
    opt2: '상대방이 상처받지 않도록 기분을 배려하며 표현한다.'
  },
  {
    dim: 'JP',
    opt1Key: 'J', opt2Key: 'P',
    title: '일정이나 여행 계획을 다룰 때?',
    opt1: '시각별 상세한 계획을 세우고 차근차근 이행한다.',
    opt2: '큰 틀만 정해두고 당시의 기분과 상황에 맞춰 움직인다.'
  },
  {
    dim: 'JP',
    opt1Key: 'J', opt2Key: 'P',
    title: '작업 공간(책상/방)을 대하는 태도는?',
    opt1: '항상 물건들이 제자리에 정돈되어 있어야 마음이 편하다.',
    opt2: '다소 어질러져 있어도 내 방식대로 찾는 데 문제없다.'
  },
  {
    dim: 'JP',
    opt1Key: 'J', opt2Key: 'P',
    title: '결정을 내리는 시점은?',
    opt1: '가급적 빨리 마감하고 결론을 확정 짓는다.',
    opt2: '마지막까지 새로운 가능성을 열어두고 유연하게 대처한다.'
  }
];

function calculateMbtiFromAnswers(answers) {
  const scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  answers.forEach((ans, idx) => {
    const q = MBTI_QUESTIONS[idx];
    if (!q) return;
    if (ans === 1) scores[q.opt1Key]++;
    else if (ans === 2) scores[q.opt2Key]++;
  });
  const ei = scores.E >= scores.I ? 'E' : 'I';
  const sn = scores.S >= scores.N ? 'S' : 'N';
  const tf = scores.T >= scores.F ? 'T' : 'F';
  const jp = scores.J >= scores.P ? 'J' : 'P';
  return `${ei}${sn}${tf}${jp}`;
}

  function buildMbtiIntroAnsi() {
    return [
      buildTopHeader(['오락실', 'MBTI 성격진단']),
      c(15, '  12개 질문에 답하시면 당신의 MBTI 성격유형을 진단해 드립니다.'),
      c(8, '  (표준 4대 척도: E/I, S/N, T/F, J/P 약식 검사 알고리즘 적용)'),
      '',
      `  ${c(14, '1.')} ${c(11, 'MBTI 자가 진단 테스트 시작하기 (추천)')}`,
      `  ${c(14, '2.')} ${c(15, '16가지 성격유형 전체 목록 직접 보기')}`,
      '',
      c(8, '  번호(1~2)를 입력하거나 Enter를 누르면 자가 진단이 시작됩니다.')
    ].join('\n');
  }

  function buildMbtiTestQuestionAnsi(qIndex, answers = []) {
    const total = MBTI_QUESTIONS.length;
    const q = MBTI_QUESTIONS[qIndex];
    if (!q) return '';

    const percent = Math.round(((qIndex + 1) / total) * 100);
    const gaugeFilled = Math.round((qIndex + 1) / total * 15);
    const gaugeStr = '█'.repeat(gaugeFilled) + '░'.repeat(15 - gaugeFilled);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const wrapWidth = Math.max(30, targetCols - 14);

    const parts = [
      buildTopHeader(['오락실', `MBTI 진단 [질문 ${qIndex + 1}/${total}]`]),
      c(11, `  진행률: [${gaugeStr}] (${percent}%)`),
      c(8, `  ${'─'.repeat(Math.min(76, targetCols - 4))}`),
      '',
      c(14, `  Q${qIndex + 1}. ${q.title}`),
      ''
    ];

    wrapAnsiText(`1. ${q.opt1}`, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');
    wrapAnsiText(`2. ${q.opt2}`, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(8, '  (이전 질문으로 돌아가려면 B 입력)'));
    return parts.join('\n');
  }

  function buildMbtiListAnsi() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const parts = [buildTopHeader(['오락실', 'MBTI 16가지 유형 목록']), c(15, '  성격유형을 선택하면 특징을 보여드립니다.')];
    wrapAnsiText('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.', targetCols - 2)
      .forEach((line) => parts.push(c(8, `  ${line}`)));
    parts.push('');
    MBTI_TYPES.forEach(([code, nick], index) => parts.push(`  ${c(14, `${String(index + 1).padStart(2, ' ')}.`)} ${c(11, fitCell(code, 5))}${c(15, nick)}`));
    return parts.join('\n');
  }
  function findMbtiType(input) {
    const value = String(input || '').trim().toUpperCase();
    const index = /^\d+$/.test(value) ? Number(value) - 1 : MBTI_TYPES.findIndex(([code]) => code === value);
    if (!MBTI_TYPES[index]) return null;
    const [code, nick, desc, strength, weakness, career] = MBTI_TYPES[index];
    return { code, nick, desc, strength, weakness, career };
  }
  function buildMbtiDetailAnsi(type) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const wrapWidth = Math.max(30, targetCols - 14);

    const parts = [
      buildTopHeader(['오락실', `MBTI ${type.code}`]),
      c(11, `${ANSI_BOLD}  ${type.code}${ANSI_RESET}  ${ansiColor(14)}[ ${type.nick} ]${ANSI_RESET}`),
      c(8, `  ${'─'.repeat(Math.min(76, targetCols - 4))}`),
      '',
      c(14, '  [ 핵심 특징 ]')
    ];

    wrapAnsiText(type.desc, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(11, '  [ 주요 강점 ]'));
    wrapAnsiText(type.strength, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(13, '  [ 주의할 점 ]'));
    wrapAnsiText(type.weakness, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(10, '  [ 추천 분야 ]'));
    wrapAnsiText(type.career, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(8, '  다른 유형을 보려면 번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.'));
    return parts.join('\n');
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

    const detailIdx = seed % COMPAT_DETAILS.length;
    const [title, personality, chemistry, caution, tip] = COMPAT_DETAILS[detailIdx];

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const wrapWidth = Math.max(30, targetCols - 14);

    const parts = [
      buildTopHeader(['오락실', '궁합']),
      c(11, `${ANSI_BOLD}  ${dateText(birth1)}생 ${animal1}띠${ANSI_RESET}  ${ansiColor(15)}×${ANSI_RESET}  ${ansiColor(11)}${ANSI_BOLD}${dateText(birth2)}생 ${animal2}띠${ANSI_RESET}`),
      c(8, `  ${'─'.repeat(Math.min(76, targetCols - 4))}`),
      '',
      `  ${c(14, '궁합 점수')} ${c(9, ANSI_BOLD + String(score) + '점' + ANSI_RESET)}  ${c(11, ANSI_BOLD + '★ '.repeat(Math.round(score / 20)) + ANSI_RESET)}${c(8, 'ㆍ '.repeat(5 - Math.round(score / 20)))}  ${c(14, `[ ${title} ]`)}`,
      '',
      c(14, '  [ 성격 및 가치관 궁합 ]')
    ];

    wrapAnsiText(personality, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(11, '  [ 연애 & 인연 기운 ]'));
    wrapAnsiText(chemistry, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(13, '  [ 다툼 예방 & 주의할 점 ]'));
    wrapAnsiText(caution, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));
    parts.push('');

    parts.push(c(10, '  [ 관계를 위한 황금 팁 ]'));
    wrapAnsiText(tip, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));

    return parts.join('\n');
  }

  function buildTojeongIntroAnsi() {
    return [buildTopHeader(['오락실', '토정비결']), c(15, '  생년월일로 올해 열두 달의 운세를 풀어봅니다.'), '', c(14, '  생년월일을 입력하세요.'), c(11, '  입력 예) 1990-01-01 또는 19900101')].join('\n');
  }
  // [LOG: 20260723_1652] 월 뒤에 공백 1칸 추가하여 띄어쓰기 개선
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
      parts.push(`  ${c(14, fitCell(`${String(month).padStart(2, ' ')}월`, 4))} ${c(15, TOJEONG_MESSAGES[seed])}`);
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
  return { buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, findMbtiType, buildBloodIntroAnsi, buildBloodAnsi, findBloodType, buildCompatIntroAnsi, buildCompatIntro2Ansi, buildCompatAnsi, buildTojeongIntroAnsi, buildTojeongAnsi, buildRetroArtListAnsi, buildRetroArtViewAnsi, MBTI_TYPES, MBTI_QUESTIONS, calculateMbtiFromAnswers, buildMbtiIntroAnsi, buildMbtiTestQuestionAnsi };
}
