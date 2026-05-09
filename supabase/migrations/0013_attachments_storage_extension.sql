-- [LOG: 20260411_2130] 첨부파일 스토리지 확장 컬럼 추가
-- 목적: 향후 Supabase Storage 연동을 위한 컬럼 보강 및 인덱스 정비

-- 1. storage_bucket, storage_path 컬럼 추가 (idempotent)
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NULL,
  ADD COLUMN IF NOT EXISTS storage_path   TEXT NULL;

-- 2. MIME 타입 기본값 보정 (legacy 호환)
UPDATE public.attachments
SET mime_type = 'application/octet-stream'
WHERE mime_type IS NULL OR mime_type = '';

-- 3. 검색 최적화 인덱스 보강
CREATE INDEX IF NOT EXISTS idx_attachments_board_post ON public.attachments(board_id, post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_storage    ON public.attachments(storage_bucket, storage_path);
