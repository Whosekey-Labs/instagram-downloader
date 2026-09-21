# 오픈소스 및 배포 조사

확인일: 2026-09-22. 실제 저장소 및 공식 문서 기준이며 도구의 유지보수가 현재 Instagram 접근 성공을 보장하지는 않습니다.

| 프로젝트 | 라이선스와 상태 | 활용 판단 |
| --- | --- | --- |
| [SocialSnag](https://github.com/jamditis/socialsnag) | MIT. 소스와 LICENSE 직접 확인. Manifest V3, Instagram 사진/릴스/캐러셀 처리 | 브라우저 확장에 적합. 후보 선택·웹 요청 구성을 참고해 계정 단위 기능을 새로 작성. MIT 고지 보존 |
| [Instaloader](https://github.com/instaloader/instaloader) | [MIT](https://github.com/instaloader/instaloader/blob/master/LICENSE). Python 기반 계정/게시물 다운로드 | 계정 수집·중단 처리 구조 참고. Chrome에서 직접 실행할 수 없어 런타임 채택하지 않음 |
| [InstagramDownloader](https://github.com/igdownloader/InstagramDownloader) | 유지관리자 모집 공지. 루트에 명확한 LICENSE 확인 안 됨 | 기능 비교에만 사용. 소스 재사용하지 않음 |

선택안은 작은 독립 Manifest V3 확장입니다. Python 서비스는 별도 서버 운영 및 세션 전달이 필요하고, 과거 확장 전체 포크는 오래된 구조와 라이선스 검토 비용이 있습니다. 외부 런타임 의존성 없이 현재 필요한 기능만 구현하는 편이 설치 및 스토어 심사 설명이 단순합니다.

유료 Turbo Downloader는 기능 요구를 이해하기 위한 제품 참고이며 소스나 이미지 자산을 가져오지 않았습니다. 결제 우회 기능이 아니라 독립된 무료 구현입니다.

## 배포 요건

- [개발자 등록](https://developer.chrome.com/docs/webstore/register): 게시 전 개발자 계정 등록과 일회성 등록비가 필요합니다. 실제 금액과 기존 납부 여부는 대시보드에서 확인해야 합니다.
- [게시 절차](https://developer.chrome.com/docs/webstore/publish): ZIP 업로드 후 스토어 설명, 개인정보 및 권한 사유, 배포 설정, 테스트 지침을 작성하고 심사를 요청합니다.
- [심사 절차](https://developer.chrome.com/docs/webstore/review-process): 심사 기간과 승인은 확정할 수 없습니다. 코드 준비와 심사 제출/승인을 구분해야 합니다.
- [이미지 요건](https://developer.chrome.com/docs/webstore/images): 128px 아이콘, 440×280 작은 홍보 이미지, 1280×800 또는 640×400 스크린샷 최소 1개.
- [개인정보 고지 요건](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): 로컬 처리라고 개인정보 관련 설명을 생략하지 않습니다. 실제 처리 항목과 목적을 기재합니다.
- [로컬 확장 설치](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world): 개발자 모드의 압축해제 확장 로드는 스토어 심사와 독립적입니다.

## 구현 참고

- [Chrome downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads): 다운로드 ID 반환은 완료가 아님. 상태가 complete인지 확인하고 interrupted를 실패로 표시.
- [콘텐츠 스크립트](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts): Instagram 페이지와 분리된 실행 환경에서 같은 출처 요청 수행. 외부 페이지 postMessage를 권한 있는 명령으로 받지 않음.

## 현재 확인된 실환경

앱 내 브라우저에서 `https://www.instagram.com/meta/` 프로필 및 게시물 링크가 로그아웃 상태로 표시되었습니다. 이는 프로필 페이지 열람 증거이며 확장의 API 조회 또는 파일 저장 성공 증거는 아닙니다. Chrome 웹스토어 개발자 대시보드는 Google 재인증 후 접근됐지만 판매자 선언, 공개 연락처 이메일 및 조직 인증의 추가 조치를 요구했습니다.
