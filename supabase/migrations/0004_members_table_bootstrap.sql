CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE INDEX IF NOT EXISTS idx_members_nick_name ON public.members(nick_name);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);

INSERT INTO public.members (user_id, nick_name, level, is_admin)
VALUES
  ('guest', '손님', 1, false),
  ('sysop', '시스옵', 99, true)
ON CONFLICT (user_id) DO NOTHING;
