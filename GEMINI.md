# GEMINI.md

이 파일은 이 저장소에서 Gemini CLI / Gemini Code (Antigravity 포함) 에이전트가 따라야 하는 **프로젝트 메모리 파일**입니다.

> **중요**: 모든 공통 프로젝트 규칙, 아키텍처 상세, 코딩 표준은 **[AGENTS.md](file:///d:/work/bbs/www-bbs/AGENTS.md)**에 정의되어 있습니다. Gemini는 항상 AGENTS.md를 최우선으로 준수해야 합니다.

---

## 1. Gemini 전용 정책 및 워크플로우

### 1.1 권한 및 자동 실행
- 이 저장소에서는 `.gemini/settings.json` 설정에 따라 `AGENTS.md`와 `GEMINI.md`를 함께 읽습니다.
- **YOLO 모드 활성화**: `gemini -y` 또는 `--approval-mode=yolo` 환경을 지향하며, 가능한 한 승인 질문 없이 작업을 진행합니다.
- 단, `git push` 및 외부 서비스 연동 확대는 반드시 사용자 승인이 필요합니다.

### 1.2 작업 단계
1. **분석**: `WORK_LOG.md`와 소스 코드를 읽고 요구사항을 완벽히 이해합니다.
2. **계획**: 수행할 단계를 정리하여 사용자에게 보고합니다.
3. **실행**: **코드 생략 없이** 전체 코드를 작성합니다.
4. **검증**: `node --check` 및 `npm run smoke` 명령어로 작업물을 검증합니다.
5. **기록**: `WORK_LOG.md`에 `LOG_ID`와 함께 결과를 남깁니다.

---

## 2. Gemini를 위한 핵심 리마인더

1. **코드 생략 절대 금지 (FULL FILE CONTENT)**:
   - 수정 사항이 단 한 줄이라도 **파일 전체 내용을 출력**해야 합니다.
   - `// ... 기존 코드` 같은 생략형 표현은 금지됩니다.
2. **추측 대신 질문**:
   - 불확실한 경로나 의도는 추측하지 말고 질문하십시오.
3. **바닐라 JS 준수**:
   - 프레임워크(React/Vue)나 TypeScript 사용 제안을 하지 마십시오.
4. **로직 보호**:
   - 기존의 인증이나 상태 관리 로직을 수정할 때는 반드시 그 이유를 설명해야 합니다.

---

## 3. 검증 및 도구 활용

- `npm run dev`: 개발 서버 실행
- `npm run smoke:vercel-ready`: 배포 전 자산 및 API 검증
- `npm test`: 유닛 테스트
- `node --check [file]`: 문법 오류 확인 (수정 후 매번 실행 권장)

---

## 4. 아키텍처 요약
(상세 내용은 [AGENTS.md](file:///d:/work/bbs/www-bbs/AGENTS.md) 참조)

- **Front-end**: `public/js/core/` 내의 모듈화된 팩토리 함수들.
- **Back-end**: `src/server/` 내의 레포지토리 패턴 (Memory/Supabase 듀얼 모드).
- **Terminal UI**: 80x24 ANSI 텍스트 기반 인터페이스.
