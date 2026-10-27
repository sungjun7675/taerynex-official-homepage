> HISTORICAL RESTAURANT RECORD — inactive for TAERYNEX. Do not execute these deployment, account, or database procedures. See ../../../README.md for the local marketing candidate and H10 cutover gate.

# 보안 격상 운영 메모

## 현재 보안 경계

- 배포: Vercel 정적 배포 권장, GitHub Pages fallback 유지
- 앱: Vite React SPA
- 관리자 인증: Supabase Auth
- 관리자 권한: `homepage_admins` RLS + `is_homepage_admin()` 함수
- 파일 저장: Supabase Storage `review-photos`
- 고객 화면: Supabase 리뷰 자동 노출 없음

## 반드시 실행할 Supabase 마이그레이션

기존 세 개 마이그레이션 이후 아래 파일을 SQL Editor에서 실행해야 보안 격상 DB 정책이 적용됩니다.

```text
supabase/migrations/20260720223000_harden_admin_reviews_security.sql
supabase/migrations/20260720230000_harden_admin_boundary_and_rate_limit.sql
```

적용 내용:

- `review-photos` 버킷을 private로 전환
- 관리자만 signed URL로 사진을 확인하도록 storage RLS 강화
- 업로드 경로를 `auth.uid()` 하위로 제한
- 리뷰 입력 길이, 출처 URL, source type DB 제약 추가
- `homepage_review_audit_logs` 감사 로그 테이블 추가
- 새 업로드는 `image_paths`, `image_hashes`에 저장
- 기존 `image_urls` 데이터는 legacy로 보존
- 비활성 관리자(`is_active = false`)는 `is_homepage_admin()`에서 차단
- 고객 화면에서 사용하지 않는 내부 리뷰 테이블의 공개 읽기 정책 제거
- Edge Function용 서버 rate limit 테이블과 RPC 추가

## Edge Function 서버 경계

관리자 변경 작업을 서버 경계로 올리려면 Supabase CLI 또는 Dashboard에서 아래 Function을 배포합니다.

```text
supabase/functions/admin-review/index.ts
```

필요한 Function secret:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ADMIN_ORIGINS=https://eulwangri-donghae-homepage.vercel.app,https://sungjun7675.github.io,http://127.0.0.1:4175
```

배포 후 GitHub Actions secret 또는 로컬 환경변수에 아래 값을 설정하면 관리자 앱이 Edge Function 경계를 사용합니다.

```text
VITE_USE_ADMIN_EDGE_FUNCTIONS=true
```

보안 이유:

- 클라이언트는 service role key를 보유하지 않음
- 서버에서 JWT를 검증하고 `homepage_admins.is_active = true`를 다시 확인
- 저장/삭제/공개 변경 요청에 서버 rate limit 적용
- 감사 로그 payload는 리뷰 본문/이메일을 저장하지 않고 최소 metadata만 보관

GitHub에서 한 번에 적용하려면 repository secrets에 아래 값을 추가한 뒤
`Actions > Deploy Supabase security boundary > Run workflow`를 실행합니다.

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_URL
```

`SUPABASE_DB_URL`은 Supabase Database connection string이며 GitHub 로그에 출력하지 않습니다.

## Vercel 보안 헤더 기준

Vercel 운영 배포는 `vercel.json`에서 HTTP response header를 직접 적용합니다.

적용 기준:

- `Content-Security-Policy` response header
- `frame-ancestors 'none'`
- `style-src 'self'`로 inline style 차단
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `/admin` 전용 `Cache-Control: no-store`

관리자 페이지는 Vercel에서 아래 실제 경로를 사용합니다.

```text
https://eulwangri-donghae-homepage.vercel.app/admin
```

GitHub Pages fallback은 계속 동작하지만, 임의 HTTP response header를 직접 설정할 수 없으므로 아래 항목은 Vercel에서만 완전 검증됩니다.

```text
Content-Security-Policy response header
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
Cache-Control: no-store on /admin
```

관리자 앱의 촬영 업로드를 유지하기 위해 `Permissions-Policy`는 `camera=(self)`로 둡니다.

## 검증 명령어

```bash
npm run security:check
npm run security:supabase
npm audit --audit-level=moderate
npm run build
```

실제 HTTP header 앞단을 붙인 뒤에는 아래 명령으로 확인합니다.

```bash
npm run security:headers -- https://eulwangri-donghae-homepage.vercel.app/
```

## 100점 전환 체크리스트

- 두 보안 마이그레이션을 Supabase SQL Editor에서 실행
- `admin-review` Edge Function 배포
- 또는 `Deploy Supabase security boundary` GitHub workflow로 위 두 작업 실행
- `VITE_USE_ADMIN_EDGE_FUNCTIONS=true`로 관리자 변경 작업을 서버 경계로 전환
- `SUPABASE_SECURITY_TEST_EDGE=true`와 관리자 테스트 계정 환경변수로 운영 검증 실행
- Vercel production URL에서 `npm run security:headers` PASS 확인
- Supabase Auth에서 관리자 계정 MFA 적용
- GitHub 저장소 branch protection 설정
- 정기 보안 감사 workflow 실패 알림 확인
