# 배포 및 심사 상태 · 0.2.0

## 준비한 자료

- `release/open-media-downloader-0.2.0.zip`: 설치 및 업로드 패키지
- `release/open-media-downloader-0.2.0.zip.sha256`: 무결성 값
- `store/assets/icon128.png`, `promo440.png`: 아이콘 및 홍보 이미지
- `store/assets/screenshot-inline-demo.png`: 실제 확장 UI를 예시 프로필에 띄운 검증용 이미지. 실제 Instagram 다운로드 증거가 아니며 심사 제출 전 실환경 캡처로 교체 권장
- `store/listing.md`: 스토어 설명, 단일 목적, 권한 사유, 개인정보 선언 참고, 테스트 지침
- 공개 개인정보처리방침: https://whosekey-labs.github.io/instagram-downloader/privacy.html

## 제출 차단 단계

이전 대시보드 확인에서 게시자 계정은 존재했으나 판매자/비판매자 선언, 공개 연락처 이메일, 조직 등록 및 주소 증빙을 요구했습니다. 이를 임의로 결정하거나 사용자 서류를 제출하지 않았습니다. **ZIP 업로드 및 심사 접수는 미완료**입니다.

1. 사용자가 로컬 확장을 설치하고 실제 사진/영상 저장 확인.
2. 개발자 대시보드에서 본인의 게시자 선언·연락처·조직 인증 완료.
3. 새 버전 ZIP, 설명 및 이미지 등록.
4. 개인정보/권한/테스트/배포 항목을 실제 구현에 맞게 입력.
5. 심사 요청 후 항목 ID, 버전과 접수 상태를 확인.

로컬 확장 설치는 스토어 심사와 별개입니다. 자동 브라우저 도구는 `chrome://extensions` 접근을 URL 보안 정책으로 차단하므로 사용자가 직접 압축해제 확장 로드를 수행해야 합니다. 정책 우회를 시도하지 않습니다.
