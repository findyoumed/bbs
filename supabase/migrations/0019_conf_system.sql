-- =============================================================================
-- [LOG_ID: 20260719_1600] 토론의 광장(CONF) 시스템 스키마 — 하이텔 (12)여론광장-1.토론의 광장.
-- 회의실 열기/닫기, 안건 발의(newcf), 안건 열람·재청(rdcf)을 위한 테이블.
-- (회기연장 ppconf/과거회의실 oldconf 등 주변부는 이번 범위 밖 — is_open으로 과거 조회는 가능.)
-- =============================================================================

-- 1. 회의실
CREATE TABLE IF NOT EXISTS public.conf_rooms (
  id             BIGSERIAL PRIMARY KEY,
  room_no        BIGINT NOT NULL,
  title          TEXT NOT NULL,
  owner_user_id  TEXT NOT NULL DEFAULT 'guest',
  owner_name     TEXT NOT NULL DEFAULT '손님',
  is_open        BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_rooms_room_no ON public.conf_rooms(room_no);
CREATE INDEX IF NOT EXISTS idx_conf_rooms_is_open ON public.conf_rooms(is_open);

-- 2. 안건 (회의실 내부)
CREATE TABLE IF NOT EXISTS public.conf_agendas (
  id             BIGSERIAL PRIMARY KEY,
  room_no        BIGINT NOT NULL REFERENCES public.conf_rooms(room_no) ON DELETE CASCADE,
  agenda_no      BIGINT NOT NULL,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL DEFAULT '',
  author_id      TEXT NOT NULL DEFAULT 'guest',
  author_name    TEXT NOT NULL DEFAULT '손님',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_agendas_room_no ON public.conf_agendas(room_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_agendas_room_agenda ON public.conf_agendas(room_no, agenda_no);

-- 3. 재청 (안건별 1인 1회 동의 보장)
CREATE TABLE IF NOT EXISTS public.conf_seconds (
  id             BIGSERIAL PRIMARY KEY,
  agenda_id      BIGINT NOT NULL REFERENCES public.conf_agendas(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_seconds_unique ON public.conf_seconds(agenda_id, user_id);
CREATE INDEX IF NOT EXISTS idx_conf_seconds_agenda_id ON public.conf_seconds(agenda_id);
