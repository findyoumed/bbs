-- [LOG: 20260411_2200] 런타임 라우터 및 설정 DB화 기반 구축
-- 목적: 파일 기반의 메뉴(hanulso.mnu) 및 설정(BBS_HOST_NAME 등)을 데이터베이스로 통합 관리

-- 1. 메뉴 노드 테이블 (계층 구조)
CREATE TABLE IF NOT EXISTS public.menu_nodes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id          UUID NULL REFERENCES public.menu_nodes(id) ON DELETE CASCADE,
  node_key           TEXT NOT NULL,
  node_type          TEXT NOT NULL DEFAULT 'menu', -- menu, board, news, weather, chatt, etc.
  go                 TEXT NOT NULL,
  menu_id            TEXT NOT NULL DEFAULT '',
  door               TEXT NOT NULL DEFAULT '',
  title              TEXT NOT NULL,
  access_level       INT NOT NULL DEFAULT 1,
  attachment_enabled BOOLEAN NOT NULL DEFAULT false,
  reply_enabled      BOOLEAN NOT NULL DEFAULT true,
  write_sysop_only   BOOLEAN NOT NULL DEFAULT false,
  header_file        TEXT NOT NULL DEFAULT '',
  footer_file        TEXT NOT NULL DEFAULT '',
  sort_order         INT NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_nodes_parent ON public.menu_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_nodes_go     ON public.menu_nodes(go);

-- 2. 사이트 전역 설정 테이블
CREATE TABLE IF NOT EXISTS public.site_config (
  id                     INT PRIMARY KEY DEFAULT 1,
  host_name              TEXT NOT NULL DEFAULT ' OldDOS-BBS',
  level_aliases          JSONB NOT NULL DEFAULT '{"1": "일반회원", "2": "특별회원", "99": "운영자"}'::jsonb,
  valid_levels           JSONB NOT NULL DEFAULT '[1, 2, 99]'::jsonb,
  signup_enabled         BOOLEAN NOT NULL DEFAULT true,
  email_confirm_required BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 3. 정적 콘텐츠 페이지 (도움말, 약관 등)
CREATE TABLE IF NOT EXISTS public.content_pages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL, -- help, agreement, privacy 등
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  is_html    BOOLEAN NOT NULL DEFAULT false,
  is_public  BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 메뉴 시드 데이터 입력 (최상위 'top' 노드 예시)
-- 실제 전체 메뉴는 데이터 마이그레이션 도구를 통해 hanulso.mnu에서 이관하는 것을 권장하나,
-- 루트 노드는 수동으로 미리 생성하여 부트스트랩 지원
INSERT INTO public.menu_nodes (node_key, node_type, go, title, door, sort_order)
VALUES ('top', 'menu', 'top', 'PC통신동호회 01410', '', 0)
ON CONFLICT (id) DO NOTHING;

-- 5. 기본 설정 시드
INSERT INTO public.site_config (id, host_name)
VALUES (1, 'PC통신동호회 01410')
ON CONFLICT (id) DO UPDATE SET
  host_name = EXCLUDED.host_name,
  updated_at = now();
