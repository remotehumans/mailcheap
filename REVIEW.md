# Mailcheap security review
Date: 12 October 2026
Repository: https://github.com/remotehumans/mailcheap

## Result
Preliminary source review only. Deployment is blocked. This is not a production security sign-off.
The Mac reports ENOSPC when cloning and when Bitwarden creates its cache lock.
No dependencies were installed, no tests ran, and no deployment or DNS changes were made.
The original source was inspected directly through GitHub.

## Scope inspected
README.md, SECURITY.md, AGENTS.md, package.json, lib/auth.js,
lib/session-token.js, lib/config.js, app/login/actions.js, proxy.js,
lib/rate-limit.js, lib/api-keys.js, app/api/v1/contacts/route.js,
app/archive/actions.js, lib/contact-token.js, lib/unsubscribe.js,
lib/sns.js, app/api/webhooks/ses/route.js, lib/ses.js,
lib/qstash-route.js, next.config.mjs, lib/alerts.js, lib/sending-rules.js.

## Findings requiring resolution before deployment

### MC-01: Forwarded IP trust must be established (Medium, open)
Evidence: lib/rate-limit.js, getClientIp, selects the first x-forwarded-for
entry and then x-real-ip. app/login/actions.js, login, uses that result as
the only rate-limit key.
Impact: if the ingress accepts client-supplied forwarding headers,
an attacker can change the key and evade the login attempt limit.
Proxy behaviour has not yet been verified. This is conditional on ingress trust,
not a demonstrated attack against a deployed instance.
Resolution: enforce a trusted ingress boundary and verify header handling.
Add an account-wide login limit independent of client-controlled headers.
Test spoofed forwarding headers before exposing the login.

### MC-02: Memory limits reset and are not shared (Low, open)
Evidence: lib/rate-limit.js uses a bounded process-local Map when Redis is
not configured or is unavailable.
Impact: limits reset on restart and are not shared across multiple processes.
Resolution: keep deployment to one process initially, document the limit,
and configure shared limiting before scaling.

### MC-03: SNS accepts signature version 1 (Low, hardening pending)
Evidence: lib/sns.js, SIGNATURE_ALGORITHMS, accepts RSA-SHA1 and RSA-SHA256.
The requested setup uses SNS SignatureVersion 2.
Resolution: configure the topic to version 2 and reject version 1 for this
deployment, with tests. A valid signature and the configured topic are
already required; this is not an unsigned webhook bypass.

## Existing source controls
- Authentication compares fixed-length SHA-256 digests with timingSafeEqual.
  The environment password remains plaintext server configuration.
- JWT sessions allow only HS256, derive a separate HKDF key, expire in seven
  days, and become invalid when the admin email or password changes.
- Production cookies use __Host- naming, Secure, HttpOnly, SameSite=Lax and Path=/.
  Protected server actions must also call requireSession; complete coverage still
  needs the local review.
- The signup API requires a bearer key, looks up its hash, checks revocation,
  validates fields, and limits per key and optional visitor IP.
  Public archive forms validate email and use a honeypot and IP limiting.
- Unsubscribe tokens use purpose-separated HKDF/HMAC-SHA256, timing-safe
  signature verification, and bind the contact and newsletter IDs.
  They deliberately do not expire. One-click unsubscribe headers are present.
- SNS certificate URLs are restricted to HTTPS regional SNS hosts and the
  expected certificate path, with no redirects. The webhook binds TopicArn
  to the configured topic and verifies the signature before handling events.
- QStash jobs require signing keys and signature verification outside development.
- sendSesEmail rejects sending unless SENDING_ENABLED is exactly true.
  Alerts, welcome and confirmation paths also check the sending flag.
- Security headers include nosniff, frame denial, base-uri and form-action controls.
  The global CSP omits script-src; archive HTML sanitization, sandboxing and
  all active-content paths still need complete verification.

## Required validation
Read the installed Next.js version's bundled documentation before edits.
Review all server actions, HTML sanitizers, uploads, archive rendering and
job send paths. Run unit tests, lint, dependency audit and production build.
Add regression tests for any security fixes.
Verify live HTTPS, unauthenticated rejection, session cookie flags, invalid
SNS/QStash rejection, rate limiting and disabled sending.
Use only synthetic tests that cannot send email or create/import contacts.
