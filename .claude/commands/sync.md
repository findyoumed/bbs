---
description: 브라우저 자산 계약을 검증합니다. 코드 수정 후 실행.
---

**참고:** `scripts/sync-public-src.js`는 삭제되었습니다.
브라우저 파일(`public/js/`)은 직접 수정하면 되며, sync 단계가 없습니다.

대신 자산 계약을 검증합니다:

```bash
npm run smoke:vercel-ready
```

실행 후:
1. 모든 항목이 `ok`이면 성공
2. 실패 항목이 있으면 해당 파일 경로를 확인

실패 시 확인사항:
- `public/js/main.js`가 올바른 모듈을 import하는지 확인
- `public/js/core/` 또는 `public/js/ui/` 경로가 맞는지 확인
