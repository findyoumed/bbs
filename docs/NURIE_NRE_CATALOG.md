# Nurie `.NRE` 참고자료 카탈로그

**LOG_ID: 20260827_1450**

`nurie15/ANSI1.NRE`~`ANSI4.NRE`는 위 네 파일과 바이트 단위로 동일하므로 중복 항목으로 등록하지 않는다. `nurie15`에만 있는 실행 파일은 에뮬레이터 변형이며 웹 렌더러 참고 범위가 아니다.

Nurie 에뮬레이터 배포본의 `.NRE` 샘플을 서비스 구현에 직접 실행하지 않고, ANSI/터미널 동작을 확인하는 참고자료로 목록화한다. 원본 파일은 저장소의 `nurie/` 폴더에 보존한다.

## 파일 목록

| 파일 | 크기(byte) | SHA-256 | 참고 용도 |
| --- | ---: | --- | --- |
| `nurie/ANSI1.NRE` | 1,085 | `9B736F2AD117A163C1C03EA4D79DE45D4565738D17E5CF0B22630A64B76F6711` | 기본 ANSI 화면·커서 이동 샘플 |
| `nurie/ANSI2.NRE` | 1,715 | `7EB408C11BF5E4C520ADF683BE85557D8B0AF68827DC40CFE0EE0EDA92CF7AFC` | 색상·줄 단위 제어 샘플 |
| `nurie/ANSI3.NRE` | 1,336 | `35727D4388CB6D85CA8A2DE5CB31A90E5872CE909EA3B23B0C2E4ABDAE73B311` | 화면 지우기·반복 제어 샘플 |
| `nurie/ANSI4.NRE` | 2,573 | `F28F7A3CCE5F1DA08E3C57B2486A2AB8E002EFEC411A9CCB308A6E8BB34C22CB` | 복합 ANSI/CSI 화면 샘플 |

## 현재 프로젝트 적용 범위

- 브라우저 렌더러(`public/js/core/ansiRenderUtils.js`)는 샘플에서 확인할 수 있는 공통 CSI 범위를 우선 지원한다.
- 지원 범위에는 커서 위치·상대 이동(`H/f`, `A/B/C/D`, `E/F/G`, `d`), 화면·행 지우기(`J/K`), 문자·행 삽입/삭제(`@/P/L/M`), 스크롤 영역·스크롤(`r/S/T`), 커서 저장·복원(`s/u`), 색상(`m`)이 포함된다.
- Nurie 전용 파일 포맷, 모뎀 통신, DOS 화면 버퍼, 사운드·키보드 드라이버는 웹 서비스 범위가 아니므로 이 카탈로그의 참고 대상에서 제외한다.
- 해석되지 않는 제어열은 기존 안전 동작(제어문자 제거 또는 무시)을 유지하여 게시판·쪽지 화면의 텍스트가 깨지지 않도록 한다.

## 재검증 방법

```powershell
Get-ChildItem nurie -Filter *.NRE | Get-FileHash -Algorithm SHA256
npm run smoke:go-ansi
```

해시가 변경되면 원본 샘플이 교체된 것이므로 표의 해시와 변경 로그를 함께 갱신한다.
