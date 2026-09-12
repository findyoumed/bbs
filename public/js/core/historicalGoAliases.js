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

// These commands already have dedicated global router branches.  Keep them
// out of the alias resolver to avoid changing routing precedence, but expose
// them to the historical command catalog and GO help screen.
export const HISTORICAL_GO_DIRECT_COMMANDS = Object.freeze({
  CMAIL: 'CMAIL',
  ME: 'ME',
  MEMO: 'MEMO',
  RMAIL: 'RMAIL',
  WMAIL: 'WMAIL'
});

export function resolveHistoricalGoAlias(target, normalize = null) {
  const normalizer = typeof normalize === 'function'
    ? normalize
    : (value) => String(value || '').replace(/\s+/g, '').trim().toUpperCase();
  const normalized = normalizer(target);
  return HISTORICAL_GO_ALIASES[normalized] || normalized;
}

// Keep help and command routing on the same source of truth.  Consumers can
// render these entries without knowing how the alias object is represented.
export function getHistoricalGoAliasEntries() {
  return Object.entries({ ...HISTORICAL_GO_ALIASES, ...HISTORICAL_GO_DIRECT_COMMANDS })
    .map(([alias, target]) => ({ alias, target }))
    .sort((left, right) => left.alias.localeCompare(right.alias, 'ko'));
}
