# Bring Your Own Brain: Mailcheap setup status

Updated: 26 October 2026, Europe/London.

## Operational

Mailcheap is deployed and healthy at https://newsletter.remotehumans.ai.
Bring Your Own Brain launched on 26 October at https://www.remotehumans.ai/byob:
the reader site adds real subscribers through `POST /api/v1/contacts`, with
confirmed opt-in. Signups are on and sending is off; the live health check on
26 October answered ok=true, sendingEnabled=false, signupsEnabled=true. The live
app still runs the single-admin release (main, 023a03a).

An upstream update is ready on branch `update/upstream-2026-10-26` and waits
for Elliott's go-ahead: see "Upstream update awaiting deployment" below.

- Admin login: https://newsletter.remotehumans.ai/login
- Newsletter: https://newsletter.remotehumans.ai/newsletters/6acdfdf439733a41284f204d
- Fork: https://github.com/remotehumans/mailcheap
- Coolify: https://cool.remotehumans.co
- Local checkout: /Users/elliott/Documents/AI Projects_local/mailcheap

## Upstream update awaiting deployment (26 October 2026)

Branch `update/upstream-2026-10-26` on https://github.com/remotehumans/mailcheap
merges upstream main (42ca6fc) into the fork. All 1,302 tests, ESLint, the
production Docker build and `git diff --check` pass. REVIEW.md records what
happened to each fork commit, the findings fixed on the branch and the residual
limits. Nothing was deployed, no email was sent and no contact or live
database row was touched.

What changes for us:

- Sign-in is an emailed six-digit code to an address in `ADMIN_EMAILS`. The
  admin password goes away.
- Data is scoped by account, so the live database needs
  `scripts/migrate-to-accounts.mjs` once, right after the deploy. Until it
  runs, the BYOB key answers 401 and the reader site says "Sign-ups open very
  soon".
- The BYOB API contract is unchanged and is tested with an old-format key.
- The licence is now AGPL-3.0-only. Keep the fork public.

### Database migration

No upstream migration exists. `scripts/migrate-to-accounts.mjs`, run inside
the app container:

1. Creates the owner's Better Auth user (verified email) and account, unless
   they exist.
2. Sets `accountId` on newsletters, contacts, campaigns, messages, events,
   apikeys and suppressions that have none.
3. Renames `sesMessageId` to `providerMessageId` on messages and events.
4. Drops replaced indexes: contacts `email_1` (rebuilt as partial),
   `subscribedAt_-1__id_-1`, `status_1_subscribedAt_-1__id_-1`; campaigns
   `status_1`, `startedAt_-1`; messages and events `sesMessageId_1`;
   suppressions `email_1`; alerts `key_1`. Mongoose builds the new indexes.

It prints a JSON report with counts only, is a dry run without `--apply`,
refuses an owner missing from `ADMIN_EMAILS`, and is safe to run again.

### Environment variables (names only)

Add in Coolify, runtime only:

- `BETTER_AUTH_SECRET`: the current `SESSION_SECRET` value, so every
  unsubscribe and confirm link already sent keeps working.
- `SUPPRESSION_HASH_KEY`: new, `openssl rand -base64 48`, never the same as
  the secret above. Save it in the vault; never change it.
- `ADMIN_EMAILS`: the inbox Elliott signs in with (proposed: e@remotehumans.ai).
  The old `ADMIN_EMAIL` is a placeholder address that can't receive codes.
- `EMAIL_FROM`: `Remote Humans <byob@mail.remotehumans.ai>`, the sender the
  current IAM policy allows. Sign-in codes go through SES from it.
- `SES_AWS_ACCOUNT_ID`: 473041657562.

Keep `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `SESSION_SECRET` until the new release
is verified, so a rollback still signs in. `SES_CONFIGURATION_SET` is no longer
read: each account gets its own SES configuration set. `APP_URL` is already a
build-time variable, which the static API docs need. Later, before sending:
`CRON_SECRET`, and Upstash Redis for shared rate limits.

### Deploy plan (needs Elliott's OK)

1. Decide the `ADMIN_EMAILS` address.
2. Back up the BYOB MongoDB (`mongodump` of database `mailcheap`) and check
   the archive opens.
3. Add the variables above in Coolify app `qeeqrl9snjfjoc4nrjpoeg8h`.
4. Deploy the branch (or merge it into main first). Expect a few minutes of
   reader-site signups answering "Sign-ups open very soon".
5. In the container: `node scripts/migrate-to-accounts.mjs
   --owner-email=<ADMIN_EMAILS address>`, check the counts against the
   dashboard's last contact total, then run it again with `--apply`.
6. Check that `/api/health` answers ok=true, sendingEnabled=false,
   signupsEnabled=true. Call the signup API with the BYOB key and an invalid
   email: 400 proves the key works without creating a contact.
7. Elliott signs in at https://newsletter.remotehumans.ai/signin with a code
   (one email to his own inbox) and checks the newsletter and contact counts.
8. After a day without problems, remove `ADMIN_EMAIL`, `ADMIN_PASSWORD` and
   `SESSION_SECRET`.

Rollback: redeploy 023a03a with the old variables still in place. The old
release ignores the new fields and collections. Its plain `contacts.email_1`
index then can't be rebuilt beside the partial one, which only logs an index
error. Restore the backup only if data is damaged.

Before sending is switched on (separate approval): sign in to AWS again (the
local CLI session expired on 26 October), widen IAM policy
**MailcheapSESRuntime** to the tenant and configuration-set calls in the
README with denials on deleting or changing `mail.remotehumans.ai`, add the
domain on the Domains page, and set `CRON_SECRET`.

## Completed

- Forked and cloned marclou/mailcheap. GitHub identifies remotehumans as a user
  account rather than an organisation.
- Reviewed source security and fixed the findings described in REVIEW.md.
- Passed 212 unit tests, ESLint, production build and git diff --check before
  provisioning. The runtime dependency audit reported zero known vulnerabilities.
- Fixed the failed Coolify deployment: the runtime image lacked curl/wget for
  Coolify's health check. Commit cf2e59a adds curl and CA certificates. The live
  deployment of that image passed readiness and HTTPS checks.
- Used the replacement Vaultwarden item **coolify rh api key** to restore
  read:sensitive access and update CLI context **remote-humans**.
- Deployed a private, persistent Coolify MongoDB with no public database port.
  The application now uses user **mailcheap**, restricted to readWrite on database
  **mailcheap**. Removed both bootstrap-password environment rows and the
  disabled one-time bootstrap task. No MongoDB root credential remains in the app.
- Generated the admin password/session secret and stored runtime secrets in
  Coolify, never build arguments or Git. Saved the admin login in the shared vault.
- Created Bring Your Own Brain, slug **bring-your-own-brain**, sender
  **Remote Humans <byob@mail.remotehumans.ai>**, with confirmed opt-in enabled.
  Welcome, cleanup and public archive are disabled. Postal address is saved:
  Node Unlock LTD, 124 City Road, London, EC1V 2NX, United Kingdom. Reply-to is
  **e@remotehumans.ai**, as selected by Elliott. The sender is an SES identity; no mailbox was created.
- Verified the newsletter and zero-contact counts persisted after redeployment.

## AWS / SES

- Existing account: **Curiosity Unlocked**, account ID **473041657562**.
- Region: **eu-north-1**, Europe (Stockholm).
- Installed the official AWS CLI and connected profile **byob-mailcheap** using
  the existing console session. No root access keys or new external account.
- Created domain identity **mail.remotehumans.ai**, Easy DKIM RSA 2048.
- Created custom MAIL FROM **bounce.mail.remotehumans.ai**, reject on MX failure.
- Created configuration set **mailcheap**, with SES open/click tracking off.
- Created standard SNS topic **mailcheap-ses-events**, SignatureVersion **2**.
  Its publish policy permits SES only from this account/configuration set.
- Configured bounce, complaint, delivery, delay, reject and rendering-failure
  events to SNS. Enabled SES account-level bounce and complaint suppression.
- Confirmed the HTTPS SNS subscription to
  https://newsletter.remotehumans.ai/api/webhooks/ses. This was an SNS protocol
  confirmation, not an email. No synthetic bounce or delivery event was published.
- After Elliott explicitly approved the exact scope, created IAM user
  **mailcheap-byob**, policy **MailcheapSESRuntime**, and one persistent access key.
  Sending permissions are restricted to **byob@mail.remotehumans.ai**, the domain
  identity and configuration set; remaining permissions read SES status/identities.
  Scoped runtime GetAccount/GetEmailIdentity reads passed.
- Saved the runtime key as **AWS SES - Bring Your Own Brain** in the shared vault
  and configured Coolify runtime variables.
- Submitted the production-access request; support case **179188520500640**.
  At submission, the SES API labelled review status DENIED, but the support correspondence
  says additional information is required before a final decision. It requests
  volume, opt-in, bounce handling and sample content/description. Do not interpret
  this as a final refusal without the case correspondence.
- MAIL FROM and DKIM are verified. SES reports VerifiedForSendingStatus=true
  and DkimAttributes.Status=SUCCESS. All three issued CNAMEs resolve correctly.
  Production access was initially false; it is now approved (14 October).
- Elliott approved posting the prepared response. It was submitted and visibly
  confirmed in case correspondence at 11:34 BST on 13 October. The response
  gives 500–1,000 initial subscribers, 2,000–4,000 newsletter emails/month plus
  confirmations, opt-in, suppression, content details, and successful DKIM.

Support case:
https://support.console.aws.amazon.com/support/home#/case/?displayId=179188520500640

The AWS Support CLI cannot read case correspondence without a paid support
subscription. The existing Basic console session can read it; no support-plan
upgrade was made or is required just to view this case.

## QStash

- Used the existing free EU region, endpoint
  https://qstash-eu-central-1.upstash.io.
- Saved existing credentials as **Upstash QStash - Bring Your Own Brain** in the
  shared vault and configured runtime-only Coolify variables.
- Authenticated read-only API returned 200. Both current and next signing keys
  passed live local-signature verification. The send-batch handler returned 409
  Sending is off; the scheduled handler safely ignored the empty request.
- Missing signatures return 403. No QStash jobs or schedules were published.
- No plan upgrade, payment details or account creation.

## Credentials and flags (names only)

Shared vault: organisation **AI Agents**, collection **AI Agent Logins**.

- **Mailcheap - Bring Your Own Brain**: saved admin login.
  Username: admin@newsletter.remotehumans.ai (application identifier, not a mailbox).
- **AWS SES - Bring Your Own Brain**: scoped IAM runtime credentials.
- **Upstash QStash - Bring Your Own Brain**: existing provider credentials.
- **coolify rh api key**: replacement Coolify token.
- **cloudflare-api-token-rhagi-ai-agents**: existing add-only DNS credential used.

Coolify runtime variables:
MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET,
SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, SES_CONFIGURATION_SET,
SES_SNS_TOPIC_ARN, QSTASH_URL, QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY,
QSTASH_NEXT_SIGNING_KEY. No secret variables are build-time variables.

**SENDING_ENABLED=false; SIGNUPS_ENABLED on since the 26 October launch.**
The app also blocks sandbox, unknown or disabled SES accounts even if the
sending flag is changed. Retain SESSION_SECRET to preserve old unsubscribe links.

## DNS records added

No existing DNS record was changed or deleted.

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| A | newsletter.remotehumans.ai | 91.98.23.109 | Proxied |
| TXT | _dmarc.remotehumans.ai | v=DMARC1; p=none; | Not applicable |
| CNAME | oodrm75sqjqkuhm5pvpukhuism4vd46i._domainkey.mail.remotehumans.ai | oodrm75sqjqkuhm5pvpukhuism4vd46i.dkim.amazonses.com | DNS only |
| CNAME | wyhkraryjcxyshwmjyezzqomqt4prncl._domainkey.mail.remotehumans.ai | wyhkraryjcxyshwmjyezzqomqt4prncl.dkim.amazonses.com | DNS only |
| CNAME | 4rfwhnfycx4ezxs7do7yp3kryzzhmzbp._domainkey.mail.remotehumans.ai | 4rfwhnfycx4ezxs7do7yp3kryzzhmzbp.dkim.amazonses.com | DNS only |
| MX | bounce.mail.remotehumans.ai | 10 feedback-smtp.eu-north-1.amazonses.com | Not applicable |
| TXT | bounce.mail.remotehumans.ai | v=spf1 include:amazonses.com ~all | Not applicable |

## Live verification

- HTTPS readiness: 200, database ping succeeds, both feature flags false.
- Saved admin login succeeds; session cookie is __Host-mailcheap_session,
  Secure, HttpOnly, SameSite=Lax, Path=/.
- Protected upload/signup APIs return 401 without credentials.
- Unsubscribe empty/invalid request returns 400.
- Unknown-topic SNS request returns 403; real AWS subscription confirmed.
- Unsigned QStash jobs return 403; both configured keys verified separately.
- Newsletter persists after redeployment; total contacts All/Active/Pending/etc: 0.
- Latest deployment **yfdu56g7sftbohjhl0puhcjq** finished successfully.
- Private MongoDB remains healthy; temporary bootstrap configuration removed.
- Local fork changes are pushed only to remotehumans/mailcheap.

## Newsletter details supplied on 13 October

Elliott supplied and Codex saved this footer address:

```text
Node Unlock LTD
124 City Road
London
EC1V 2NX
United Kingdom
```

The first-month planning estimate is **500–1,000 subscribers**, approximately
**2,000–4,000 newsletter emails/month** at four weekly issues, plus opt-in
confirmation emails (up to approximately 500–1,000 for first-month signups).
These are forecasts; current subscriber and contact counts remain zero.

Cloudflare Email Routing is enabled/ready. The only literal-address route found
is **e@remotehumans.ai**. **hello@remotehumans.ai** has no route, catch-all is
explicitly disabled with a drop action, and no matching received mail or vault
credential was found. Elliott selected **e@remotehumans.ai** for newsletter
replies; this is saved. No hello alias was created. No mail test was sent and
no existing routing/DNS record was changed.

## Production approval verified: 14 October 2026

AWS's email for case **179188520500640**, received at **13:33 BST** on
14 October, confirms immediate removal from the SES sandbox in Europe
(Stockholm). The email was read through the Gmail connector; the local Gmail
CLI currently needs reauthentication.

The existing scoped SES vault credential independently confirmed:

- ProductionAccessEnabled=true; SendingEnabled=true; review status GRANTED.
- Quota: **50,000 messages/day**, maximum rate **14 messages/second**.
- SentLast24Hours=0. No email was sent by this task.
- mail.remotehumans.ai: verified for sending; DKIM SUCCESS; MAIL FROM SUCCESS.
- Live HTTPS health endpoint returns ok=true, sendingEnabled=false and
  signupsEnabled=false.

The AWS dependency is resolved. The monitoring follow-up remains paused because
launch authorisation is now required. The existing SNS and QStash verification
is recorded above; actual email delivery and bounce handling have not yet been
exercised with email.

## Owner-requested delivery test: 14 October 2026

Elliott explicitly authorised one test to his Yahoo address. SES accepted one
message from **Remote Humans <byob@mail.remotehumans.ai>**, reply-to
**e@remotehumans.ai**, subject **Bring Your Own Brain: email delivery test**.
The message used configuration set **mailcheap** and the existing scoped runtime
credential. It included the saved postal address and identified itself as a test.

Message ID: 011001a13ab9865b-fc9cae76-1dd2-4d2b-b6e2-332e9e65b338-000000.

This was a direct SES transport test, not a Mailcheap campaign, subscription or
confirmation flow. SES acceptance does not establish Yahoo inbox placement.
Elliott must confirm receipt and whether it went to spam. No contact was created.
Production sending and signup flags remain false. The first local CLI attempt
failed JSON validation before sending; the corrected request was accepted once.

## Exact remaining steps

1. Elliott should confirm receipt of the requested Yahoo delivery test.
   Separate approval is required for confirmation emails and public signups;
   neither switch was changed.
2. After that approval, verify delivery, confirmation and unsubscribe end to
   end, plus bounce handling. Confirm the first issue and its recipients before
   a campaign is sent. There are no contacts in the last verified newsletter.
3. Public website signup integration is still a separate task. No website
   repository was changed. It must use a server-side Mailcheap integration;
   never expose a Mailcheap API key in browser code.

### AWS support response posted at 11:34 BST

Website/application: https://remotehumans.ai. Newsletter admin application:
https://newsletter.remotehumans.ai.

Email type: MARKETING. Bring Your Own Brain is a weekly publication from Remote
Humans. It covers AI tools and agents, how work is changing, and practical
examples of the human advantage. This is the planned content description; no
sample email has been sent.

Expected volume: 500–1,000 subscribers initially, about 2,000–4,000 newsletter
emails/month at four weekly issues, plus subscription-confirmation emails.
There are currently zero subscribers and zero contacts.

Recipient source: readers will sign up voluntarily on our website and confirm
their email through a double opt-in link. No purchased, scraped or imported
lists. Signups are currently disabled during setup/review.

Bounce/complaint handling: SES configuration set mailcheap publishes bounces,
complaints, deliveries, delays, rejections and rendering failures to SNS topic
mailcheap-ses-events. Its confirmed HTTPS subscription is
https://newsletter.remotehumans.ai/api/webhooks/ses. SNS signatures use version 2
and are verified before processing. Mailcheap suppresses bounces/complaints;
SES account-level bounce and complaint suppression are also enabled.
Every newsletter includes a visible unsubscribe link and RFC 8058 one-click
unsubscribe. The supplied legal business postal address is saved in the footer.

Region: eu-north-1. Sending identity: mail.remotehumans.ai. RSA 2048 Easy DKIM
CNAMEs have been published and resolve publicly. Custom MAIL FROM
bounce.mail.remotehumans.ai is verified. RSA 2048 Easy DKIM verification has now
succeeded, and SES reports VerifiedForSendingStatus=true and
DkimAttributes.Status=SUCCESS. Sending stays disabled until production approval
is confirmed.

Website signup integration remains a separate task; no website repository was
changed. Do not expose a Mailcheap API key in browser code.

## Infrastructure identifiers

- Server: Remote Humans Automations, 91.98.23.109
- Project: Remote Humans Apps; environment: production_internal
- App UUID: qeeqrl9snjfjoc4nrjpoeg8h
- MongoDB UUID: qcldvire3pxjrqd7eig5bf4j
- SNS: arn:aws:sns:eu-north-1:473041657562:mailcheap-ses-events

One expressly authorised owner delivery test was sent on 14 October. No
contacts, campaigns, external accounts or payment details were created.
remote-humans-agi and website repositories were not modified.
