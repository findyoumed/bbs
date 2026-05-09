ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS nick_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN IF NOT EXISTS content_base64 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_attachments_board_post ON public.attachments(board_id, post_id);
