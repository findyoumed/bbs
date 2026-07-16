/**
 * [LOG_ID: 20260719_1400] 하이텔 (10)-6 단체편지 그룹지정(group) · 천리안 주소록(ADDRESS) 재현.
 *
 * 이름 붙인 수신자 그룹을 브라우저 localStorage에 저장한다(서버/테이블 변경 없음).
 * 쪽지 쓰기에서 받는 사람에 `@그룹명`을 넣으면 저장된 멤버로 퍼진다. 실제 발송은 기존
 * 다중 수신자 처리(서버 parseRecipients: 쉼표/공백 분리)를 그대로 재사용한다.
 */
const STORE_KEY = 'bbs.memoGroups';

function loadGroups() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (error) {
    return {};
  }
}

function persistGroups(groups) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(groups));
  } catch (error) {
    // localStorage 불가(사생활 모드 등)면 조용히 무시 — 이번 세션 한정으로만 동작하지 않는다.
  }
}

export function listGroups() {
  return loadGroups();
}

// 멤버 문자열(쉼표/공백 구분)을 정규화해 저장. 반환: 저장된 멤버 배열.
export function setGroup(name, membersRaw) {
  const key = String(name || '').trim();
  if (!key) return null;
  const members = String(membersRaw || '')
    .split(/[,\s]+/)
    .map((m) => m.trim())
    .filter(Boolean);
  if (!members.length) return null;
  const groups = loadGroups();
  groups[key] = members.join(',');
  persistGroups(groups);
  return members;
}

export function deleteGroup(name) {
  const key = String(name || '').trim();
  const groups = loadGroups();
  if (!(key in groups)) return false;
  delete groups[key];
  persistGroups(groups);
  return true;
}

/**
 * 받는 사람 입력의 `@그룹명` 토큰을 저장된 멤버로 치환한다.
 * 예: "@가족,extra" → "hong,kim,lee,extra". 그룹이 없으면 토큰을 그대로 둔다.
 */
export function expandRecipients(input) {
  const groups = loadGroups();
  const tokens = String(input || '')
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = [];
  for (const token of tokens) {
    if (token.startsWith('@')) {
      const name = token.slice(1);
      if (groups[name]) {
        groups[name].split(',').forEach((m) => out.push(m));
        continue;
      }
    }
    out.push(token);
  }
  // 중복 제거(대소문자 무시)
  const seen = new Set();
  return out.filter((id) => {
    const k = id.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(',');
}
