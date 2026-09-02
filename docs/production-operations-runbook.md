# www-bbs Production 운영 런북

이 문서는 `01410.vercel.app` Production 장애를 확인하고 안전하게 복구하기 위한
재현 가능한 점검 절차입니다. 비밀값(API key, DB 비밀번호, 토큰)은 로그·문서·커밋에
기록하지 않습니다.

## 현재 운영 경계

- Vercel 프로젝트: `bbs`
- Production 도메인: `https://01410.vercel.app`
- 저장소 드라이버: Production에서는 Supabase를 사용하며, 저장소 초기화 실패를
  Memory 저장소로 조용히 대체하지 않습니다.
- 공개 API: 게시판 목록·메뉴·게스트 프로필 등 읽기 전용 경로
- 보호 API: 메모, 게시글 작성, 시삽 건의, 채팅·대화실 생성, 투표, 회원 통계
- 공개 CORS 허용 origin: `https://01410.vercel.app`

## 점검 순서

PowerShell에서 저장소 루트(`D:\work\bbs\www-bbs`)로 이동한 뒤 실행합니다.

```powershell
npm run check
npm run qa:final
npm run smoke:vercel-env
npm run smoke:supabase-security
npm run smoke:production
npm run smoke:mobile
npm run smoke:full-traversal
npm run loop:verify
npm run build
```

`smoke:production`은 보호 API의 비로그인 경계(401/403), `/api/health`, CORS,
오류 응답의 비밀값 노출 여부를 함께 검사합니다. 현재 기준 검사는 23개입니다.
`smoke:vercel-env`는 Vercel CLI 인증이 된 운영자 환경에서 값 없이 필수 변수와
secret 유형만 확인합니다. `smoke:supabase-security`는 보안 마이그레이션의 공개
함수 revoke·search_path 고정·FK 인덱스 계약을 로컬에서 회귀 검사합니다.

## 장애 판별

1. `npm run smoke:production`에서 `/api/health`가 503이면 Supabase 연결 또는
   저장소 probe 실패입니다. 응답 본문에 upstream 오류·접속 문자열이 없어야 합니다.
2. Vercel MCP에서 다음을 확인합니다.
   - 최신 Production 배포 `readyState=READY`
   - `01410.vercel.app` 도메인 연결
   - Runtime Errors의 `lastDeployment`가 최신 배포인지
   - 같은 오류가 최신 배포 시간대에도 반복되는지
3. Supabase MCP에서 프로젝트 상태가 `ACTIVE_HEALTHY`인지 확인하고, 공개 권한과
   RLS 스냅샷을 조회합니다.

## Vercel 환경변수 점검

환경변수 값은 절대 출력하지 않고 이름과 대상 환경만 확인합니다.

```powershell
npx --yes vercel@latest env list production --json |
  ConvertFrom-Json |
  Select-Object -ExpandProperty envs |
  Select-Object key,type,visibility,target
```

Production에 필요한 항목은 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ACTIVITY_REPOSITORY_DRIVER`, `SUPABASE_ACTIVITY_TABLE`, `BBS_ALLOWED_ORIGINS`,
`RESEND_API_KEY`, `SYSOP_EMAIL`, `SYSOP_MAIL_FROM`입니다. URL·서비스 키·Resend 키는
Vercel에서 secret 유형으로 보관해야 합니다.

현재 `DATABASE_URL`, `SUPABASE_DB_PASSWORD`, `CLAUDEMCP_TOKEN`은 애플리케이션
런타임 코드에서 참조되지 않으며, Production에 남겨둘 이유가 없다면 별도 승인 후
삭제하거나 secret 유형으로 재등록합니다. 이 런북은 값을 변경하거나 삭제하지 않습니다.

```sql
select
  (select count(*) from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated'))
    as public_table_grants,
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public'
     and grantee in ('public', 'anon', 'authenticated')
     and privilege_type = 'EXECUTE') as public_execute_grants,
  (select count(*) from pg_tables
   where schemaname = 'public' and rowsecurity) as rls_enabled_tables;
```

현재 보안 기준은 공개 테이블 권한 0, 공개 함수 실행 권한 0, 공개 테이블 RLS
활성화입니다. 서버는 `service_role`로만 내부 테이블에 접근합니다.

## 백업·복구 기준

현재 조직은 Free 플랜이므로 Pro·Team·Enterprise 플랜의 자동 일일 백업과 PITR을
기대할 수 없습니다. Supabase 공식 [Database Backups 문서](https://supabase.com/docs/guides/platform/backups)처럼
Free 프로젝트는 정기적으로 Supabase CLI `db dump`를 실행하고, 결과를 별도 보관소에
복사하는 방식으로 복구 지점을 만듭니다. 백업 파일에는 비밀값을 포함하지 않으며,
복구 리허설은 별도 프로젝트에서 수행합니다.

현재 MCP에서 확인 가능한 개발 브랜치는 없으며(`branches: []`), Production 복구나
백업 생성은 이 런북의 자동 점검 범위를 벗어납니다. 실제 백업을 만들거나 복구할 때는
다운타임·보관 위치·접근 권한을 먼저 승인받고 진행합니다.

## Supabase Auth 수동 설정

현재 프로젝트 조직 플랜은 **Free**입니다. Supabase 공식 문서상 Leaked Password
Protection은 Pro 플랜 이상에서 제공되므로 Free 플랜에서는 메뉴 자체가 표시되지
않습니다.

플랜을 업그레이드한 뒤에는 Dashboard의 다음 경로에서 설정합니다.

`Authentication → Providers → Email` (또는 프로젝트별 Email Auth 설정 화면)

여기서 **Leaked Password Protection / Prevent leaked passwords**를 활성화하고,
회원가입·비밀번호 변경 스모크를 다시 실행합니다. 이 설정은 현재 연결된 MCP 도구에서
변경할 수 없으므로 Dashboard에서 적용해야 합니다.

## 복구 원칙

- 환경변수 값 자체를 출력하거나 클라이언트 번들에 넣지 않습니다.
- Supabase 키를 바꾼 경우 Vercel Production 환경변수에 서버 전용
  `SUPABASE_SERVICE_ROLE_KEY`가 설정됐는지만 확인하고, 값은 로그에 남기지 않습니다.
- `/api/health`가 degraded일 때 Memory fallback을 강제로 켜지 않습니다. 원인을
  확인하고 새 배포 후 Production 스모크를 다시 실행합니다.
- 보호 API의 401/403 경계나 ANSI UI를 우회하는 임시 수정은 하지 않습니다.
- 복구 배포·환경변수 변경·마이그레이션은 별도 승인 후 수행합니다.

## 최근 검증 기준

- Supabase 보안 마이그레이션 `0030_security_rpc_and_fk_indexes` 적용 완료
- Production smoke 23/23
- 모바일 전체 viewport smoke 통과
- 전체 탐색 smoke 및 `loop:verify` 통과
- 마지막 확인에서 과거 배포의 `Unregistered API key` 로그가 남아 있었으나 최신
  Production 배포에서는 재현되지 않음
