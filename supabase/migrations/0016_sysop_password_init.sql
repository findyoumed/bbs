-- [LOG: 20260411_2300] 운영자(sysop) 비밀번호 초기 설정
-- 목적: 시스템 관리자 계정의 초기 비밀번호를 cc31133113으로 설정

-- 1. members 테이블의 sysop 비밀번호 업데이트
UPDATE public.members
SET password = 'cc31133113',
    updated_at = now()
WHERE user_id = 'sysop';

-- 2. 만약 sysop 계정이 없다면 생성 (idempotent)
INSERT INTO public.members (user_id, nick_name, password, level, is_admin)
VALUES ('sysop', '시스옵', 'cc31133113', 99, true)
ON CONFLICT (user_id) DO UPDATE SET
  password = EXCLUDED.password,
  level = 99,
  is_admin = true,
  updated_at = now();
