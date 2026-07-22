-- =============================================================================
-- [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) 영속화 — 하이텔 길라잡이(그림 7.12)·
-- 천리안(NOMAN, p.165) 두 책 모두 확인된 기능. 기존 구현(memberRoutes.js getMyAbsent/
-- setAbsent, memoRoutes.js createMemo의 부재 수신자 안내)은 이미 있었지만 저장소가
-- `global.absentMessages`(Node 프로세스 메모리 Map)뿐이었다 — 서버 재시작/서버리스
-- 함수 인스턴스 교체마다 사라지고, 시작일/종료일 개념도 없이 메시지 문자열 하나뿐이었다.
-- 이 마이그레이션은 members 테이블에 실제 컬럼을 추가해 원전과 동일하게(부재 시작일/
-- 종료일/사유) 영속 저장한다.
-- =============================================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS absent_start  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS absent_end    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS absent_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_members_absent_end ON public.members(absent_end)
  WHERE absent_end IS NOT NULL;
