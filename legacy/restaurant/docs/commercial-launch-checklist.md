> HISTORICAL RESTAURANT RECORD — inactive for TAERYNEX. Do not execute these deployment, account, or database procedures. See ../../../README.md for the local marketing candidate and H10 cutover gate.

# 상업 배포 최종 체크리스트

이 문서는 운영자가 실제 사업 정보와 외부 계정 화면에서 직접 확인해야 하는 항목만 정리합니다.

## 1. 사업 정보

- 상호, 주소, 전화번호, 영업시간이 실제 매장 정보와 일치하는지 확인합니다.
- 메뉴명, 세트 구성, 가격대가 최신 메뉴판과 일치하는지 확인합니다.
- 예약 가능 여부와 단체 이용 가능 여부는 네이버 플레이스와 전화 응대 기준으로 확인합니다.
- 잘못된 정보가 있으면 `src/data/siteData.js`를 수정한 뒤 재배포합니다.

## 2. 사진 사용 권리

- 홈페이지에 들어간 음식·매장 사진은 직접 촬영했거나 사용 허락을 받은 사진만 유지합니다.
- 네이버 방문자 리뷰 사진, 블로그 사진, 타 플랫폼 사진은 작성자 허락 없이 홈페이지에 복제하지 않습니다.
- 허락받은 리뷰 사진만 공개 리뷰 데이터의 `isCommercialUseApproved`를 `true`로 바꿔 노출합니다.

## 3. 리뷰 운영

- 리뷰 원문, 작성자 표시명, 날짜, 사진은 상업 사용 허락이 확인된 항목만 노출합니다.
- 자동 크롤링 방식은 사용하지 않습니다.
- 최신 리뷰와 평점은 네이버 플레이스 링크로 확인하도록 유지합니다.

## 4. 개인정보

- 고객 문의, 예약 폼, 파일 업로드처럼 개인정보를 직접 수집하는 기능을 추가할 경우 개인정보 처리방침을 별도 페이지로 게시합니다.
- 수집 목적, 수집 항목, 보관 기간, 파기 방법, 문의 연락처를 명확히 작성합니다.
- 현재 공개 홈페이지는 고객 개인정보를 직접 수집하지 않는 구조입니다.

## 5. 도메인

- 상업 운영 전 Vercel `Settings > Domains`에서 실제 도메인을 연결합니다.
- 도메인 변경 후 아래 값을 새 도메인으로 교체합니다.

```text
index.html canonical, og:url, twitter:url, og:image
src/data/siteData.js siteUrl
public/sitemap.xml
public/robots.txt
docs/launch-checklist.md
```

## 6. 검색 등록

- 네이버 서치어드바이저에 사이트를 등록합니다.
- Google Search Console에도 사이트를 등록합니다.
- 사이트맵 URL은 아래 값을 제출합니다.

```text
https://eulwangri-donghae-homepage.vercel.app/sitemap.xml
```

## 7. 배포 전 검증

배포 전 아래 명령을 모두 통과시킵니다.

```bash
npm run build
npm run security:check
npm run launch:check
npm audit --audit-level=moderate
```

배포 후 아래 명령으로 실제 운영 헤더를 확인합니다.

```bash
npm run security:headers -- https://eulwangri-donghae-homepage.vercel.app
```

## 8. 실기기 확인

- 갤럭시 Chrome에서 첫 화면, 메뉴, 매장소개, 리뷰, 찾아오시는길, 이용안내, 관리자 로그인을 확인합니다.
- 아이폰 Safari에서 같은 화면을 확인합니다.
- 카카오톡, 문자, 네이버 블로그 공유 시 제목과 대표 이미지가 정상 표시되는지 확인합니다.
