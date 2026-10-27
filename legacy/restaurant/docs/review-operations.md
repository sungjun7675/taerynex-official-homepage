> HISTORICAL RESTAURANT RECORD — inactive for TAERYNEX. Do not execute these deployment, account, or database procedures. See ../../../README.md for the local marketing candidate and H10 cutover gate.

# 리뷰 운영 절차

이 프로젝트는 네이버 플레이스 리뷰를 임의로 크롤링하지 않습니다. 현재 고객용 홈페이지는 네이버 플레이스 확인 링크와 검증된 리뷰 수 중심으로 운영합니다.

관리자 앱과 Supabase 리뷰 테이블은 내부 보관용으로 유지합니다. 고객 화면에 리뷰 슬라이더를 다시 노출하려면 별도 검수 후 공개 섹션을 연결해야 합니다.

## 1. Supabase 마이그레이션 확인

Supabase SQL Editor에서 아래 마이그레이션 파일을 순서대로 실행합니다.

```text
supabase/migrations/20260719123000_create_homepage_reviews.sql
supabase/migrations/20260719130500_add_review_source_fields.sql
supabase/migrations/20260720001000_add_admin_reviews_and_photos.sql
supabase/migrations/20260720223000_harden_admin_reviews_security.sql
supabase/migrations/20260720230000_harden_admin_boundary_and_rate_limit.sql
```

세 번째 마이그레이션은 관리자 앱 권한, 리뷰 사진 저장 버킷, `image_urls` 컬럼을 만듭니다.
네 번째 마이그레이션은 사진 버킷 private 전환, signed URL 접근, 감사 로그, `image_paths`, `image_hashes`를 추가합니다.
다섯 번째 마이그레이션은 비활성 관리자 차단, 내부 리뷰 테이블 공개 읽기 제거, 서버 rate limit 기반을 추가합니다.

## 2. 관리자 계정 준비

1. Supabase Dashboard에서 `Authentication > Users`로 이동합니다.
2. `Add user` 또는 `Invite user`로 관리자 이메일 계정을 만듭니다.
3. 기본 허용 이메일은 `tjdrhkde@gmail.com`입니다.
4. 다른 이메일을 쓸 경우 세 번째 마이그레이션의 `homepage_admins` insert 이메일을 바꿔 실행하거나, 아래 SQL을 추가 실행합니다.

```sql
insert into public.homepage_admins (email)
values ('관리자이메일@example.com')
on conflict (email) do nothing;
```

## 3. 관리자 앱 사용

배포 후 아래 주소로 접속합니다.

```text
https://eulwangri-donghae-homepage.vercel.app/admin
```

폰에서는 브라우저 메뉴에서 홈 화면에 추가하면 앱처럼 열 수 있습니다.

- 리뷰 캡처 이미지는 OCR로 읽어 본문 입력을 보조합니다.
- OCR 결과는 반드시 사람이 확인한 뒤 저장합니다.
- 리뷰 작성자가 올린 음식 사진은 `리뷰 사진` 입력에서 여러 장 선택할 수 있습니다.
- 저장된 리뷰는 Supabase에 보관됩니다. 현재 고객 화면에는 자동 노출하지 않습니다.

## 4. SQL로 직접 리뷰 등록

검증된 리뷰만 아래 형식으로 등록합니다. 현재 고객 화면에는 자동 노출하지 않으며, 나중에 리뷰 섹션을 다시 연결할 때 `is_published`가 `true`인 데이터만 사용합니다.

```sql
insert into public.homepage_reviews
  (author, label, text, time, rating, source_type, source_url, image_paths, image_hashes, image_urls, is_published)
values
  (
    '작성자명',
    '★★★★★',
    '실제 리뷰 문구',
    '2026-07-19',
    5,
    'naver',
    '리뷰 확인 URL',
    array[]::text[],
    array[]::text[],
    array[]::text[],
    true
  );
```

사진이 있는 리뷰는 관리자 앱으로 업로드하는 방식을 우선 사용합니다. SQL로 직접 등록할 때는 private storage에 먼저 업로드한 경로만 `image_paths`에 넣고, 외부 공개 URL을 새로 넣지 않습니다.

## 5. 자동 반영 방식

- 고객용 홈페이지의 네이버 리뷰 자동 조회는 꺼둔 상태입니다.
- 관리자 앱은 Supabase에 리뷰와 사진을 저장하는 내부 입력 도구로 유지합니다.
- 다시 연결할 경우 공개 여부, 출처 URL, 작성자, 날짜, 사진 권한을 먼저 확인해야 합니다.

## 6. 금지 기준

- 확인하지 않은 네이버 평점, 리뷰 수, 순위 문구를 실제 정보처럼 넣지 않습니다.
- 블로그/방문자 리뷰를 출처 없이 복사하지 않습니다.
- `source_url` 없이 등록해야 하는 경우 내부적으로 사용 허가를 받은 리뷰인지 먼저 확인합니다.
