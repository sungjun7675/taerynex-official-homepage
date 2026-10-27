# Website contact candidate — 2026-10-27

Scope: existing Vercel Hobby and website Supabase project `edfrlptpeuhjsgxdfwke`
with its existing Pro/Micro plan retained; no new paid plan is introduced.
Repository: https://github.com/sungjun7675/taerynex-official-homepage.
No source commit, push, deployment, remote SQL, Auth change or key retrieval
was performed by the implementation specialist. Historical H7/H10 evidence
does not establish acceptance of this new contact backend.

## Data and access contract

Three former mailto actions now open the on-site form. All 13 languages have
labels, explicit unchecked required consent, success and failure text, purpose,
controller/contact, host separation and retention notice. This is an app support
and closed-test inquiry channel, not enrollment or personalized Saju calculation.
Public support/reply address: `taerynex@gmail.com`.

Only email (254 max), message (10–3,000), locale, request UUID, server consent
version and operational timestamps/status are stored. No attachment, birth,
payment or password field. Users are warned not to put sensitive data in prose;
the system cannot reliably detect all sensitive content inside free text.
No IP address or IP hash is collected by application code. Hosting providers
may retain network/security logs and backups under their own policies. Confirm
the provider processing terms before public launch (Main verified Tokyo, Japan); this
implementation does not certify country-specific privacy-law compliance.

Private `website_contact_private` tables have RLS enabled/forced and no policies;
PUBLIC, anon, authenticated and service_role have no direct table CRUD grants.
Service-only invoker RPC wrappers call narrowly granted private definer functions
with empty search paths and qualified relations. Neither browser role can invoke
the wrappers or private functions. Service credentials are used only by the
Edge runtime via the existing platform-provided environment variables; they
are never put in frontend config or logs.

Browser CSP keeps native `form-action` denied: all intake uses fetch.

The public `website-contact` Edge function has `verify_jwt=false` intentionally
because anonymous inquiries use a modern publishable key, not a user JWT.
The body checks the known public apikey and exact browser origin. These are
not user authentication, bot authentication or secret barriers. `/inbox` also
requires a verified user via Auth `getUser` and a DB check of the pinned UUID,
confirmed exact owner email, non-anonymous account, matching live session and
session not_after. Plain React text renders email/message; no HTML execution.

Atomic DB advisory locking encloses quota checks and insertion: 3 per email
per rolling 24h, 100 total per rolling 24h, 1,000 retained rows maximum. Exact
request-ID retries return the same saved receipt; conflicting bodies are rejected.
The form retains the same payload/key across uncertain retries and blocks editing
after an attempt. It never persists a draft or key to browser storage, so closing
the page loses both; that limit is disclosed. A honeypot rejects nonempty input.
This is basic bounded anti-abuse, not CAPTCHA or DDoS protection. An attacker
can exhaust shared quotas; availability under distributed abuse is unverified.

Only an actual successful DB receipt produces a success message. Timeouts,
offline and failed requests never fabricate success. Inbox pagination uses
20 displayed rows plus one lookahead, stable `(created_at,id)` keyset cursors,
status filtering, status changes and owner deletion for withdrawal/minimization.
Reply-email copying reports actual clipboard success or a truthful manual-copy
fallback; the site sends no reply/notification email automatically.

## Exact authentication and provider prerequisites

1. After explicit remote-change authorization, apply **only**
   `supabase/migrations/20261027120957_website_contact_intake.sql` to the website
   project. Never replay historical restaurant migrations or touch protected app
   backend `tlrwsabbgbtdcsoayceg`. Keep the private schema out of exposed schemas.
   Confirm public RPC functions are available to service_role in the actual Data
   API settings; no browser table/function grants are needed.
2. Main saved Site URL: `https://taerynex.com/admin/inquiries`, with zero
   additional redirect URLs. This exact Site URL covers the implemented callback;
   no root Site URL, extra redirect entry, wildcard or localhost is required.
   The existing default ConfirmationURL email template is sufficient; no .Token
   template change, new SMTP, OAuth client, provider or secret is needed.
3. Main verified the existing organization owner the approved owner email (kept in private operations records) is eligible
   for default SMTP. Dashboard Invite user creates that website Auth identity;
   Dashboard login itself is not website Auth. Record its actual UUID privately,
   substitute it into `supabase/setup/website-contact-operator.sql`, review and
   execute on the website DB only. It deliberately refuses a missing/wrong user
   and cannot silently replace an existing pinned owner. Inbox also requires
   email confirmation and a live session after the owner opens the invite/link.
4. Deploy the exact Edge source plus its local `handler.js` dependency. Existing
   runtime secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are sufficient;
   deployment and remote verification are coordinator responsibilities. Check
   `verify_jwt=false` alongside actual in-handler apikey/JWT/DB protections.
5. Default SMTP is rate limited and best effort. The login UI accepts an operator email with `shouldCreateUser:false`; the
   privately pinned UUID and confirmed matching email authorize data access. It cannot create accounts
   and does not request passwords. No Auth hook is required. Underlying provider
   signup settings remain separate; disabling unused public signup after invite
   can be reviewed in provider setup. Real owner email delivery is still required.
6. The default implicit flow handles the email link in the same exact route,
   including when opened in a new tab. Tokens are kept only in this tab’s `sessionStorage` (never localStorage);
   callback parameters are removed with replaceState. No analytics/remote assets
   run there. Auto-refresh works while the tab is open; expiry, denied access
   and logout clear inquiry and tab-session state. Reload preserves the tab session without another email.
   Normal tab closure ends sessionStorage; browser tab/session restoration can
   restore it, so shared-device operators must explicitly log out. Blocked tab
   storage disables login with an explicit message. Do not claim an existing
   Dashboard session satisfies this gate.
7. Before public intake, separately authorize/install `pg_cron` and execute
   `supabase/setup/website-contact-retention.sql`. Main observed pg_cron absent;
   it has **not** been installed by this specialist. The idempotent named job
   executes internal DB deletion at 03:17 UTC daily, without pg_net/network calls.
   Record `cron.job`, then actual successful `cron.job_run_details`. This is a
   release prerequisite; opportunistic intake/inbox purges do not replace it.

Retention: delete after the earlier of resolution +30 days or receipt +90 days;
reopening/re-resolving never extends the stored expiry. The daily job physically
deletes due rows on its next run (up to one day scheduling delay). Queries purge
due rows before returning them. Withdrawal requests are handled by the owner
using receipt/email verification and Delete inquiry. Providers' backup/log
retention remains outside the app's primary-table deletion guarantee.

## Verification and limits

`node --test tests/contact-db.test.mjs tests/contact-http.test.mjs tests/contact-ui.test.mjs`
executes actual new SQL in local PGlite PostgreSQL with fixture Auth tables/roles,
denied CRUD/RPC, atomic quota logic, dedupe/conflict, actual retention deletion,
owner/session denial, keyset pagination/status/deletion and mocked HTTP with a
real DB commit followed by a lost response and idempotent retry. Rendered React
tests cover 13 notices/consent, validation, retry, offline/unconfigured states,
rapid submits, Korean operator OTP parameters, text safety, pagination, status,
clipboard success/failure, logout and expiry/late-response clearing.

PGlite is not hosted Supabase Auth/PostgREST/Edge, real multi-connection contention
or pg_cron. Those, actual owner sign-in/invite delivery, public submission/inbox
round-trip, real retention scheduling, desktop/mobile browser appearance and
native-language editorial acceptance require coordinator/independent QA evidence.
The protected app backend and all frozen legal bodies remain outside this scope.
Vercel Hobby commercial-use policy remains the already disclosed unresolved risk;
no paid plan or policy-compliance claim is introduced here.

Security rework: the independent stalled-partial-stream abort probe initially
failed. Body reading now has a 2s total deadline, observes request abort and
releases/cancels the reader without awaiting a potentially hanging cancel.
One 12s server operation deadline spans body/Auth/RPC, below the 18s public
transport deadline; SDK Auth fetches have a 10s deadline. Regression fixtures
include stalled and aborted partial streams with a deliberately hanging cancel
and stalled service work. Native form submission stays blocked by CSP; contact
submission uses fetch only. All 13 inline notices disclose Tokyo, Japan storage.
The implementation does not contain the operator's private email literal;
the owner enters it at login and private provisioning supplies the binding.

The first SDK session-restoration fixture left a BroadcastChannel open after
its assertions. That test run was interrupted and is not a passing completed
suite. Fixtures now call the SDK's dispose method so the process can terminate.

Official sources checked 2026-10-27: [Auth email links](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[implicit flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow),
[default SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp),
[Edge authorization headers](https://supabase.com/docs/guides/functions/auth-headers),
[database functions](https://supabase.com/docs/guides/database/functions),
[Cron setup](https://supabase.com/docs/guides/cron/quickstart),
[changelog](https://supabase.com/changelog).
