# TAERYNEX official marketing website

React 19 / Vite, retaining the existing Git history. Deployed provider: Vercel;
the website project was retired and renamed under H7, with post-read verification recorded. No backend client, analytics,
forms, calculator, CMS, account registration or payment is part of this site.

```sh
npm ci
npm run build
npm run launch:check
npm run security:check
npm run security:headers
npm test
npm run preview:marketing
```

Preview: http://127.0.0.1:4173/app/ko (the preview models the checked-in static
routing/headers; it is not evidence of actual Vercel behavior).
The build explicitly disables `.env` loading. No environment variables are needed.
`npm run dev` is the Korean authoring shell; use the production preview for all
prerendered locale and legal routes.

- `/` is the deployed Korean marketing homepage.
- `/app/` retains an English homepage, `/app/{locale}` provides all 13 languages.
  Root and `/app/` canonicalize in metadata to `/app/ko` and `/app/en` respectively.
- `/{locale}.html` and `/terms/{locale}.html` are exact frozen privacy 1.0.6
  and terms 1.0.4 files; Vercel `cleanUrls` also provides extensionless URLs.
  No SPA catch-all. Original `google2233132a77c14ffe.html` is unchanged.
- `docs/legal-integrity.json` freezes the copied documents' SHA-256 and origin.
  Original root privacy remains byte-identical at `/ko.html`. `_headers` is not
  copied: security configuration for Vercel lives in `vercel.json`.
- `public/brand/` is Main-owned: landscape, icon, and 39 genuine localized app
  captures. No reference screenshot or fictional phone UI is used.
- Old frontend source is archived under `legacy/restaurant/`, outside `src`.
  Old SQL remains under `supabase/` as historical migrations; the new H7 retirement
  migration was applied through Supabase MCP as reported by Main; see H7.
  Only `src/App.jsx` → `src/marketing/` is in the new public module graph.
  Old public restaurant images, icon and manifest are retired from served output.
  Legacy workflows are manual-only and explicitly guarded; never run them for
  this site. There is no automatic database migration or deployment workflow.

## H10 — CEO requested existing free-plan replacement

The CEO accepted H9 screens/content and explicitly directed replacement inside
this existing Vercel project while retaining Hobby with no paid upgrade.
The verified commercial-use restriction was disclosed; successful deployment
must not be reported as policy compliance. New legal terms or payment actions
remain outside authorization. No new hosting project is required.

The following policy states are checked by `npm run security:check`:

| H10 policy | Disposition |
| --- | --- |
| Current replacement | Explicitly approved by CEO |
| Future production changes | Explicit CEO authorization required |
| Hosting plan | Existing Vercel Hobby; no paid upgrade |
| Hobby commercial-use restriction | Disclosed; deployment does not establish compliance |
| Old restaurant backups | Explicitly waived by CEO for project edfrlptpeuhjsgxdfwke; H7 retirement already executed |

Main verified commit `78d20b7` as Production Ready in the same existing Vercel
project, renamed `taerynex-official-homepage`; Hobby is unchanged with no paid
upgrade. `https://taerynex.com/` and `/app/ko` serve the accepted website with
active DNS. Independent release checks passed 83/83 for the old alias and 9/9
for the new origin / installed-app Pages compatibility, including public
routing, legal hashes and HTTPS/security headers. These are Main/release-manager
observations; they were not repeated during this bounded repair.

The first hosted GitHub CI run failed at the stale H10 documentation gate
(38/39 security checks passed). This repair does not establish a passing hosted
CI result; the next actual run remains required. Preserve installed-app Pages
legal compatibility and normal fast-forward history for future changes.
Preserve the website project `edfrlptpeuhjsgxdfwke` and its platform schemas. The app backend `tlrwsabbgbtdcsoayceg` remains protected and outside
the retirement scope. Do not replay historical restaurant migrations.

## H7 — old restaurant retirement complete, verified

The CEO waived old restaurant backups and authorized the exact irreversible
management cleanup at action time. Existing project `edfrlptpeuhjsgxdfwke` is
retained and renamed `taerynex-official-homepage`; provider state ACTIVE_HEALTHY.

Previously applied DB retirement (four tables, three functions, four policies)
was reused without repeating its tests. The Dashboard's normal services then
removed four review photos, their `review-photos` bucket, the restaurant Auth
identity and Edge Function `admin-review`. No direct Storage metadata deletion.
Fresh MCP readback: Storage objects 0, buckets 0, Auth users/identities/sessions
all 0, Edge Functions 0. The app backend `tlrwsabbgbtdcsoayceg` was not changed.

Evidence: `C:/projects/taerynex/artifacts/qa/homepage_20261027/H7-completed.json`.
The existing 13-language frontend is the deployed TAERYNEX replacement.
No duplicate web accounts, new database content or server functions are needed
for its approved static content. H7 cleanup does not eliminate compute charges.
H8 local integration was reviewed, H9 was explicitly accepted by the CEO, and
the authorized H10 deployment/domain cutover was observed as described above.
Deployment does not establish Hobby commercial-use policy compliance.
The Android app is in closed testing; mailto inquiries do not enroll testers.
iOS is in preparation without a promised date. Copy is localized using the
accepted app introductions as reference; native editorial review remains a
release consideration. No public installation, user-count or efficacy claim.

## Frontend verification CI

`.github/workflows/frontend-verification.yml` runs frontend checks on relevant push/PR changes with read-only permissions, no secrets and no deployment. It uses JSON (a YAML subset) for dependency-free structural validation. Existing Pages/Supabase workflows remain disabled. `node scripts/frontend-ci-check.mjs` checks this contract.

Execution attribution and retained repair logs: `docs/verification-evidence.json`. Earlier command results are writer-observed transcript evidence; earlier raw command log files were not retained and have not been reconstructed.

## H8 final local integration / H9 presentation

Independent final delta review: PASS_WITH_CONCERNS for local preview only.
Three served resources match disk bytes, two frozen assets match retained hashes,
four private/source path probes return 404, and retired-backend references are
absent from the current static output. Accepted builds/tests/browser evidence
were reused; no full-suite rerun or remote mutation was performed.
Stale H7/backup handoff statements were repaired and independently rechecked.

Actual desktop/mobile Chrome captures and H9 assessment are recorded in
`C:/projects/taerynex/artifacts/qa/homepage_20261027/H9-presentation.json`.
The viewport override was reset. The CEO explicitly accepted the H9 content and visual presentation.
H10 used the CEO-requested existing Hobby plan with the disclosed restriction;
actual public-provider routing/HTTPS/header results are recorded above. Physical website
and audible-reader acceptance, native-language certification and field
performance are not established by a local browser preview.
