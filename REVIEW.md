# Mailcheap security review

## Upstream update: 26 October 2026

Branch `update/upstream-2026-10-26` merges upstream `marclou/mailcheap` main
(42ca6fc, 26 October) into the BYOB fork. Upstream is now the whole MailCheap
Cloud app: accounts scoped by `accountId`, Better Auth with emailed six-digit
sign-in codes instead of the admin password, an OAuth provider and MCP server,
per-account SES tenants and configuration sets, and optional PostShiba, Stripe,
S3 and Upstash. The licence changed from MIT to AGPL-3.0-only (see Residual
limits). The fork's 13 commits were checked one by one against the new code.

No Critical finding was established. One High and five Medium findings were
fixed on the branch before any deployment. This review is not a guarantee
against all vulnerabilities.

### What happened to each fork commit

| Commit | Change | Outcome |
| --- | --- | --- |
| 1c89911, 5fb7c66 | REVIEW.md and STATUS.md | Kept and updated |
| 274b029 | MC-01 login limits (`lib/login-rate-limit.js`) | Dropped: the password login is gone. Sign-in codes are limited per inbox (5 per 15 minutes, 10 a day) whatever the IP, and each code dies after 3 wrong tries |
| 274b029 | MC-02 bounded request bodies (`lib/request-body.js`) | Kept and extended to every new route (MC-08) |
| 274b029 | MC-03 SNS SignatureVersion 2 only (`lib/sns.js`) | Kept: upstream still accepts SHA-1 |
| 274b029 | MC-04 SES production check before every send (`getSesSendProblem`) | Kept: upstream has no equivalent. The message now names the SES error |
| 274b029 | Newsletter-wide ceiling refuses archive signups | Kept: upstream only alerts |
| 274b029 | `SIGNUPS_ENABLED` switch | Kept, now `areSignupsEnabled()` in `lib/config.js`, and extended to the embedded forms and `add_contact` (REST and MCP) |
| 274b029 | Dockerfile, .dockerignore, `output: "standalone"` | Kept: upstream ships no Docker image |
| 274b029 | `/api/health` with a database ping and both flags | Merged with upstream's: config problems first, then the ping, then `{ ok, sendingEnabled, signupsEnabled }` |
| 274b029 | GMT+0 shown as UTC (`lib/time-zone.js`) | Dropped: upstream fixed the same thing |
| 274b029 | `/api/health` public in `proxy.js` | Dropped: upstream lists it already |
| b3bad35 | `scripts/bootstrap-database.mjs`, scripts copied into the image | Kept. The bootstrap already ran; the image now also carries the migration script |
| cf2e59a | curl and CA certificates for Coolify's health check | Kept: still needed |
| 36e3f8a to 023a03a | STATUS.md and REVIEW.md records | Kept |

### Findings fixed on the branch

**MC-05: Self-hosted servers got the largest plan's signup limits (High, fixed).**
`lib/plans.js:getSignupScale` gave self-hosted accounts Ultra's scale of 50. That
raised the signup API to 30,000 an hour per key, the forms' newsletter ceiling to
15,000 per 10 minutes and confirmation emails to 5,000 per 10 minutes, enough
for a script to send strangers thousands of confirmations once sending is on.
Self-hosted servers now keep Starter's limits, the ones this deployment was
reviewed with. `tests/plans.test.mjs` covers it.

**MC-06: MailCheap's own emails ignored SENDING_ENABLED (Medium, fixed).**
Alerts, newsletter summaries and inbox-check emails went through
`sendSesPlatformEmail` with neither the sending switch nor the SES check.
`lib/platform-email.js` now refuses everything except sign-in and deletion
codes while `SENDING_ENABLED` is not `true`; alerts are then only logged and
shown on /admin. Codes still go out so the owner can sign in.
`tests/platform-email.test.mjs` covers both sides.

**MC-07: A connected OAuth app could mint permanent API keys (Medium, fixed).**
Any https client metadata document can start OAuth, and the consent page shows
the name the document chooses. One mistaken Allow gave full access, and
`create_api_key` then produced a key that survives disconnecting the app.
`lib/actions/api-keys.js` refuses `create_api_key` for OAuth connections. API
keys and the dashboard can still create keys. `tests/oauth.test.mjs` covers it.

**MC-08: New routes read unbounded bodies (Medium, fixed).**
The REST API, MCP, QStash jobs (the signature check reads the body first),
SNS and PostShiba webhooks, embedded forms, uploads and Better Auth's routes
(some open without a session) read whole bodies. They now use
`readLimitedBody`, `readLimitedText` or the new `toLimitedRequest`: signups
16 KiB, other REST and MCP 4.5 MiB, Better Auth 64 KiB, jobs 256 KiB,
webhooks 512 KiB, embedded forms 16 KiB, uploads 4 MB with a 60-second read.
The Stripe webhook answers 404 before reading on a self-hosted server.
`tests/request-body.test.mjs` and `tests/fork-guards.test.mjs` cover it.

**MC-09: Spoofed addresses could flush the in-memory rate limits (Medium, mitigated).**
All in-memory counts shared one 10,000-key map that dropped the least recently
used key. Requests with rotating X-Forwarded-For values could push out the
counts that don't depend on the address (per key, account, newsletter and
inbox). `lib/rate-limit.js` now evicts expired counts first, holds 100,000 keys
and, only when every count is live, trims to 90%. A flood of 100,000 distinct
live addresses inside one window can still evict counts; shared Redis is the
full fix (Residual limits). `tests/rate-limit.test.mjs` covers it.

**MC-10: Share-image logos could read files outside public/ (Low, fixed).**
A logo path such as `/../../x.png` was joined onto `public/`. `lib/og-image.js`
now resolves the path and refuses anything outside `public/`.

**MC-11: The archive view beacon always failed (Low, fixed).**
The deployed fork called `readLimitedText` and `NextResponse` in
`app/api/views/route.js` without importing them, so every beacon answered
400 or 500. The archive is off, so nothing was lost. Bad bodies now get 204
like upstream.

**MC-12: Existing data is invisible to the new code (Blocking, fixed by migration).**
Every customer query now names an `accountId`, and API keys only work while
their account's owner has a verified email on `ADMIN_EMAILS`. Upstream ships no
upgrade path. `scripts/migrate-to-accounts.mjs` creates the owner's Better Auth
user and account, gives every newsletter, contact, campaign, message, event,
API key and suppression that account, renames `sesMessageId` to
`providerMessageId`, and drops the indexes the new models replaced (the old
`contacts.email_1` would block the new partial index). It is a dry run unless
`--apply` is passed, refuses an owner who isn't in `ADMIN_EMAILS` and is safe
to run again. `tests/migrate-to-accounts.test.mjs` seeds a database shaped like
the old release, migrates it, rebuilds every model's indexes, drives the BYOB
reader site's exact signup call with an old-format key (201, 200, 400, and 503
with signups off) and signs the owner in to the migrated account.

### Re-review of the controls (26 October)

- Admin authentication: emailed codes through Better Auth's emailOTP, stored
  hashed, five-minute expiry, three tries per code. Only `ADMIN_EMAILS` and
  `ALLOWED_EMAILS` sign in; with both empty nobody can. The allowlist is checked
  at user creation, session creation, every session read, every API key
  request and every OAuth token. /admin and its 14 actions check the admin list
  on the server.
- Sessions: Better Auth database sessions, seven days, renewed daily while in
  use. Cookie `__Secure-better-auth.session_token`, Secure, HttpOnly,
  SameSite=Lax, Path=/ (no longer `__Host-`). Secure depends on an https
  `APP_URL`, which production has.
- Secrets: `BETTER_AUTH_SECRET` replaces `SESSION_SECRET`. Link keys are still
  derived with HKDF and the same labels (`mailcheap-unsubscribe-v1` and the
  others), so setting `BETTER_AUTH_SECRET` to the current `SESSION_SECRET` keeps
  every link in sent emails working. `SUPPRESSION_HASH_KEY` is new and
  separate. PostShiba and Postmaster credentials use AES-256-GCM with random IVs.
  Nothing secret reaches the client bundle.
- Signup API: `POST /api/v1/contacts` keeps the BYOB contract. New contact 201,
  existing 200, invalid email 400, rate limited 429, signups off 503. Newsletter
  lookup by slug is scoped to the key's account. Old keys without a level count
  as signups-only, which allows `add_contact` and nothing else.
- SNS webhooks: topic matched first, SignatureVersion 2 only, certificate and
  SubscribeURL hosts restricted, redirects refused, 503 when unconfigured. The
  new `/api/webhooks/ses-tenants` uses the same code and stays off without
  `SES_TENANT_SNS_TOPIC_ARN`.
- Unsubscribe, confirm, keep, summary and tracking links: purpose-separated
  HMAC keys, timing-safe checks. Unsubscribe never expires and GET changes
  nothing; RFC 8058 POST works. Unsigned click links show a continue page.
- Rate limits: still in memory without Upstash Redis (MC-09). QStash jobs need
  both signing keys in production; cron routes answer 503 until `CRON_SECRET`
  is set.
- Content: sanitize-html runs last, raw HTML issues render in a frame without
  allow-scripts, JSON-LD escapes `<`, and the security headers and CSP remain.
  `/embed/*` has its own framing headers.
- Sending: campaigns, welcome, confirmation, last-chance and test emails all
  check `SENDING_ENABLED` and `getSesSendProblem`. Sign-in and deletion codes
  are the only emails that go out while sending is off.

### Residual limits

1. Licence: upstream is now AGPL-3.0-only. Running a modified copy as a network
   service means offering its source to its users. The fork is public at
   https://github.com/remotehumans/mailcheap; keep it public and in step with
   what is deployed.
2. Anyone can lock the admin out of code sign-in for up to a day by requesting
   10 codes for the admin address. BYOB signups are unaffected. Watch the logs;
   a shorter daily window for admin addresses is a possible later change.
3. Code checks are limited per IP only (30 per 15 minutes), but each code dies
   after 3 tries and 10 codes a day per inbox cap guesses at about 30 a day.
4. There is no "sign out everywhere" and no password to rotate. To end a stolen
   session, delete the user's rows in the `sessions` collection.
5. Adding a domain that already exists in SES adopts it without DNS proof, and
   removing it or purging the account calls DeleteEmailIdentity. Only the admin
   can sign in, and the current IAM policy blocks every tenant call. When the
   IAM policy is widened for sending, deny `ses:DeleteEmailIdentity` and
   `ses:PutEmailIdentityMailFromAttributes` on `mail.remotehumans.ai`.
6. Client IPs come from the first X-Forwarded-For entry, which a client can set.
   Per-IP limits are therefore weak; the ceilings that don't depend on the IP
   remain. Restricting the origin to Cloudflare's addresses and reading
   `cf-connecting-ip` would fix it.
7. Rate counters are in process memory (MC-09): one app process only, counters
   reset on restart. Add Upstash Redis before scaling or opening forms widely.
8. Vercel BotID never runs off Vercel, so its checks pass, and
   `x-vercel-ip-country` is taken from the request, so a contact's country can be
   spoofed. Neither protects anything this deployment relies on.
9. The unsubscribe route's per-IP limit runs before its token check, so a spoofed
   address can fill a mail provider's bucket; one-click unsubscribe would then
   answer 429 until the minute passes.
10. Form responses differ for new and existing subscribers when confirmation is
    on, which reveals who subscribes, slowly, within the per-address limits.
11. SNS notifications have no timestamp freshness check and QStash's subject URL
    is not checked; replays only re-run idempotent handlers.
12. Confirm links still activate pending readers while `SIGNUPS_ENABLED=false`.
    No confirmation emails go out while sending is off.
13. A rotated `BETTER_AUTH_SECRET` signs everyone out and breaks every link in
    sent emails. Never rotate it; `SUPPRESSION_HASH_KEY` must also stay fixed.
14. Before sending is switched on: widen the SES IAM policy to the tenant and
    configuration-set calls the README lists (with residual 5's denials), add
    `mail.remotehumans.ai` on the Domains page, and set `CRON_SECRET`. Without
    them, the first send fails closed.

### Validation (26 October)

- Full suite on Node 22.21.1 with MongoDB 8 (the `mongo:8` image production
  uses), including the new migration, guard and regression tests: see the
  final count at the end of this section. No failures, no warnings.
- ESLint passed. `git diff --check upstream/main` passed. Two upstream files
  carry whitespace `git diff --check` reports (`public/fonts/OFL.txt`,
  `tests/send-backoff.test.mjs`); they are byte-identical to upstream and left
  as they are.
- The production Docker image built from the branch (Next.js 16.4.1,
  standalone output, Node 24 runtime as `node`).
- `npm audit --omit=dev`: `npm audit fix` (no breaking changes) updated
  sanitize-html to 2.18.1, undici to 6.29.1 and ip-address to 10.7.5. Five high
  advisories remain, all one chain: `@vercel/blob` and `@vercel/functions` pull
  `@vercel/oidc` and `@vercel/cli-config`, which bundles a zod older than 4.6.6
  (GHSA-mrhx-c7xc-m3w5). That code only reads Vercel OIDC tokens and never runs
  on this server; the app's own zod is 4.6.6 or later. npm's only fix is a
  downgrade, so it waits for upstream.
- Two upstream calls used Mongoose's deprecated `new: true`
  (`lib/import-jobs.js`); they use `returnDocument: "after"` so test output
  stays clean.
- Final count: 1,302 tests in 185 suites, 1,302 passed, 0 failed.
- The built image started against a throwaway MongoDB 8 and reported healthy
  (`/api/health` 200, runs as `node`, curl present). Without a key the signup API
  answered 401. `node scripts/migrate-to-accounts.mjs` ran inside the image.
- No deployment, email, contact or live database change was made.

## Previous review: 12 October 2026 (single-admin release)

Reviewed 12 October 2026 for Bring Your Own Brain. The reviewed release is
suitable for the initial, single-process deployment with sending and signups
explicitly disabled. No critical or high-severity defect was established in the
reviewed scope. The medium-severity weaknesses below were fixed before deployment.
This review is not a guarantee against all vulnerabilities.

### Findings and changes

#### MC-01: Forwarded headers could evade login limits (Medium, fixed)

The original `lib/rate-limit.js:getClientIp` trusts the first forwarded IP.
The sole login limit in `app/login/actions.js` depended on that value.
An attacker controlling the header could rotate addresses to create new buckets.
`lib/login-rate-limit.js:3-9` now applies both 10 attempts per IP and 30 attempts
per account per 15 minutes. The account key is constant and independent of
forwarding headers. A regression test rotates 31 IPs and verifies rejection.
Public signups also stop at a newsletter-wide ceiling instead of only alerting.
Per-IP limits still depend on the ingress; the independent ceilings provide the
additional boundary. A determined attacker can cause a temporary login lockout.

#### MC-02: Request limits were checked after buffering (Medium, fixed)

The SES webhook used `request.text()` before checking its length. Signup, views,
draft creation, unsubscribe and image upload routes also buffered complete bodies.
`lib/request-body.js:6-37` now rejects oversized declared lengths, counts streamed
bytes, cancels excess input, and times out stalled input after 10 seconds.
The routes use bounded reads: SES 512 KiB, contacts 16 KiB, views 2 KiB,
unsubscribe 8 KiB, drafts 1 MiB, uploads 4 MB. Tests cover declared lengths,
chunked input, exact UTF-8 byte boundaries and cancellation on timeout.
Server Actions retain Next.js's default 1 MB limit and built-in origin checks.

#### MC-03: Legacy SNS SHA-1 signatures (Low, fixed)

`lib/sns.js:6-8` now accepts only signature version 2 / RSA-SHA256.
Tests reject genuine version-1 signatures and accept version 2.
The configured SNS topic must use SignatureVersion 2.
Topic matching, canonical signed fields, certificate host/path restrictions,
HTTPS-only fetching and disabled redirects remain in place.

#### MC-04: Sending flag alone permitted SES sandbox sends (Medium, fixed)

`lib/ses.js:sendSesEmail` now checks `getSesSendProblem` before SendEmail.
Missing/failed account checks, sandbox status, and disabled SES account sending
all fail closed. Production status is cached for up to five minutes, like the
existing account dashboard. SENDING_ENABLED must also be exactly true.
A regression test covers unknown, failed, sandbox, disabled and approved accounts.
No SES send was used to validate this change.

### Existing controls verified in source

- Admin authentication compares fixed-size SHA-256 digests using timingSafeEqual.
  The deployment uses a randomly generated password saved in the shared vault.
- `lib/session-token.js` restricts JWT algorithms to HS256, derives its key with
  HKDF, expires sessions after seven days, and invalidates sessions after changes
  to the admin email or password.
- `lib/auth.js` sets production cookies with __Host- naming, Secure, HttpOnly,
  SameSite=Lax and Path=/. Dashboard layout and mutating dashboard actions
  independently require a session; uploads require one too.
- API keys use 256-bit randomness and are stored as hashes with revocation checks.
  API routes authenticate keys before creating data; signup limits apply per key.
- Unsubscribe links bind contact and newsletter IDs with purpose-separated HMAC
  keys and timing-safe checks. GET does not unsubscribe. POST supports RFC 8058.
  Permanent unsubscribe tokens deliberately keep old emails usable.
- Public confirmation and keep links use separate signing contexts and expiry.
- SNS events require the configured TopicArn and a valid AWS signature before
  processing. Event handling has idempotent update rules and suppression handling.
- Production QStash routes reject missing signing-key configuration. Configured
  jobs use Upstash's signature verifier; development-only bypass stays confined
  to NODE_ENV=development.
- Inline archive content ends with sanitize-html using allowed tags/attributes.
  Raw HTML issues render in an iframe with no allow-scripts. JSON-LD serialization
  escapes script-closing characters. Signed click tokens constrain redirects.
- Security headers include nosniff, framing denial, base-uri and form-action.
  The existing CSP intentionally omits script-src for cached Next.js pages.
  Sanitization and iframe sandboxing remain essential; no blanket CSP bypass
  was added.
- All email types pass through the disabled sending gateway. Optional email
  alerts remain unconfigured. No secrets are embedded into the Docker image.
- The production image runs as the unprivileged node user. MongoDB has no public
  port and retains persistent Coolify-managed storage. /api/health reports only
  readiness and feature flags, never credentials.

### Residual limits

1. Rate counters remain in process memory because no Upstash Redis credentials
   exist. Counters reset on restart and are not shared. Keep one app process;
   use shared limiting before scaling. Map size is bounded to 10,000 keys.
2. A rotating SESSION_SECRET invalidates unsubscribe links in old emails.
   Retain it; rotate the admin password to invalidate sessions instead.
3. Real SNS subscription confirmation and both configured QStash signing keys
   passed live verification on 13 October. QStash authenticated reads also passed.
   Real email/bounce delivery remains untested because no email was authorised.
   DKIM is verified. Keep sending disabled while SES production access is pending.
4. Vercel Blob is optional and unconfigured. Editor image uploads stay unavailable;
   remotely hosted images remain usable.
5. The upstream release has no maintenance/support commitment. Keep the fork's
   dependencies and security checks current.

### Validation before deployment

- 212 unit tests passed, including the new security regressions.
- ESLint passed.
- Production build passed with Next.js 16.3.8.
- npm audit --omit=dev reported zero known vulnerabilities.
- git diff --check passed.
- Installed Next.js documentation was reviewed for standalone output, deployment
  and Server Action authentication/origin/body-size behaviour.
- An upstream ICU formatting mismatch was corrected: GMT+0 now consistently
  displays as UTC. The existing timezone test passes without weakening assertions.

Live HTTPS, login, cookie flags, endpoint rejection and database persistence
checks are recorded in STATUS.md after deployment. No contacts or emails are
needed for those checks.

### Live deployment verification: 13 October 2026

HTTPS readiness and the generated admin login passed. The production cookie has
Secure/HttpOnly/SameSite=Lax and __Host- naming. Protected API calls and unsigned
jobs were rejected. Real SNS subscription confirmation used SignatureVersion 2.
Both QStash keys passed separate signed empty-request checks without publishing
jobs or sending. MongoDB uses a database-scoped runtime user; bootstrap secrets
and the one-time task were removed. The zero-contact newsletter persisted after
redeployment. Runtime secrets are not exposed as build arguments.

Coolify's health-check command required curl or wget. Commit cf2e59a adds curl
and CA certificates to the image; the deployed runtime still runs as node.
The SES runtime IAM user is restricted to the intended sender, domain identity
and configuration set, plus SES status reads. The production-access case requests
additional details; the approved response is posted and DKIM is verified.
STATUS.md contains the remaining steps.
