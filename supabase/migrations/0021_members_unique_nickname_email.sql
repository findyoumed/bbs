-- [LOG_ID: 20260727_1350] 회원정보수정(MyInfo) 전수조사 3차 — 사용자 요청 "오류날 것 같은 부분을
-- 깊게 찾아" 도중 발견: members.nick_name/email엔 UNIQUE 제약이 없고(idx_members_nick_name/
-- idx_members_email은 일반 인덱스일 뿐), 애플리케이션 코드(memberRoutes.js updateProfile/setEmail,
-- authRoutes.js 가입)는 "먼저 findByNickName/findByEmail로 중복 조회 → 없으면 저장"하는 TOCTOU
-- 경쟁조건에 취약한 패턴만으로 유일성을 지키고 있었다. 실제 운영 DB를 조회해 확인한 결과 회원
-- 469명 중 수백 건이 스모크테스트가 남긴 중복 닉네임이었다(예: "memo-smoke" 109개, "board-vote"
-- 104개 등 — 세션 중 정리 완료, 465개 계정 삭제). 이 상태에서 닉네임으로 회원을 찾는 검색/로그인
-- 경로(memberRoutes.js search, authRoutes.js 가입 중복확인)는 동일 닉네임 중 임의의 한 명만
-- 맞히는 구조였다. DB 레벨 유일성 보장이 없으면 동시 요청 시 애플리케이션 검사를 통과한 뒤에도
-- 여전히 중복이 생길 수 있으므로, 정리된 지금 상태에서 부분 유니크 인덱스로 막는다(빈 문자열
-- 이메일/닉네임이 여러 명 존재하는 것은 막지 않도록 WHERE로 제외 — 예: 손님/미입력 상태의
-- 과거 데이터가 있을 수 있어 완전 UNIQUE보다 안전함).
--
-- [주의] 이 마이그레이션 파일은 작성되었지만, 이 세션의 네트워크 정책상 Supabase Postgres에
-- 직접(raw SQL/DDL) 접속할 수 없어(REST API만 프록시를 통과함) 실제 DB에는 아직 적용되지
-- 않았다. 이 리포지토리의 배포 절차(수동 적용 또는 CI)를 통해 별도로 적용해야 한다.

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_nick_name_unique
  ON public.members (nick_name)
  WHERE nick_name IS NOT NULL AND nick_name <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_unique
  ON public.members (email)
  WHERE email IS NOT NULL AND email <> '';
