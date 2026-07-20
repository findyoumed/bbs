/**
 * [LOG_ID: 20260719_2200] "할 수 있다: PC통신에서 인터넷까지" 대조 — 나우누리 원전 대화실
 * /BUDDY(접속 알림) 재현. 이 앱엔 실시간 푸시 채널이 없어 "즉시 알림"까지는 재현하지 못하고,
 * 이미 있는 접속자 조회(UID/WHO/USER)에서 버디를 강조 표시하는 조회형 기능으로 스코프를 좁혔다.
 * memoGroups.js와 동일하게 서버/테이블 변경 없이 브라우저 localStorage에 저장한다.
 */
const STORE_KEY = 'bbs.chatBuddies';

function loadBuddies() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (error) {
    return [];
  }
}

function persistBuddies(buddies) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(buddies));
  } catch (error) {
    // localStorage 불가(사생활 모드 등)면 조용히 무시 — 이번 세션 한정으로만 동작하지 않는다.
  }
}

export function listBuddies() {
  return loadBuddies();
}

export function addBuddy(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const buddies = loadBuddies();
  if (!buddies.some((b) => b.toLowerCase() === key.toLowerCase())) {
    buddies.push(key);
    persistBuddies(buddies);
  }
  return buddies;
}

export function removeBuddy(id) {
  const key = String(id || '').trim().toLowerCase();
  const buddies = loadBuddies();
  const next = buddies.filter((b) => b.toLowerCase() !== key);
  if (next.length === buddies.length) return false;
  persistBuddies(next);
  return true;
}

export function isBuddy(id) {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return false;
  return loadBuddies().some((b) => b.toLowerCase() === key);
}
