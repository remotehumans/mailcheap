# Bring Your Own Brain: Mailcheap setup status

Updated: 13 October 2026, Europe/London.

## Operational

Mailcheap is deployed and healthy at https://newsletter.remotehumans.ai.
HTTPS and the saved admin login passed live verification. Bring Your Own Brain
exists, has confirmed opt-in enabled, and has zero contacts. Sending and signups
remain disabled. No email was sent; no contact was created or imported.

- Admin login: https://newsletter.remotehumans.ai/login
- Newsletter: https://newsletter.remotehumans.ai/newsletters/6acdfdf439733a41284f204d
- Fork: https://github.com/remotehumans/mailcheap
- Coolify: https://cool.remotehumans.co
- Local checkout: /Users/elliott/Documents/AI Projects_local/mailcheap

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
  The SES API currently labels review status DENIED, but the support correspondence
  says additional information is required before a final decision. It requests
  volume, opt-in, bounce handling and sample content/description. Do not interpret
  this as a final refusal without the case correspondence.
- MAIL FROM is verified. DKIM remains PENDING at the final check; all three
  issued CNAMEs resolve correctly through public DNS. AWS advises allowing up to
  72 hours for verification. Production access remains false.

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

**SENDING_ENABLED=false; SIGNUPS_ENABLED=false.**
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

## Exact remaining steps

1. Approve posting the prepared response in support case 179188520500640.
   Codex requested explicit permission for this external support message.
   DKIM must be verified in eu-north-1 before AWS grants production access.
2. Await AWS approval. If AWS requests further evidence, answer that case;
   do not create another AWS account or buy a support plan for this setup.
3. After provider configuration, DKIM and SES production access are verified,
   and the reply-to is set, review launch readiness with Codex. This task leaves
   both sending and signups off. No test email is authorised.

### Prepared AWS support response

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
bounce.mail.remotehumans.ai is verified. DKIM verification is pending at the
time of this response. Sending stays disabled until identity verification and
production approval are confirmed.

Website signup integration remains a separate task; no website repository was
changed. Do not expose a Mailcheap API key in browser code.

## Infrastructure identifiers

- Server: Remote Humans Automations, 91.98.23.109
- Project: Remote Humans Apps; environment: production_internal
- App UUID: qeeqrl9snjfjoc4nrjpoeg8h
- MongoDB UUID: qcldvire3pxjrqd7eig5bf4j
- SNS: arn:aws:sns:eu-north-1:473041657562:mailcheap-ses-events

No email or contact action occurred. No external account or payment details were
created. remote-humans-agi and website repositories were not modified.
