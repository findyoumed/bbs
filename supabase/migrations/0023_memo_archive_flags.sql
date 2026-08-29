-- [LOG_ID: 20260829_0218] 메모 보관함 플래그 스키마 정합성 보강
-- MemoRepositorySupabase는 수신자와 발신자가 독립적으로 보관할 수 있도록
-- receiver_archived/sender_archived를 조회·갱신한다. 기존 초기 스키마에는
-- 두 컬럼이 없어 새 프로젝트에서 목록·미읽음 수·저장이 실패할 수 있으므로
-- 기존 데이터와 재실행을 보존하는 IF NOT EXISTS로 추가한다.

ALTER TABLE public.memos
  ADD COLUMN IF NOT EXISTS receiver_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sender_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_memos_receiver_active
  ON public.memos (recipient_user_id, created_at DESC)
  WHERE receiver_archived = false;

CREATE INDEX IF NOT EXISTS idx_memos_sender_active
  ON public.memos (sender_user_id, created_at DESC)
  WHERE sender_archived = false;
