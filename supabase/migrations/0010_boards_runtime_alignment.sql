-- [LOG: 20260411_2110] 게시판 메타데이터 정리 및 시드 데이터 입력
-- 목적: 게시판 관리 테이블을 최신화하고 hanulso.mnu 기준의 기본 게시판 데이터를 구축

-- 1. boards 테이블 생성 및 보강
CREATE TABLE IF NOT EXISTS public.boards (
  id                 BIGSERIAL PRIMARY KEY,
  board_id           TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  group_key          TEXT NOT NULL DEFAULT 'top',
  menu_path          TEXT NOT NULL DEFAULT 'top',
  door               TEXT NOT NULL DEFAULT '',
  access_level       INT NOT NULL DEFAULT 1,
  write_sysop_only   BOOLEAN NOT NULL DEFAULT false,
  reply_enabled      BOOLEAN NOT NULL DEFAULT true,
  attachment_enabled BOOLEAN NOT NULL DEFAULT false,
  header_file        TEXT NOT NULL DEFAULT '',
  footer_file        TEXT NOT NULL DEFAULT '',
  sort_order         INT NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_menu_path_sort ON public.boards(menu_path, sort_order);
CREATE INDEX IF NOT EXISTS idx_boards_group_sort     ON public.boards(group_key, sort_order);

-- 2. 게시판 시드 데이터 입력 (Upsert 방식)
INSERT INTO public.boards (board_id, name, menu_path, door, sort_order, access_level, write_sysop_only, reply_enabled, attachment_enabled)
VALUES
  -- 서비스안내
  ('notice',    '공지사항',       'top', '1', 1, 1, true,  false, true),
  ('tosysop',   '건의하기',       'top', '2', 2, 1, false, true,  false),
  -- 게시판
  ('plaza',     '열린광장',       'top', '3', 3, 1, false, true,  false),
  ('humor',     '유머',         'top', '4', 4, 1, false, true,  false),
  ('say',       '횡설수설',       'top', '5', 5, 1, false, true,  false),
  ('qna',       '묻고답하기',     'top', '6', 6, 1, false, true,  false),
  ('newface',   '가입인사',       'top', '7', 7, 1, false, true,  false),
  ('locnews',   '지역소식',       'top', '8', 8, 1, false, true,  false),
  ('entertain', '연예/오락',      'top', '9', 9, 1, false, true,  false),
  ('carpool',   '자동차함께타기', 'top', '10', 10, 1, false, true, false),
  ('mystery',   '불가사의',       'top', '11', 11, 1, false, true, false),
  ('novice',    '컴퓨터초보시절', 'top', '12', 12, 1, false, true, false),
  -- 공개자료실
  ('pds_all',     '전체보기',     'top', '13', 13, 1, true,  false, true),
  ('pds_util',    '유틸리티',     'top', '14', 14, 1, false, true,  true),
  ('pds_game',    '게임',         'top', '15', 15, 1, false, true,  true),
  ('pds_graphic', '그래픽/사진',  'top', '16', 16, 1, false, true,  true),
  ('pds_sound',   '음악/사운드',  'top', '17', 17, 1, false, true,  true),
  ('pds_prog',    '프로그래밍',   'top', '18', 18, 1, false, true,  true)
ON CONFLICT (board_id) DO UPDATE SET
  name = EXCLUDED.name,
  menu_path = EXCLUDED.menu_path,
  door = EXCLUDED.door,
  sort_order = EXCLUDED.sort_order,
  write_sysop_only = EXCLUDED.write_sysop_only,
  reply_enabled = EXCLUDED.reply_enabled,
  attachment_enabled = EXCLUDED.attachment_enabled,
  updated_at = now();
