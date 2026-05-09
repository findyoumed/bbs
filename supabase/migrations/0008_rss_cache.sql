-- [LOG: 20260326_1605] RSS 지속 캐시 테이블 추가

CREATE TABLE IF NOT EXISTS public.rss_cache (
  cache_key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rss_cache_expires_at
  ON public.rss_cache(expires_at);
