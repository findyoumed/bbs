-- [LOG: 20260411_2135] 쪽지 레이어 인덱스 보강
-- 목적: 수신/발신 쪽지 목록 조회 및 읽음 처리 성능 최적화

-- 1. 수신자 기준 최신순 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_recipient_recent ON public.memos(recipient_user_id, created_at DESC);

-- 2. 발신자 기준 최신순 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_sender_recent ON public.memos(sender_user_id, created_at DESC);

-- 3. 읽지 않은 쪽지 필터링 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_unread ON public.memos(recipient_user_id) WHERE is_read = false;

-- 4. read_at 자동 갱신 보조 로직 (is_read 가 true로 바뀔 때)
-- 이 로직은 서버 코드에서도 처리하지만, DB 레벨의 일관성을 위해 권장
CREATE OR REPLACE FUNCTION public.handle_memo_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_memo_read_at ON public.memos;
CREATE TRIGGER set_memo_read_at
  BEFORE UPDATE ON public.memos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_memo_read_at();
