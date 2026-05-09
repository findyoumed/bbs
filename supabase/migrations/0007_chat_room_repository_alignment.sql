-- [LOG: 20260325_2130] 채팅방 저장소 metadata 정렬
-- [LOG: 20260407] 신규 프로젝트 대응: chat_rooms / chat_room_members CREATE TABLE 추가
-- 목적: chat_rooms를 현재 www-bbs 채팅방 API(no/roomId/maxUser/owner)에 맞게 정렬
-- 기존 ALTER TABLE 구문은 이미 테이블이 있는 프로젝트를 위해 그대로 유지

CREATE SEQUENCE IF NOT EXISTS public.chat_rooms_room_no_seq;

-- 신규 프로젝트: 전체 스키마로 생성
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_no          BIGINT DEFAULT nextval('public.chat_rooms_room_no_seq'),
  room_key         TEXT DEFAULT '',
  name             TEXT NOT NULL DEFAULT '대화방',
  description      TEXT NOT NULL DEFAULT '',
  owner_user_id    TEXT NOT NULL DEFAULT 'guest',
  owner_name       TEXT NOT NULL DEFAULT '손님',
  creator_id       UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  max_user         INT NOT NULL DEFAULT 99,
  password         TEXT NOT NULL DEFAULT '',
  is_private       BOOLEAN NOT NULL DEFAULT false,
  is_locked        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 채팅방 참여자 테이블 (기존 migration에 없었음 — 신규 추가)
CREATE TABLE IF NOT EXISTS public.chat_room_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname     TEXT NOT NULL DEFAULT '',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at      TIMESTAMPTZ NULL
);

-- 기존 프로젝트: 누락 컬럼 보충 (신규 프로젝트에서는 IF NOT EXISTS로 no-op)
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS room_no       BIGINT,
  ADD COLUMN IF NOT EXISTS room_key      TEXT,
  ADD COLUMN IF NOT EXISTS max_user      INTEGER NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS owner_name    TEXT NOT NULL DEFAULT '손님';

-- room_no 미설정 행 채우기
WITH base AS (
  SELECT COALESCE(MAX(room_no), 0) AS max_no
  FROM public.chat_rooms
),
ordered AS (
  SELECT id, row_number() OVER (ORDER BY COALESCE(created_at, now()), id) AS seq
  FROM public.chat_rooms
  WHERE room_no IS NULL
)
UPDATE public.chat_rooms rooms
SET room_no = base.max_no + ordered.seq
FROM ordered, base
WHERE rooms.id = ordered.id;

-- room_key 미설정 행 채우기
UPDATE public.chat_rooms
SET room_key = CASE
  WHEN room_no = 1 THEN 'lobby'
  ELSE 'room-' || room_no::text
END
WHERE COALESCE(room_key, '') = '';

-- owner 정보 미설정 행 채우기
UPDATE public.chat_rooms
SET owner_user_id = CASE
    WHEN COALESCE(owner_user_id, '') <> '' THEN owner_user_id
    WHEN creator_id IS NOT NULL THEN creator_id::text
    ELSE 'guest'
  END,
  owner_name = CASE
    WHEN COALESCE(owner_name, '') <> '' THEN owner_name
    WHEN creator_id IS NOT NULL THEN '회원'
    ELSE '손님'
  END,
  max_user = COALESCE(max_user, 99)
WHERE COALESCE(owner_user_id, '') = ''
   OR COALESCE(owner_name, '') = ''
   OR max_user IS NULL;

-- sequence 현재값 맞추기
SELECT setval(
  'public.chat_rooms_room_no_seq',
  GREATEST(COALESCE((SELECT MAX(room_no) FROM public.chat_rooms), 0), 1),
  true
);

-- NOT NULL 제약 설정
ALTER TABLE public.chat_rooms
  ALTER COLUMN room_no  SET DEFAULT nextval('public.chat_rooms_room_no_seq'),
  ALTER COLUMN room_no  SET NOT NULL,
  ALTER COLUMN room_key SET NOT NULL,
  ALTER COLUMN max_user SET NOT NULL,
  ALTER COLUMN owner_user_id SET NOT NULL,
  ALTER COLUMN owner_name    SET NOT NULL;

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_room_no       ON public.chat_rooms(room_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_room_key      ON public.chat_rooms(room_key);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_activity_at     ON public.chat_rooms(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room          ON public.chat_room_members(room_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user          ON public.chat_room_members(user_id, joined_at DESC);
