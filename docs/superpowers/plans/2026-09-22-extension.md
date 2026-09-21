# Open Media Downloader Implementation Plan

**Goal:** 계정 단위 미디어 다운로드 확장과 로컬 설치·스토어 제출 자료 제공.
**Architecture:** 작업 탭이 Instagram 콘텐츠 스크립트에 조회를 요청하고 Chrome 다운로드 API로 순차 저장한다.
**Tech Stack:** Manifest V3, ES modules, Node 내장 테스트 및 빌드 도구.
**Spec:** [설계](../specs/2026-09-22-extension-design.md)

## 제약

- 한국어 UI, MIT, 런타임 외부 의존성 및 서버 없음.
- 접근 가능한 콘텐츠만 처리. 로그인/챌린지/429 자동 재시도 금지.
- 확장 스토어 등록과 로컬 설치 검증을 구별하고 확인된 결과만 보고.

## 실행 순서

- [x] `tests/core.test.js`에 `parseUsername`, `normalizePage`, `mediaFilename`, `validateMediaUrl`, `classifyResponse` 동작 테스트를 작성하고 실패 확인.
- [x] `src/lib/core.js` 구현. 입력·CDN·캐러셀·페이지 커서 및 완료 기록 검증.
- [x] `tests/queue.test.js`에서 실패 파일 재처리, 취소, 중복 건너뛰기를 검증한 뒤 `src/lib/queue.js` 구현.
- [x] `manifest.json`, `src/background.js`, `src/content.js`, `src/lib/bridge.js`에 확장 메시지 경계 및 Instagram 요청 구현.
- [x] `src/app.html`, `src/app.css`, `src/app.js`에 실제 작업 UI 연결. 미디어 텍스트는 `textContent`로만 렌더링.
- [x] `scripts/build.mjs`, `check.mjs`, `package.mjs`, `preview.mjs`로 재현 가능한 빌드 및 검증. 개발용 미리보기는 출시 패키지에서 제외.
- [x] `README.md`, `PRIVACY.md`, `THIRD_PARTY_NOTICES.md`, `docs/research.md`, `store/listing.md`와 스토어 이미지 준비.
- [ ] 자동 검사와 브라우저 UI 검증, 사용자 제공 `@meta` 실서비스 접근 확인. 로컬 설치 및 Google 재인증의 남은 작업 기록.
- [ ] 공개 저장소와 GitHub Release 배포, 개인정보처리방침 URL 확보. 개발자 대시보드 상태에 따라 심사 제출 또는 정확한 차단 단계 기록.
