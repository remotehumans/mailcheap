# Mailcheap security review

Reviewed 12 October 2026 for Bring Your Own Brain. The reviewed release is
suitable for the initial, single-process deployment with sending and signups
explicitly disabled. No critical or high-severity defect was established in the
reviewed scope. The medium-severity weaknesses below were fixed before deployment.
This review is not a guarantee against all vulnerabilities.

## Findings and changes

### MC-01: Forwarded headers could evade login limits (Medium, fixed)

The original `lib/rate-limit.js:getClientIp` trusts the first forwarded IP.
The sole login limit in `app/login/actions.js` depended on that value.
An attacker controlling the header could rotate addresses to create new buckets.
`lib/login-rate-limit.js:3-9` now applies both 10 attempts per IP and 30 attempts
per account per 15 minutes. The account key is constant and independent of
forwarding headers. A regression test rotates 31 IPs and verifies rejection.
Public signups also stop at a newsletter-wide ceiling instead of only alerting.
Per-IP limits still depend on the ingress; the independent ceilings provide the
additional boundary. A determined attacker can cause a temporary login lockout.

### MC-02: Request limits were checked after buffering (Medium, fixed)

The SES webhook used `request.text()` before checking its length. Signup, views,
draft creation, unsubscribe and image upload routes also buffered complete bodies.
`lib/request-body.js:6-37` now rejects oversized declared lengths, counts streamed
bytes, cancels excess input, and times out stalled input after 10 seconds.
The routes use bounded reads: SES 512 KiB, contacts 16 KiB, views 2 KiB,
unsubscribe 8 KiB, drafts 1 MiB, uploads 4 MB. Tests cover declared lengths,
chunked input, exact UTF-8 byte boundaries and cancellation on timeout.
Server Actions retain Next.js's default 1 MB limit and built-in origin checks.

### MC-03: Legacy SNS SHA-1 signatures (Low, fixed)

`lib/sns.js:6-8` now accepts only signature version 2 / RSA-SHA256.
Tests reject genuine version-1 signatures and accept version 2.
The configured SNS topic must use SignatureVersion 2.
Topic matching, canonical signed fields, certificate host/path restrictions,
HTTPS-only fetching and disabled redirects remain in place.

### MC-04: Sending flag alone permitted SES sandbox sends (Medium, fixed)

`lib/ses.js:sendSesEmail` now checks `getSesSendProblem` before SendEmail.
Missing/failed account checks, sandbox status, and disabled SES account sending
all fail closed. Production status is cached for up to five minutes, like the
existing account dashboard. SENDING_ENABLED must also be exactly true.
A regression test covers unknown, failed, sandbox, disabled and approved accounts.
No SES send was used to validate this change.

## Existing controls verified in source

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

## Residual limits

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

## Validation before deployment

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

## Live deployment verification: 13 October 2026

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
