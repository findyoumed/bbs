# OAuth 회원가입 구현 핸드오프 문서

작성일: 2026-04-14  
작업 상태: **구현 완료, 브라우저 검증 필요**

---

## 구현한 기능

구글/카카오 OAuth 가입 시 **userId(아이디)와 nickName(이용자명)을 사용자가 직접 입력**하는 폼을 추가.

### 선택한 방식 (Method A)
OAuth 리디렉트 **전에** 아이디/닉네임 입력 폼을 보여줌:

```
가입 방식 선택 → 이용약관 동의(Y) → 아이디/닉네임 입력 폼
→ [입력값을 localStorage에 저장] → OAuth 리디렉트 → 콜백 복귀
→ initAuth()에서 localStorage 확인 → /api/members/oauth-register 호출
→ 회원 등록 완료 → 메인 화면
```

---

## 변경된 파일 목록

### 서버 (백엔드)

#### `src/server/routeHandlers/memberAuthRoutes.js`
- **추가**: `POST /api/members/oauth-register` 엔드포인트
- Bearer 토큰으로 Supabase 사용자 확인
- userId 형식 검증 (`/^[a-zA-Z0-9_]{3,20}$/`)
- 중복 확인 후 `ensureMember` + `syncMemberAuthProfile` 호출
- 해당 함수들이 없으면 직접 Supabase에 insert하는 fallback 포함할 것 (구현 시 확인 필요)

### 브라우저 (프론트엔드)

#### `public/js/core/signupState.js`
- **추가**: localStorage 기반 OAuth 프로필 상태 관리
  - `OAUTH_PROFILE_KEY = '01410-oauth-pending-profile'`
  - `getPendingOAuthProfile()` / `setPendingOAuthProfile(profile)` / `clearPendingOAuthProfile()`

#### `public/js/core/signupScreens.js`
- **추가**: `renderOAuthProfileScreen(options)` 함수
  - 2개 필드: `#signup-oauth-userid`, `#signup-oauth-nickname`
  - return 객체에 포함

#### `public/js/core/signupOAuthProfile.js` (신규 파일)
- `createSignupOAuthProfileHandler(deps)` — 팩토리 함수
- `attachOAuthProfileEvents(handlers, { provider, label })` export
- 필드 포커스 이동: Enter/ArrowDown → 다음 필드, ArrowUp → 이전 필드
- `submitProfile()`: 유효성 검사 → 중복 확인(`searchMember`) → `setPendingOAuthProfile` → `startSignupOAuth(provider)` (리디렉트)

#### `public/js/core/signupAgreement.js`
- **변경**: `handleOAuth(method, handlers)` — OAuth 선택 시 바로 리디렉트 대신 프로필 폼으로 전환
- **변경**: `attachAgreementEvents` 내부 순서 재정렬 (`runSignupChoice` 정의 후 `setSignupAgreeFooterHint` 호출)
- **변경**: `setSignupAgreeFooterHint(runChoice)` wrapper에 `runChoice` 파라미터 추가

#### `public/js/core/signupModule.js`
- **추가**: `import { createSignupOAuthProfileHandler }` from `./signupOAuthProfile.js`
- **추가**: `SIGNUP_OAUTH_HINTS`, `SIGNUP_OAUTH_CONFIRM_HINT` 상수
- **추가**: `setSignupAgreeFooterHint(runChoice)` 함수 (hintEl에 동의 입력창 렌더링)
- **추가**: `setOAuthProfileFooterHint(runChoice, focusField)` 함수
- **확장**: `commonDeps`에 OAuth 관련 deps 모두 포함
- **추가**: `handlers.attachOAuthProfileEvents` 연결

#### `public/js/core/authService.js`
- **변경**: `initAuth()` — 세션 복원 후 localStorage에 pending OAuth 프로필 있으면 `/api/members/oauth-register` 호출 후 삭제

#### `public/js/core/routingModule.js`
- **변경**: `updateURL()` — `state._signupFlow === 'oauth-profile'` → URL `/signup/profile` 매핑

---

## 회원가입 플로우 전체 (변경 후)

`state._signupFlow` 값으로 화면 구분:

| `_signupFlow` | 화면 | 하단 힌트 |
|---|---|---|
| `'menu'` | 가입 방식 선택 (1:이메일 2:구글 3:카카오) | 프롬프트 표시 |
| `'agree'` | 이용약관 동의 | `#cmd-hint`에 입력창 (동의:y 취소:n) |
| `'email'` | 이메일 폼 (5개 필드) | `#cmd-hint`에 신청확인 입력창 |
| `'oauth-profile'` | 아이디/닉네임 폼 (2개 필드) | `#cmd-hint`에 신청확인 입력창 |

---

## 테스트 체크리스트

### 이메일 가입 (기존 기능 — 회귀 확인)
- [ ] 1 선택 → 이용약관 화면 → y 입력 → 이메일 폼 표시
- [ ] 폼 작성 → Enter/y → 가입 처리 → 메인 화면 이동
- [ ] 중복 아이디 → 에러 메시지 표시

### OAuth 가입 (신규 기능)
- [ ] 2(구글) 또는 3(카카오) 선택 → 이용약관 화면 표시
- [ ] 이용약관 화면 하단에 `동의확인 [입력창] (동의:y 취소:n)` 표시 확인
- [ ] y 입력 → Enter → **아이디/닉네임 입력 폼** 표시 확인  ← **이 단계가 문제였음**
- [ ] 폼에서 아이디, 닉네임 입력 → y → OAuth 리디렉트 발생
- [ ] OAuth 인증 완료 후 복귀 → 자동으로 회원 등록 → 메인 화면
- [ ] 중복 아이디 입력 시 에러 메시지

### n/취소 처리
- [ ] 이용약관에서 n → 메인 화면으로 돌아감
- [ ] 아이디/닉네임 폼에서 n → 가입 방식 선택 메뉴로 돌아감

---

## 현재 상태 및 미확인 사항

### 방금 수정된 버그
`signupAgreement.js`에서 `setSignupAgreeFooterHint()` 호출이 `runSignupChoice` 정의 이전에 있어 no-op였음.
`commonDeps`에 `setSignupAgreeFooterHint` 함수 자체도 빠져 있었음.
→ 두 가지 모두 수정 완료.

### 확인 필요 사항

1. **`/api/members/oauth-register` 엔드포인트 동작 검증**  
   서버에서 `ensureMember`, `syncMemberAuthProfile` 함수 존재 여부 확인 필요.  
   없으면 직접 Supabase insert 로직으로 구현해야 함.

2. **OAuth 콜백 후 `initAuth()` 실행 순서**  
   `state.token`이 세션 복원 직후 올바르게 설정되어야 `/api/members/oauth-register` 인증 헤더가 유효함.

3. **Supabase `signInWithOAuth` redirectTo 설정**  
   현재 `window.location.origin + '/'`로 설정. 서비스 환경 URL과 일치해야 함.

4. **카카오 OAuth provider ID**  
   Supabase에서 카카오 provider는 `'kakao'`로 등록되어야 함 (대소문자 주의).

---

## 핵심 아키텍처 메모

- **DOM 구조**: `#terminal-screen` ← `screenEl`, `#cmd-hint` ← `hintEl`, `#terminal-prompt-row` ← 이메일/OAuth 폼 단계에서 `display:none`
- **Enter 가로채기**: `state._signupEnterHandler(raw)` — cmdInput Enter 발생 시 호출. 회원가입 단계에서만 active.
- **팩토리 패턴**: 모든 핸들러는 `createXxx(deps)` 형태로 deps 주입. `commonDeps`가 공통 의존성 허브.
- **localStorage 키**: `'01410-oauth-pending-profile'` — OAuth 리디렉트 전후 데이터 보존용
- **`signupOAuthProfile.js`의 early return**: `inputs[0]` 또는 `inputs[1]` (OAuth 폼 input들)이 DOM에 없으면 즉시 return. `renderOAuthProfileScreen` 호출 후 동기적으로 `attachOAuthProfileEvents` 호출하므로 정상 상황에서는 항상 found여야 함.

---

## 관련 파일 (읽기 참고용)

```
public/js/core/signupModule.js          ← 회원가입 전체 조합 (진입점)
public/js/core/signupState.js           ← 상태 관리 (localStorage 포함)
public/js/core/signupScreens.js         ← 화면 렌더러
public/js/core/signupMenu.js            ← 가입 방식 선택 핸들러
public/js/core/signupAgreement.js       ← 이용약관 동의 핸들러
public/js/core/signupEmailForm.js       ← 이메일 폼 핸들러
public/js/core/signupOAuthProfile.js    ← OAuth 아이디/닉네임 폼 핸들러 (신규)
public/js/core/authService.js           ← initAuth() (OAuth 콜백 처리)
src/server/routeHandlers/memberAuthRoutes.js  ← /api/members/oauth-register
```
