-- [LOG: 20260320_2200] Phase 3 DB 스키마 마이그레이션
-- 실행: Supabase SQL Editor에서 직접 실행하거나, MCP 복구 후 apply_migration으로 실행

-- 회원 테이블 (원본 member 테이블 1:1 매핑)
CREATE TABLE IF NOT EXISTS public.members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  nick_name TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  birthday TEXT DEFAULT '',
  sex TEXT DEFAULT 'M',
  level INT DEFAULT 1 CHECK (level >= 1 AND level <= 99),
  is_open BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  registration_datetime TIMESTAMPTZ DEFAULT now(),
  lastlogin_datetime TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 게시판 목록 테이블 (hanulso.mnu에서 추출한 board 항목 메타 정보)
CREATE TABLE IF NOT EXISTS public.boards (
  id SERIAL PRIMARY KEY,
  board_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  menu_path TEXT DEFAULT 'top',
  door TEXT DEFAULT '',
  access_level INT DEFAULT 1,
  write_sysop_only BOOLEAN DEFAULT false,
  reply_enabled BOOLEAN DEFAULT true,
  attachment_enabled BOOLEAN DEFAULT false,
  header_file TEXT DEFAULT '',
  footer_file TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 게시글 테이블 (계층형: Family/Orderby/Step)
CREATE TABLE IF NOT EXISTS public.posts (
  id SERIAL PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES public.boards(board_id) ON DELETE CASCADE,
  family INT NOT NULL DEFAULT 0,
  orderby INT NOT NULL DEFAULT 0,
  step INT NOT NULL DEFAULT 0,
  user_id TEXT NOT NULL DEFAULT 'guest',
  nick_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  hit INT DEFAULT 0,
  recommend INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 첨부파일 테이블
CREATE TABLE IF NOT EXISTS public.attachments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'guest',
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  download_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 게시글 추천 테이블 (중복 추천 방지)
CREATE TABLE IF NOT EXISTS public.post_recommendations (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 메모 테이블
CREATE TABLE IF NOT EXISTS public.memos (
  id SERIAL PRIMARY KEY,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_board_id ON public.posts(board_id);
CREATE INDEX IF NOT EXISTS idx_posts_family_orderby ON public.posts(board_id, family, orderby);
CREATE INDEX IF NOT EXISTS idx_attachments_post ON public.attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_memos_recipient ON public.memos(recipient_user_id);

-- 기본 게시판 데이터 삽입 (hanulso.mnu 기반)
INSERT INTO public.boards (board_id, name, menu_path, door, access_level) VALUES
  ('notice',     '공지사항',       'top', '1',  1),
  ('welcome',    '가입인사',       'top', '2',  1),
  ('membership', '특선회원신청',   'top', '3',  1),
  ('tosysop',    '건의하기',       'top', '4',  1),
  ('plaza',      '자유 게시판',    'top', '51', 1),
  ('market',     '장터 게시판',    'top', '52', 1),
  ('te99',       '질문 게시판',    'top', '53', 1),
  ('humor',      '유머 게시판',    'top', '54', 1)
ON CONFLICT (board_id) DO NOTHING;

-- guest 기본 사용자
INSERT INTO public.members (user_id, nick_name, level, is_admin) VALUES
  ('guest', '손님', 1, false),
  ('sysop', '시스옵', 99, true)
ON CONFLICT (user_id) DO NOTHING;
