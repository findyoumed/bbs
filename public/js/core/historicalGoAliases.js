// [LOG_ID: 20260828_1500] Extend verified historical PC-communication GO
// keywords without changing the current service's canonical routes.

export const HISTORICAL_GO_ALIASES = Object.freeze({
  // HITEL.MNU: 3\#13. 토정비결:tojung
  TOJUNG: 'TOJEONG',
  // HITEL.MNU: 3\#14. 바이오리듬:biorym
  BIORYM: 'BIO',
  // HITEL.MNU: 3\#15. 궁합보기:gunghap
  GUNGHAP: 'COMPAT',
  // HITEL.MNU verified: unse maps to the existing FORTUNE screen.
  UNSE: 'FORTUNE',
  // HITEL.MNU verified: puzzle maps to the existing 15-puzzle screen.
  PUZZLE: '16P',
  // PC communication command guide: Chollian WORD is the free-discussion
  // board equivalent of this service's PLAZA (열린광장) board.
  WORD: 'PLAZA',
  // PC communication command guide: Nownuri's Korean shortcut for the humor
  // board maps to this service's existing HUMOR board.
  유머란: 'HUMOR',
  // 3사 공통 GO BLUEHOUSE (청와대 신문고)는 현재 서비스의
  // 시삽 건의하기 화면으로 의미가 보존되는 검증된 대응 경로다.
  BLUEHOUSE: 'TOSYSOP',
  // Nownuri menu code: CHATIN (대화참여) uses the existing chat lobby.
  CHATIN: 'CHAT',
  // HITEL.MNU: (11) 채팅 메뉴 is exposed as `chatting`; the current
  // service uses the canonical CHAT lobby for the same destination.
  CHATTING: 'CHAT',
  // HITEL.MNU: 여론/청와대 건의 메뉴 uses `bluehs`; TOSYSOP is the
  // current service's equivalent suggestion/contact screen.
  BLUEHS: 'TOSYSOP'
});

export function resolveHistoricalGoAlias(target, normalize = null) {
  const normalizer = typeof normalize === 'function'
    ? normalize
    : (value) => String(value || '').replace(/\s+/g, '').trim().toUpperCase();
  const normalized = normalizer(target);
  return HISTORICAL_GO_ALIASES[normalized] || normalized;
}
