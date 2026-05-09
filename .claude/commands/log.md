---
description: 방금 한 작업을 WORK_LOG.md에 기록합니다. 작업 완료 후 실행.
---

방금 완료된 작업을 WORK_LOG.md에 기록합니다.

다음 순서로 진행하세요:

1. **현재 시각으로 LOG_ID 생성** (형식: YYYYMMDD_HHMM)
2. **WORK_LOG.md 파일 읽기** — 기존 내용 파악
3. **맨 위(기존 첫 항목 위)에 새 항목 추가**:

```markdown
## [YYYY-MM-DD HH:MM] {작업 제목}

**LOG_ID: YYYYMMDD_HHMM**
목표: {무엇을 왜 했는지 한 줄}
변경 파일:
- `{파일경로}` ({N}줄 {추가|수정|삭제})
수행 작업:
1) {단계별 설명}
2) ...
실행: `node scripts/sync-public-src.js`
기대: {브라우저에서 어떻게 보여야 하는지}
결과: ✅ 완료
```

4. **수정된 소스 파일에 LOG_ID 주석이 있는지 확인**
   - 없으면 주요 변경 위치에 `// [LOG: YYYYMMDD_HHMM] 설명` 추가

오늘 한 작업이 무엇인지 먼저 알려주세요.
