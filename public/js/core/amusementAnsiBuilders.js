import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

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

export function createAmusementAnsiBuilders(deps) {
  const { ANSI_BOLD, ANSI_RESET, ansiColor, buildTopHeader, fitCell, wrapAnsiText } = createAnsiBuilderUtils(deps);
  const c = (tone, text) => `${ansiColor(tone)}${text}${ANSI_RESET}`;
  const dateText = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const rhythm = (days, period) => Math.round(Math.sin((Math.PI * 2 * days) / period) * 100);
  const row = (name, value) => {
    const count = Math.round(Math.abs(value) / 10);
    const bar = value >= 0 ? `│${'█'.repeat(count)}` : `${'█'.repeat(count)}│`;
    const status = value >= 80 ? '최고조 ▲' : value <= -80 ? '최저조 ▼' : Math.abs(value) < 15 ? '전환기 ◇' : value > 0 ? '상승 △' : '하강 ▽';
    return `  ${c(14, fitCell(name, 4))} ${c(value >= 0 ? 11 : 13, fitCell(bar, 14))} ${c(15, `${value > 0 ? '+' : ''}${value}%`)} ${c(8, status)}`;
  };

  function buildBiorhythmIntroAnsi() {
    return [buildTopHeader(['오락실', '바이오리듬']), c(15, '  태어난 날부터의 주기로 오늘의 컨디션을 가늠해 봅니다.'), c(8, '  신체 23일 · 감성 28일 · 지성 33일 주기'), '', c(14, '  생년월일을 입력하세요.'), c(11, '  입력 예) 1990-01-01 또는 19900101')].join('\n');
  }
  function buildBiorhythmAnsi(birth, target = new Date()) {
    const days = Math.round((target.getTime() - birth.getTime()) / 86400000);
    const parts = [buildTopHeader(['오락실', '바이오리듬']), c(11, `${ANSI_BOLD}  ${dateText(birth)} 생${ANSI_RESET}  ${ansiColor(8)}오늘로 ${days.toLocaleString()}일째${ANSI_RESET}`), '', row('신체', rhythm(days, 23)), row('감성', rhythm(days, 28)), row('지성', rhythm(days, 33)), '', c(14, '  ── 향후 7일 추이 ──')];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(target.getTime() + i * 86400000);
      const d = days + i;
      parts.push(c(i === 0 ? 15 : 8, `  ${dateText(date).slice(5)}  신체 ${String(rhythm(d, 23)).padStart(4)}  감성 ${String(rhythm(d, 28)).padStart(4)}  지성 ${String(rhythm(d, 33)).padStart(4)}`));
    }
    return parts.join('\n');
  }
  function buildFortuneIntroAnsi() {
    return [buildTopHeader(['오락실', '오늘의 운세']), c(15, '  태어난 해의 띠와 오늘의 일진을 풀어 운세를 봅니다.'), c(8, '  십이지의 삼합·육합·육충·육해 관계를 사용합니다.'), '', c(14, '  태어난 연도(4자리)를 입력하세요.'), c(11, '  입력 예) 1990')].join('\n');
  }
  function buildFortuneAnsi(year, target = new Date()) {
    const animal = ZODIAC[((year - 4) % 12 + 12) % 12];
    const seed = (year * 31 + target.getFullYear() * 13 + target.getMonth() + target.getDate()) % 5;
    const scores = ['총운', '애정운', '금전운', '건강운'].map((label, index) => 1 + ((seed + index * 2) % 5));
    const messages = ['새로운 시작보다 마무리에 집중하세요.', '서두르지 않으면 무난하게 흘러갑니다.', '작은 행운이 숨어 있는 하루입니다.', '결단을 내리기 좋은 날입니다.', '귀인의 도움으로 일이 풀립니다.'];
    const parts = [buildTopHeader(['오락실', '오늘의 운세']), c(11, `${ANSI_BOLD}  ${year}년생 ${animal}띠${ANSI_RESET}  ${ansiColor(8)}${dateText(target)}${ANSI_RESET}`), ''];
    ['총운', '애정운', '금전운', '건강운'].forEach((label, index) => parts.push(`  ${c(14, fitCell(label, 7))}${c(14, '★'.repeat(scores[index]))}${c(8, '☆'.repeat(5 - scores[index]))}  ${c(15, messages[scores[index] - 1])}`));
    return parts.join('\n');
  }
  function buildMbtiListAnsi() {
    const parts = [buildTopHeader(['오락실', 'MBTI']), c(15, '  성격유형을 선택하면 특징을 보여드립니다.'), c(8, '  번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.'), ''];
    MBTI_TYPES.forEach(([code, nick], index) => parts.push(`  ${c(14, `${String(index + 1).padStart(2, ' ')}.`)} ${c(11, fitCell(code, 5))}${c(15, nick)}`));
    return parts.join('\n');
  }
  function findMbtiType(input) {
    const value = String(input || '').trim().toUpperCase();
    const index = /^\d+$/.test(value) ? Number(value) - 1 : MBTI_TYPES.findIndex(([code]) => code === value);
    return MBTI_TYPES[index] ? { code: MBTI_TYPES[index][0], nick: MBTI_TYPES[index][1], desc: MBTI_TYPES[index][2] } : null;
  }
  function buildMbtiDetailAnsi(type) {
    return [buildTopHeader(['오락실', `MBTI ${type.code}`]), c(11, `${ANSI_BOLD}  ${type.code}${ANSI_RESET}  ${ansiColor(14)}${type.nick}${ANSI_RESET}`), c(8, `  ${'─'.repeat(52)}`), ...wrapAnsiText(type.desc, 70).map((line) => c(15, `  ${line}`)), '', c(8, '  다른 유형을 보려면 번호/코드를 입력하세요.')].join('\n');
  }
  return { buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, findMbtiType };
}
