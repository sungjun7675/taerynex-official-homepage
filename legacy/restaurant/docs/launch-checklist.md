> HISTORICAL RESTAURANT RECORD — inactive for TAERYNEX. Do not execute these deployment, account, or database procedures. See ../../../README.md for the local marketing candidate and H10 cutover gate.

# 홈페이지 공개 운영 체크리스트

이 문서는 Vercel 운영 배포 이후 계정 화면에서 직접 확인해야 하는 작업만 정리합니다.

## 1. 네이버 서치어드바이저 등록

1. 네이버 서치어드바이저에 접속합니다.
2. 사이트 등록 URL에 아래 주소를 입력합니다.

```text
https://eulwangri-donghae-homepage.vercel.app/
```

3. 소유 확인 방식은 `HTML 태그`가 가장 빠릅니다.
4. 네이버가 제공하는 인증 메타태그를 `index.html`의 `<head>` 안에 추가합니다.

```html
<meta name="naver-site-verification" content="네이버에서_받은_값" />
```

5. 코드 반영 후 다시 배포하고, 서치어드바이저에서 소유 확인을 완료합니다.
6. 사이트맵 제출 메뉴에 아래 주소를 제출합니다.

```text
https://eulwangri-donghae-homepage.vercel.app/sitemap.xml
```

## 2. 카카오톡/문자 공유 썸네일 확인

1. 카카오톡 채팅방에 홈페이지 주소를 붙여넣습니다.
2. 대표 이미지가 조개구이 사진으로 뜨는지 확인합니다.
3. 이전 이미지가 계속 보이면 카카오 공유 디버거에서 URL 캐시를 초기화합니다.
4. 문자, 네이버 블로그, 인스타그램 DM에서도 제목과 대표 이미지가 정상 표시되는지 확인합니다.

## 3. 도메인 연결

도메인을 구매한 뒤에만 진행합니다.

1. Vercel 프로젝트 `Settings > Domains`에 도메인을 입력합니다.
2. 도메인 DNS에 `CNAME` 레코드를 추가합니다.

```text
www 또는 원하는 서브도메인 -> cname.vercel-dns.com
```

3. 코드에서 아래 값들을 새 도메인으로 변경합니다.

```text
index.html canonical, og:url, twitter:url, og:image
src/data/siteData.js siteUrl
public/sitemap.xml
public/robots.txt
```

4. Vercel에서 SSL 인증서가 발급됐는지 확인합니다.

## 4. 네이버 평점 표시 기준

현재 네이버 검색 결과에서 `리뷰 3,351`은 확인했지만, `4.85` 평점은 같은 화면에서 확인되지 않았습니다.

평점을 홈페이지에 고정 표시하려면 아래 중 하나가 필요합니다.

1. 네이버 플레이스에 평점이 실제로 노출된 화면 캡처
2. 매장주센터에서 확인 가능한 공식 평점 화면
3. 평점 표시를 빼고 `리뷰 3,351`처럼 확인 가능한 값만 유지

검증되지 않은 숫자는 고객이 보는 홈페이지에 넣지 않습니다.

## 5. 실사용 점검

배포 후 아래 화면을 실제 휴대폰에서 확인합니다.

1. 첫 화면: 대표 이미지, 상호, 전화/예약/길찾기 버튼
2. 메뉴: 세트 가격대와 사진
3. 매장소개: 주소, 전화번호, 주차·예약 정보
4. 리뷰: 네이버 리뷰 확인 버튼
5. 찾아오시는길: 길찾기 버튼
6. 이용안내: 네이버 예약·리뷰 확인 버튼

아이폰 Safari, 갤럭시 Chrome에서 각각 확인하는 것이 좋습니다.
