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
// [LOG: 20260724_0958] 혈액형 설명문 상세화 및 장문화
const BLOOD_TYPES = [
  ['A', '섬세한 계획가', '신중하고 책임감이 대단히 강하며 자신이 속한 사회적 공동체의 원칙과 질서를 무엇보다 중요하게 여깁니다. 상대방을 배려하는 마음이 극진하여 타인에게 폐를 끼치는 행동을 극도로 경계하며, 언제나 성실하고 꼼꼼한 태도로 일처리를 완벽하게 준비하는 탁월한 장점을 가지고 있습니다. 그러나 한편으로는 주변의 평판이나 시선에 지나치게 신경을 쓴 나머지 과도한 걱정과 스트레스를 사서 받는 편이며, 내면의 자그마한 고민조차 혼자서 속으로 앓다가 완벽주의 성향에 가로막혀 마음의 여유를 잃어버리는 단점이 있습니다. 대인관계에서는 겉으로 묵묵해 보여도 속 깊은 신뢰를 나누는 단단한 동반자 스타일입니다.'],
  ['B', '자유로운 탐구가', '호기심과 탐구 정신이 엄청나게 풍부하고 자기 주관과 개성이 매우 뚜렷하여 자신이 관심을 둔 특정 분야에 고도로 몰입하는 집중력이 타의 추종을 불허합니다. 매사 독창적이고 참신한 아이디어를 끊임없이 내놓으며 위기 상황이나 급작스러운 변화 앞에서도 탁월한 순발력으로 임기응변을 해내는 뛰어난 장점을 가집니다. 다만, 구속이나 간섭을 극도로 싫어하는 성향 탓에 규칙과 매뉴얼에 얽매이는 것을 견디지 못하고 마이페이스로 행동하기 쉽습니다. 이로 인해 주변 사람들과 의도치 않게 부딪히거나 차갑고 제멋대로라는 오해를 사기 쉬우며, 감정 기복이 다소 뚜렷해 계획을 끝까지 밀어붙이는 끈기가 부족하다는 아쉬운 점이 있습니다.'],
  ['O', '타고난 리더', '매우 목표 지향적이며 열정적이고 사교성이 넘쳐나 어느 모임에서든 자연스럽게 사람들을 포용하고 리드하는 강직한 에너지를 지니고 있습니다. 난관 앞에서도 주눅 들지 않는 강력한 추진력과 긍정적인 현실 감각을 지녔으며, 대범하게 사람들의 마음을 하나로 모으는 넉살과 뛰어난 친화력을 보여주는 것이 최고의 장점입니다. 하지만 승부욕과 독점욕이 지나치게 강한 편이라 누군가와 대립할 때 자신의 주장을 절대 굽히지 않는 고집스러움을 드러내어 독선적이라는 평판을 얻을 위험이 있습니다. 또한 내면이 외향적인 겉모습과 달리 은근히 외로움을 잘 타고 사람들의 정서적 지지에 매우 굶주려 있는 감성적인 면모도 숨겨져 있습니다.'],
  ['AB', '이중적인 예술가', '매사 합리적인 이성과 풍부한 감수성을 자유롭게 넘나들며 사물의 이면을 정확히 짚어내는 뛰어난 분석가이자 다면적인 지성을 지닌 독특한 매력의 소유자입니다. 냉철하고 객관적인 태도로 갈등을 조율하는 평온한 균형감각과 남들이 보지 못하는 사건의 본질을 꿰뚫어 보는 통찰력이 대단히 훌륭합니다. 그러나 한편으로는 사생활이나 개인적 영역의 침범을 완벽히 경계하는 강력한 개인주의 성향을 가지고 있어서, 자신의 진짜 속마음을 타인에게 절대 드러내지 않고 사적인 선을 긋는 탓에 주변인들로부터 차갑고 이중적인 인물이라는 오해를 흔히 사기도 합니다. 인간관계에서 겉으로는 깍듯하고 친절하지만 깊은 속정은 소수의 신뢰하는 사람에게만 한정하여 나누는 편입니다.']
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
  // [LOG_ID: 20260724_2240] 사용자 지적 — "세로선이 안맞아"(박스 우측 테두리 |가 줄마다 다른
  // 위치에 찍힘). 이 박스는 fitCell 없이 손으로 공백 개수를 세어 만든 문자열이었는데, 한글은
  // 실제로 2칸(와이드 문자)을 차지해서 "글자 수는 맞아도 표시 폭은 다른" 줄들이 섞여 있었다
  // (예: "생체 리듬 서비스" 줄과 "자신의 생년월일을..." 줄은 글자 수는 비슷해도 실제 표시 폭이
  // 서로 달랐음). fitCell(displayWidth 기반 와이드 문자 인식 패딩)로 내부 폭을 정확히 맞춘다.
  function buildBiorhythmIntroAnsi() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const header = buildTopHeader(['오락실', '생체 리듬 서비스']);
    const innerWidth = isMobile ? 39 : 60;
    const border = `+${'-'.repeat(innerWidth)}+`;
    const boxLine = (text) => `|${fitCell(text, innerWidth)}|`;

    if (isMobile) {
      return [
        header,
        c(15, border),
        c(15, boxLine('  [ 생체 리듬 서비스 (BIORYTHM) ]')),
        c(15, boxLine('  자신의 생년월일을 입력하시면 신체,')),
        c(15, boxLine('  감성, 지성 4대 파형 차트를 봅니다.')),
        c(15, border),
        '',
        c(14, '■ 신체 리듬 (P - Physical, 23일)'),
        c(14, '■ 감성 리듬 (E - Emotional, 28일)'),
        c(14, '■ 지성 리듬 (I - Intellect, 33일)'),
        ''
      ].join('\n');
    }

    return [
      header,
      c(15, border),
      c(15, boxLine('  [ 생체 리듬 서비스 (BIORYTHM) ]')),
      c(15, boxLine('  태어난 날부터의 주기로 컨디션을 파악하는 서비스입니다.')),
      c(15, boxLine('  신체, 감성, 지성 4대 파형 차트를 2D로 렌더링합니다.')),
      c(15, border),
      '',
      c(14, '■ 신체 리듬 (P - Physical, 23일) : 체력, 피로도, 인내심'),
      c(14, '■ 감성 리듬 (E - Emotional, 28일): 기분, 감수성, 정신안정'),
      c(14, '■ 지성 리듬 (I - Intellect, 33일) : 사고력, 집중력, 판단력'),
      ''
    ].join('\n');
  }

  // [LOG_ID: 20260724_2250] 사용자 지적 — "결과물도 가로폭 넘치는데"(생체 리듬 차트 자체가
  // 화면 밖으로 넘침). 이 차트는 한 달 전체(최대 31일 × 3칸 + 라벨 5칸 = 98칸)를 폭 제한 없이
  // 그렸다 — isMobile 분기 자체가 아예 없어서 모바일(44칸)은 물론 데스크톱(80칸) 기준으로도
  // 이미 넘치고 있었다(다른 화면들은 전부 지키는 targetCols 관례를 이 함수만 빠뜨렸음). 매달
  // 전체를 다 보여주는 대신, 화면 폭에 맞는 만큼만(오늘을 중심으로) 보여준다 — 페이지네이션
  // 컨트롤을 새로 추가하는 대신(B가 이미 "게임 메뉴로" 의미로 쓰이고 있어 충돌 위험), 가장
  // 실용적인 "오늘 근처 며칠"만 보여주는 창(window)으로 좁혀 넘침 자체를 원천 차단한다.
  function buildBiorhythmAnsi(birth, target = new Date(), userName = '사용자') {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const labelWidth = 5;
    const maxDaysVisible = Math.max(5, Math.floor((targetCols - labelWidth) / 3));

    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = target.getDate();

    let startDay = 1;
    let endDay = daysInMonth;
    if (daysInMonth > maxDaysVisible) {
      const half = Math.floor(maxDaysVisible / 2);
      startDay = Math.max(1, Math.min(today - half, daysInMonth - maxDaysVisible + 1));
      endDay = Math.min(daysInMonth, startDay + maxDaysVisible - 1);
    }
    const isWindowed = startDay > 1 || endDay < daysInMonth;

    const birthFormatted = `${birth.getFullYear()}/${String(birth.getMonth() + 1).padStart(2, '0')}/${String(birth.getDate()).padStart(2, '0')}`;
    const getDaysForDate = (dObj) => Math.round((dObj.getTime() - birth.getTime()) / 86400000);

    // [LOG_ID: 20260724_2310] 사용자 요청 — "모바일은 오래전 ui처럼 점수와 막대로 표시할까".
    // 달력형 차트는 좁은 화면에서 며칠만 보여줘도 여전히 빽빽하다 — 모바일은 오늘 하루의
    // 3대 리듬을 점수+막대(row 헬퍼, 원래 이 파일에 이미 있었지만 실제로는 어디서도 호출되지
    // 않던 구현)로 보여주는 게 훨씬 읽기 쉽다. 데스크톱은 기존 달력형 차트(위 윈도잉 로직)를
    // 그대로 유지한다.
    if (isMobile) {
      const elapsed = getDaysForDate(target);
      const phy = rhythm(elapsed, 23);
      const emo = rhythm(elapsed, 28);
      const int = rhythm(elapsed, 33);
      // 요약 문구·범례는 문장이 길어 44칸 한 줄에 다 안 들어간다 — wrapAnsiText로 감싼다.
      const summaryLines = wrapAnsiText(getBiorhythmSummary(phy, emo, int, phy), targetCols - 2)
        .map((line) => c(8, `  ${line}`));
      const legendLines = wrapAnsiText('P:신체(23일)  E:감성(28일)  I:지성(33일)', targetCols - 2)
        .map((line) => c(8, `  ${line}`));
      return [
        buildTopHeader(['오락실', '생체 리듬 서비스']),
        c(15, `  생일 ${birthFormatted}  오늘 ${dateText(target)}`),
        '',
        row('신체', phy, true),
        row('감성', emo, true),
        row('지성', int, true),
        '',
        ...summaryLines,
        '',
        ...legendLines
      ].join('\n');
    }

    const rangeLabel = isWindowed ? `${month}월 ${startDay}~${endDay}일` : `${year}년 ${month}월`;
    const parts = [
      buildTopHeader(['오락실', '생체 리듬 서비스']),
      c(15, `  생 일 : ${birthFormatted}(양)   <${rangeLabel}>   ${userName}님의 신체리듬`),
      ''
    ];

    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    let dayOfWeekLine = '     ';
    for (let day = startDay; day <= endDay; day++) {
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
        for (let day = startDay; day <= endDay; day++) {
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

      for (let day = startDay; day <= endDay; day++) {
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
    for (let day = startDay; day <= endDay; day++) {
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
    return [buildTopHeader(['오락실', '오늘의 운세']), c(15, '  태어난 해의 띠와 오늘의 일진을 풀어 운세를 봅니다.'), c(8, '  십이지의 삼합·육합·육충·육해 관계를 사용합니다.'), '', c(14, '  생년월일(8자리)을 입력하세요.'), c(11, '  입력 예) 19900101')].join('\n');
  }
  // [LOG: 20260724_0948] 생년월일 날짜 객체 기반 및 십이지 합충 역학 알고리즘 적용
  function buildFortuneAnsi(birthDate, target = new Date()) {
    const year = birthDate.getFullYear();
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();

    const animal = ZODIAC[((year - 4) % 12 + 12) % 12];
    const yearZodiacIdx = ((year - 4) % 12 + 12) % 12; // 띠 지지 인덱스 (0~11)
    const dayGanjiIdx = getDayGanjiIndex(target);
    const dayGanjiStr = ganjiText(dayGanjiIdx);
    const dayJijiIdx = dayGanjiIdx % 12; // 오늘의 지지 인덱스 (0~11)

    // 동양 역학(삼합, 육합, 육충, 육해) 분석
    // 1) 육합: 자축(0-1), 인해(2-11), 묘술(3-10), 진유(4-9), 사신(5-8), 오미(6-7)
    const isYukHap = (
      (yearZodiacIdx === 0 && dayJijiIdx === 1) || (yearZodiacIdx === 1 && dayJijiIdx === 0) ||
      (yearZodiacIdx === 2 && dayJijiIdx === 11) || (yearZodiacIdx === 11 && dayJijiIdx === 2) ||
      (yearZodiacIdx === 3 && dayJijiIdx === 10) || (yearZodiacIdx === 10 && dayJijiIdx === 3) ||
      (yearZodiacIdx === 4 && dayJijiIdx === 9) || (yearZodiacIdx === 9 && dayJijiIdx === 4) ||
      (yearZodiacIdx === 5 && dayJijiIdx === 8) || (yearZodiacIdx === 8 && dayJijiIdx === 5) ||
      (yearZodiacIdx === 6 && dayJijiIdx === 7) || (yearZodiacIdx === 7 && dayJijiIdx === 6)
    );

    // 2) 삼합: 4칸 또는 8칸 차이
    const isSamHap = (Math.abs(yearZodiacIdx - dayJijiIdx) === 4 || Math.abs(yearZodiacIdx - dayJijiIdx) === 8);

    // 3) 육충: 정확히 6칸 차이
    const isYukChung = (Math.abs(yearZodiacIdx - dayJijiIdx) === 6);

    // 4) 육해: 자미(0-7), 축오(1-6), 인사(2-5), 묘진(3-4), 신해(8-11), 유술(9-10)
    const isYukHae = (
      (yearZodiacIdx === 0 && dayJijiIdx === 7) || (yearZodiacIdx === 7 && dayJijiIdx === 0) ||
      (yearZodiacIdx === 1 && dayJijiIdx === 6) || (yearZodiacIdx === 6 && dayJijiIdx === 1) ||
      (yearZodiacIdx === 2 && dayJijiIdx === 5) || (yearZodiacIdx === 5 && dayJijiIdx === 2) ||
      (yearZodiacIdx === 3 && dayJijiIdx === 4) || (yearZodiacIdx === 4 && dayJijiIdx === 3) ||
      (yearZodiacIdx === 8 && dayJijiIdx === 11) || (yearZodiacIdx === 11 && dayJijiIdx === 8) ||
      (yearZodiacIdx === 9 && dayJijiIdx === 10) || (yearZodiacIdx === 10 && dayJijiIdx === 9)
    );

    // 기본 무난한 점수 3점에서 시작하여 띠-일진 궁합에 따라 1차 보정
    let baseFortuneScore = 3;
    if (isYukHap) baseFortuneScore += 2;
    else if (isSamHap) baseFortuneScore += 1;
    if (isYukChung) baseFortuneScore -= 2;
    else if (isYukHae) baseFortuneScore -= 1;

    // 각 항목별(총운, 애정운, 금전운, 건강운)로 태어난 월, 일의 정보와 고유 소수 가중치를 결합해
    // 점수를 다채롭게 분산시킴 (1~5점)
    const itemMultipliers = [7, 13, 19, 23];
    const scores = itemMultipliers.map((mult, index) => {
      const variant = (month + day + index) * mult + dayGanjiIdx;
      const offset = (variant % 3) - 1; // -1, 0, 1 중 하나
      let score = baseFortuneScore + offset;
      return Math.max(1, Math.min(5, score));
    });

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
      const subIdx = (yearZodiacIdx + month + day + dayGanjiIdx + itemIdx) % messagePool[poolIdx].length;
      return messagePool[poolIdx][subIdx];
    };

    const parts = [
      buildTopHeader(['오락실', '오늘의 운세']),
      c(11, `${ANSI_BOLD}  ${year}년생 ${animal}띠 (${month}월 ${day}일생)${ANSI_RESET}  ${ansiColor(8)}${dateText(target)} (오늘의 일진: ${dayGanjiStr}일)${ANSI_RESET}`),
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
  // [LOG: 20260724_1004] 세로 스크롤바 방지를 위한 문단 간 빈 줄 압축 적용
  // [LOG: 20260724_1006] 실제 십이지(띠) 합·충·살 역학을 계산하는 정밀 궁합 연산 알고리즘 도입
  function buildCompatAnsi(birth1, birth2) {
    const idx1 = ((birth1.getFullYear() - 4) % 12 + 12) % 12;
    const idx2 = ((birth2.getFullYear() - 4) % 12 + 12) % 12;
    const animal1 = ZODIAC[idx1];
    const animal2 = ZODIAC[idx2];

    // 1. 역학 관계 계산
    // 삼합 (4칸 또는 8칸 차이)
    const diff = Math.abs(idx1 - idx2);
    const isSamhap = (diff === 4 || diff === 8);
    // 육합 (자축0-1, 인해2-11, 묘술3-10, 진유4-9, 사신5-8, 오미6-7 등 합이 11 혹은 23인 관계)
    const isYukhap = ((idx1 + idx2) === 11 || (idx1 + idx2) === 23 || (idx1 === 0 && idx2 === 1) || (idx1 === 1 && idx2 === 0));
    // 육충 (6칸 차이)
    const isChung = (diff === 6);
    // 원진살 (자미0-7, 축오1-6, 인유2-9, 묘신3-8, 진해4-11, 사술5-10)
    const wonjinPairs = [[0,7],[7,0],[1,6],[6,1],[2,9],[9,2],[3,8],[8,3],[4,11],[11,4],[5,10],[10,5]];
    const isWonjin = wonjinPairs.some(([a, b]) => idx1 === a && idx2 === b);
    // 상해살 (자미0-7, 축오1-6, 인사2-5, 묘진3-4, 신해8-11, 유술9-10)
    const sanghaePairs = [[0,7],[7,0],[1,6],[6,1],[2,5],[5,2],[3,4],[4,3],[8,11],[11,8],[9,10],[10,9]];
    const isSanghae = sanghaePairs.some(([a, b]) => idx1 === a && idx2 === b);

    // 2. 점수 산출
    let score = 75; // 기본 점수
    let title = '서로 노력이 필요한 궁합';
    let relationType = 'normal';

    if (isSamhap) {
      score += 20;
      title = '삼합(三合)의 천생연분 궁합';
      relationType = 'samhap';
    } else if (isYukhap) {
      score += 15;
      title = '육합(六合)의 이심전심 궁합';
      relationType = 'yukhap';
    } else if (isChung) {
      score -= 20;
      title = '충(沖)이 있어 마찰하는 궁합';
      relationType = 'chung';
    } else if (isWonjin) {
      score -= 15;
      title = '원진살(怨嗔煞)이 낀 애증 궁합';
      relationType = 'wonjin';
    } else if (isSanghae) {
      score -= 10;
      title = '해(害)가 있는 조율의 궁합';
      relationType = 'sanghae';
    } else {
      // 일반적인 생일 차이 시드 보정
      const dayDiff = Math.abs(Math.round((birth1.getTime() - birth2.getTime()) / 86400000)) % 11;
      score += (dayDiff - 5); // -5 ~ +5 보정
      relationType = 'normal';
      if (score >= 76) title = '서로에게 은은하게 물드는 궁합';
      else if (score <= 74) title = '서로 존중이 필요한 친구 궁합';
      else title = '조화롭고 무난한 평탄 궁합';
    }
    score = Math.max(50, Math.min(100, score));

    // 3. 역학 관계에 따른 영역별 설명문 구성
    let personality = '';
    let chemistry = '';
    let caution = '';
    let tip = '';

    if (relationType === 'samhap') {
      personality = `두 사람은 삼합(三合)을 이루어 성격과 가치관의 궁합이 매우 조화롭습니다. ${animal1}띠와 ${animal2}띠의 만남은 물 흐르듯 서로를 자연스럽게 이해하고 깊은 신뢰를 구축하기 가장 이상적입니다.`;
      chemistry = `가장 강력한 인연의 기운이 작용합니다. 특별히 맞춰가려고 애쓰지 않아도 정서적인 교감이 빠르며, 두 사람이 함께 뜻을 모아 일을 도모하면 배가되는 큰 성공의 기운이 깃듭니다.`;
      caution = `서로에 대한 편안함과 확신이 너무 큰 나머지, 역으로 무례해지거나 당연하게 생각하며 감사함을 잊어버리는 권태와 소홀함을 가장 조심하셔야 합니다.`;
      tip = `늘 고마움을 솔직히 표현하는 말버릇을 들이고, 주말에 분위기 좋은 조용한 공간을 함께 방문하여 편안한 대화를 통해 초심을 늘 환기하는 것이 최선입니다.`;
    } else if (relationType === 'yukhap') {
      personality = `육합(六合)의 조화로 정서적으로 매우 끈끈한 결속력을 가집니다. 성격이 다르더라도 서로의 든든한 등받이가 되어주며 은은하면서도 깊은 소울메이트 같은 공감대가 자연스럽게 형성됩니다.`;
      chemistry = `눈빛만 보아도 상대의 진심과 상황을 직감할 수 있을 정도로 이심전심의 영적 호흡이 잘 맞습니다. 서로의 삶에 긍정적인 자극이 되며 서로를 지지하는 에너지가 대단합니다.`;
      caution = `상대방이 내 생각을 전부 알아줄 것이라 지레짐작하여 중요한 소통이나 말 표현을 은연중에 생략하다가 오해의 불씨를 남기는 실수를 경계해야 합니다.`;
      tip = `아무리 가까워도 하루에 한 번씩 서로의 사소한 고민이나 일상을 나누는 따뜻한 통화나 메신저 대화를 거르지 않는 것이 소중한 관계를 지키는 길입니다.`;
    } else if (relationType === 'chung') {
      personality = `정반대의 방향에 위치한 띠로 충(沖)을 이루고 있습니다. 가치관과 행동 스타일이 판이하게 달라 첫눈에 강하게 끌리지만, 시간이 지날수록 부딪치는 빈도가 높아질 수 있는 관계입니다.`;
      chemistry = `서로를 신선하게 자극하는 힘은 뛰어나지만 성격이 조급해질 때 마찰이 불꽃처럼 튀기 쉽습니다. 서로 다른 삶의 속도를 이해하기 전까지는 감정 기복이 클 수 있는 기운입니다.`;
      caution = `서로의 주관과 의견 차이가 발생했을 때, 자신의 성향만이 옳다고 고집을 피우며 상대방의 스타일을 강압적으로 뜯어고치려 드는 지배적 태도를 금해야 합니다.`;
      tip = `대립이 시작될 때는 말을 잠시 멈추고 3초간 숨을 고르세요. "서로 다르기 때문에 끌렸다"는 사실을 머리에 늘 되새기며 한 걸음 양보하는 훈련이 필요합니다.`;
    } else if (relationType === 'wonjin') {
      personality = `원진살(怨嗔煞)의 기운이 작용하여 애증의 감정이 교차할 수 있습니다. 함께 있으면 티격태격 미워하면서도, 막상 떨어져 있으면 서로의 안부가 간절해지는 묘한 성격적 자극을 지닙니다.`;
      chemistry = `묘한 집착이나 감정적 밀당이 생기기 쉽습니다. 깊은 애정을 바탕으로 두고 있지만 오해가 생기면 겉으로 내뱉는 직설적인 가시 돋친 언행으로 서로에게 큰 상처를 주기 쉽습니다.`;
      caution = `갈등 상황에서 옛날 일까지 끄집어내어 상대방의 약점이나 자존심을 긁는 독한 언사를 퍼붓거나 감정의 끝을 보려 드는 감정 싸움을 반드시 멈추셔야 합니다.`;
      tip = `의견이 격해지면 즉시 각자만의 방이나 공간으로 잠시 격리하여 이성을 되찾은 뒤에 차분히 대화하세요. 화해할 때는 맛있는 음식을 함께 나누는 것이 즉효약입니다.`;
    } else if (relationType === 'sanghae') {
      personality = `서로에게 은근한 오해와 스트레스를 유발하기 쉬운 상해(害)의 역학에 해당합니다. 악의는 없으나 상대의 의도와 말을 오해하여 혼자서 소심하게 꽁해 있는 정서적 피로가 누적될 수 있습니다.`;
      chemistry = `가랑비에 옷 젖듯 사소한 가치관 차이로 긴장감이 스며들기 쉽습니다. 하지만 이를 잘 조율하고 이해하기 시작하면 누구보다 꼼꼼하게 상대방의 구멍을 메워주는 건설적인 보조가 됩니다.`;
      caution = `상대의 사소한 말 한마디를 나쁜 뜻으로 확대해석하여 혼자만의 편견의 벽을 쌓거나 뒤돌아 혼자 섭섭해하는 소극적이고 폐쇄적인 마음가짐을 자제해야 합니다.`;
      tip = `조금이라도 오해나 서운함이 생기면 마음에 묵혀두지 말고, 그 자리에서 "아까 그 말은 혹시 이런 뜻이었어?"라고 부드럽고 가볍게 물어서 오해를 즉각 해소해야 합니다.`;
    } else {
      personality = `두 사람은 충이나 살이 없는 매우 무난하고 평탄한 성격 궁합을 지녔습니다. 튀는 대립도 없지만 지나친 자극도 없는, 편안하고 든든한 친구 같은 가치관을 공유합니다.`;
      chemistry = `오래 알고 지낸 동료나 가족처럼 평화롭고 안도감이 높은 기운을 자랑합니다. 서로의 예의를 지켜주며 은은한 신뢰가 세월과 함께 대기만성형으로 굳건히 쌓이는 인연입니다.`;
      caution = `관계가 너무 평화롭고 자극이 없다 보니 서로에게 익숙해져 설렘이나 연애 세포가 시들해지고 공기처럼 덤덤하게 대하게 되는 매너리즘을 조심해야 합니다.`;
      tip = `가끔은 예상치 못한 깜짝 이벤트나 평소에 가보지 않았던 생소하고 이색적인 여행지를 탐방하며 서로에게 새로운 자극과 활력을 수시로 공급해 주는 노력이 큰 도움이 됩니다.`;
    }

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

    parts.push(c(11, '  [ 연애 & 인연 기운 ]'));
    wrapAnsiText(chemistry, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));

    parts.push(c(13, '  [ 다툼 예방 & 주의할 점 ]'));
    wrapAnsiText(caution, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));

    parts.push(c(10, '  [ 관계를 위한 황금 팁 ]'));
    wrapAnsiText(tip, wrapWidth).forEach((line) => parts.push(c(15, `    ${line}`)));

    return parts.join('\n');
  }

  function buildTojeongIntroAnsi() {
    return [buildTopHeader(['오락실', '토정비결']), c(15, '  생년월일로 올해 열두 달의 운세를 풀어봅니다.'), '', c(14, '  생년월일을 입력하세요.'), c(11, '  입력 예) 1990-01-01 또는 19900101')].join('\n');
  }
  // [LOG: 20260724_1009] 정통 토정비결 조견상수 및 한국식 세는나이 작괘공식 반영
  function buildTojeongAnsi(birth, target = new Date()) {
    const animal = ZODIAC[((birth.getFullYear() - 4) % 12 + 12) % 12];
    const year = target.getFullYear();

    const birthGanjiIdx = getYearGanjiIndex(birth.getFullYear());
    const targetGanjiIdx = getYearGanjiIndex(year);

    // 1. 3자리 괘 생성 (상괘 1~8, 중괘 1~6, 하괘 1~3)
    const birthYear = birth.getFullYear();
    const birthMonth = birth.getMonth() + 1;
    const birthDay = birth.getDate();

    const GAN_CONSTANTS = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5]; // 甲(9) ~ 癸(5)
    const JI_CONSTANTS = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5, 9, 8]; // 子(9) ~ 亥(8)

    const birthGan = birthGanjiIdx % 10;
    const targetGan = targetGanjiIdx % 10;
    const targetJi = targetGanjiIdx % 12;

    const age = year - birthYear + 1; // 한국식 세는나이

    const sangSum = GAN_CONSTANTS[targetGan] + GAN_CONSTANTS[birthGan] + age;
    const sang = (sangSum % 8) || 8;

    const jungSum = birthMonth + JI_CONSTANTS[targetJi];
    const jung = (jungSum % 6) || 6;

    const yearOffset = (targetGanjiIdx % 3) + 1;
    const haSum = birthDay + yearOffset;
    const ha = (haSum % 3) || 3;

    const gwaNo = `${sang}${jung}${ha}`;
    const sangNames = ['천(天)', '지(地)', '수(水)', '화(火)', '풍(風)', '뢰(雷)', '산(山)', '택(澤)'];
    const jungNames = ['인(人)', '의(義)', '예(禮)', '지(智)', '신(信)', '화(和)'];
    const haNames = ['일(日)', '월(月)', '성(星)'];
    const gwaName = `${sangNames[sang - 1]}${jungNames[jung - 1]}${haNames[ha - 1]} 괘`;

    // 2. 괘에 따른 총론 조립
    const introSubjects = [
      '만물에 따스한 봄바람이 불어와 푸른 새싹이 돋아나듯',
      '깊은 어둠 속에서 마침내 앞을 밝히는 등불을 얻은 격이니',
      '영험한 용이 여의주를 얻어 비구름을 뚫고 솟구치듯',
      '가문 땅에 촉촉한 단비가 내려 백곡이 스스로 윤택해지듯',
      '험준한 산맥을 벗어나 사방이 탁 트인 넓은 길로 달려가듯',
      '도도히 흐르던 물결이 마침내 드넓은 대양에 이르러 품을 넓히듯',
      '차가운 서리 속에 고고히 피어난 매화가 향기를 뿜어내듯',
      '높은 지덕을 지닌 귀인이 문 밖에서 서성이며 길을 안내하듯'
    ];
    const introVerbs = [
      '그동안 막혀있던 재물과 신수가 활짝 열리며 경사가 끊이지 않는 상서로운 해입니다.',
      '뜻밖의 귀인과 동료의 긴밀한 도움으로 도모하는 큰 계획을 마침내 성취할 대길한 기회입니다.',
      '다소 간의 험난함이 있어도 흔들리지 않는 굳건한 노력으로 끝내 큰 안정을 일구어 냅니다.',
      '과도한 욕심을 부리지 않고 정직하게 순리를 따르면 명예와 풍요가 스스로 따르게 됩니다.',
      '초반에는 곤고한 기운이 돌겠으나, 하반기부터 인덕이 만발하여 평안함을 찾게 될 운세입니다.',
      '공연한 시비와 타인의 구설을 지혜롭게 피하여 내실을 다지면 무탈하고 안전한 형국입니다.',
      '멀리 이동하거나 새로운 변화를 꾀하는 기운이 대단히 길하니 용기 있게 나아가면 유익합니다.',
      '가정의 결속을 단단히 하고 심신을 차분히 돌보면 근심이 가시고 안락한 세월이 지속됩니다.'
    ];
    const introText = `[총론] ${introSubjects[(sang + jung) % 8]} ${introVerbs[(jung + ha) % 8]}`;

    // 3. 월별 운세 조립 데이터 정의
    const monthSubjects = [
      '뜻밖의 재물과 실리가', '가까운 동반자와의 단단한 신뢰가', '추진하는 창의적인 계획이', '신체와 심신의 편안한 안정이',
      '집안 내부의 화합과 풍요가', '소속된 곳에서의 눈부신 결과가', '어려울 때 돕는 고마운 인연의 손길이', '오랜 시간 염원해 온 바람이',
      '주변 지인과의 원활한 소통과 우정이', '기대했던 경제적 이권과 계약이', '새로이 시도하려는 크고 작은 이동이', '가슴 한구석을 짓누르던 근심이'
    ];
    const monthVerbs = [
      '아무런 장애 없이 순탄하게 풀려나가며 가정과 생활이 안락합니다.',
      '적재적소에서 찾아오는 귀인의 조력으로 보다 크고 화려하게 피어납니다.',
      '스스로 기울인 정직한 땀방울보다 훨씬 더 풍성한 알곡을 맺어 냅니다.',
      '공연한 마찰이나 타인의 불필요한 시비를 경계해야 화를 피할 수 있습니다.',
      '허황된 과욕을 부려 함정에 빠지지 않고 제 자리를 지키는 것이 최고입니다.',
      '생각지 못한 마찰이 예상되니 부드럽고 정중한 말씨로 대응하셔야 이롭니다.',
      '봄눈이 햇살에 씻기듯 흔적도 없이 완전히 해소되어 평화가 찾아옵니다.',
      '자연스러운 순리에 맡겨 두고 서둘러 억지로 채우려 들지 마십시오.'
    ];

    const targetGanjiStr = ganjiText(targetGanjiIdx);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [
      buildTopHeader(['오락실', '토정비결']),
      c(11, `${ANSI_BOLD}  ${dateText(birth)}생 ${animal}띠${ANSI_RESET}  ${ansiColor(8)}${year}년(${targetGanjiStr}년) 신수${ANSI_RESET}`),
      c(14, `  [ 신수 괘: 제 ${gwaNo}괘 - ${gwaName} ]`),
      c(15, `  ${introText}`),
      c(8, `  ${'─'.repeat(targetCols - 4)}`),
      ''
    ];

    for (let month = 1; month <= 12; month += 1) {
      const subIdx = (sang + jung + month) % 12;
      const verbIdx = (jung + ha + month) % 8;
      const text = `${monthSubjects[subIdx]} ${monthVerbs[verbIdx]}`;
      parts.push(`  ${c(11, fitCell(`${String(month).padStart(2, ' ')}월`, 4))} ${c(15, text)}`);
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
