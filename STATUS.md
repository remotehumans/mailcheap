# Bring Your Own Brain: Mailcheap setup status

Updated: 12 October 2026.

## Completed

- Forked https://github.com/marclou/mailcheap to
  https://github.com/remotehumans/mailcheap.
  GitHub identifies remotehumans as a user account, not an organisation.
- Cloned into /Users/elliott/Documents/AI Projects_local/mailcheap.
- Completed the source security review in REVIEW.md and pushed the fixes.
  The security release is 274b029; the database bootstrap addition is b3bad35.
- Passed 212 unit tests, ESLint, production build and git diff --check.
  The runtime dependency audit reported zero known vulnerabilities.
- Created a private, persistent Coolify MongoDB with no public database port.
- Created the Coolify app and configured runtime-only secrets. APP_URL is also
  available to the build; passwords and signing secrets are not build arguments.
- Generated and saved the admin login as **Mailcheap - Bring Your Own Brain** in
  Bitwarden organisation **AI Agents**, collection **AI Agent Logins**.
- Added the two absent DNS records below. No existing records were changed.
- Refreshed and checked the vault. No AWS/SES or Upstash/QStash credentials were
  found. No accounts were created.
- Sending and signups are configured off. The code additionally refuses SES
  sandbox/unknown/disabled-account sending even if SENDING_ENABLED is enabled.

## Current blocker: Coolify log access

The first application deployment failed and the app is not healthy or live.
The configured CLI token has read/write access but lacks read:sensitive.
Coolify redacts deployment logs, database passwords, private keys and environment
values. This prevents diagnosis of the deployment failure. The older Coolify API
credential in Bitwarden returns 401 and is not a usable replacement.

Add **read:sensitive** to the token used by the **remote-humans** CLI context,
keeping read/write. Use Coolify > Keys & Tokens > API tokens. If a replacement is
required, update the CLI context or save it in Bitwarden, never in chat.
A root token is not needed.

Official permission reference:
https://coolify.io/docs/core/security/credentials/api-tokens

## URLs and resource identifiers

- Intended app: https://newsletter.remotehumans.ai
- Intended admin login: https://newsletter.remotehumans.ai/login
- Fork: https://github.com/remotehumans/mailcheap
- Coolify: https://cool.remotehumans.co
- Server: Remote Humans Automations, 91.98.23.109
- Project: Remote Humans Apps; environment: production_internal
- App UUID: qeeqrl9snjfjoc4nrjpoeg8h
- MongoDB UUID: qcldvire3pxjrqd7eig5bf4j
- Failed deployment UUID: ttzgdvl86c0wa05g2tegtmz6

HTTPS and admin login have **not** passed live verification. The named newsletter
has **not** yet been created; that follows a healthy deployment.

## Credentials and flags (names only)

- Bitwarden login: Mailcheap - Bring Your Own Brain
- Login identifier: admin@newsletter.remotehumans.ai. This is an application
  username, not a newly created email mailbox.
- Coolify: MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET
- SENDING_ENABLED=false; SIGNUPS_ENABLED=false
- BOOTSTRAP_DATABASE_PASSWORD: temporary, still configured. Once the app is
  healthy, create the mailcheap database-scoped readWrite user, replace the
  initial bootstrap URI, and remove this variable and the one-time task.
- Existing Cloudflare credential: cloudflare-api-token-rhagi-ai-agents
- Existing Coolify CLI context: remote-humans
- Existing Bitwarden coolify-api-token is invalid and was not used to configure
  the application.

## DNS records added

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| A | newsletter.remotehumans.ai | 91.98.23.109 | Proxied |
| TXT | _dmarc.remotehumans.ai | v=DMARC1; p=none; | Not applicable |

The DMARC name had no existing record when checked. No SES DKIM or MAIL FROM
records have been added because SES has not yet issued identity-specific values.
Never invent those DKIM records.

## Remaining operator steps after Coolify access is restored

### 1. AWS / SES

Use your existing AWS account, or create one yourself if you do not have one.
Enable MFA. Do not supply root account access keys.

Save setup credentials in Bitwarden as **AWS - Mailcheap setup**, with:

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_SESSION_TOKEN, if using temporary credentials
- AWS_REGION, for example eu-west-2

The setup identity needs scoped permission to create/read the SES identity
mail.remotehumans.ai, set its MAIL FROM domain, manage configuration set
mailcheap, create/configure/subscribe SNS topic mailcheap-ses-events, and
create an IAM runtime user with its scoped inline policy and access key.
It does not need permission to send any email for this setup. Do not grant
unrelated AWS administration.

Codex can then configure domain identity/DKIM, bounce.mail.remotehumans.ai,
configuration set mailcheap, SNS SignatureVersion 2 and its SES event destination,
the HTTPS subscription, and a least-privilege runtime IAM user. Codex will add
only the issued absent DNS records, and store runtime SES credentials in Coolify.

Request SES production access **in that same region** after domain verification:
SES > Account dashboard > Get set up > Request production access. Select
Marketing, website https://remotehumans.ai, English, and a real monitored contact
address. Explain that Bring Your Own Brain is a weekly opt-in publication,
uses confirmed opt-in, provides one-click unsubscribe, and suppresses bounces
and complaints. No test email is needed to submit that request.

Reference: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html

### 2. Upstash / QStash

Use an existing Upstash account, or create one yourself. Open QStash and save a
Bitwarden item **Upstash QStash - Bring Your Own Brain** containing:

- QSTASH_TOKEN
- QSTASH_CURRENT_SIGNING_KEY
- QSTASH_NEXT_SIGNING_KEY
- QSTASH_URL if using a non-default endpoint/region

Codex can then configure Coolify and verify signature rejection without sending
email. An Upstash Redis account is optional for shared rate limiting; the initial
app has one process and memory limits. Do not enable multiple app processes
without shared rate limiting.

Reference: https://upstash.com/docs/qstash/overall/getstarted

### 3. Newsletter details and launch

Provide the real business postal address and a monitored reply-to email.
The intended sender is **Remote Humans <byob@mail.remotehumans.ai>**.
No mailbox has been created at that address.

After a healthy app deployment, Codex will create Bring Your Own Brain with slug
bring-your-own-brain, confirmed opt-in, welcome and cleanup disabled, and no
contacts. Until provider setup and production access are verified, keep sending
and signups off. The future website signup integration is separate; no website
repository has been changed and no browser-exposed API key should be used.

## Still to verify and complete

- Diagnose and repair the failed deployment using its logs.
- Replace the temporary MongoDB bootstrap connection with the scoped runtime user.
- Remove temporary bootstrap configuration and any one-time task.
- Verify HTTPS, admin login, secure cookie flags, protected-route rejection,
  invalid unsubscribe/job/webhook rejection, and data persistence after restart.
- Create the newsletter and verify it has zero contacts.
- Configure AWS and QStash once existing or user-created accounts are available.
- Keep SENDING_ENABLED=false until SES production access is verified.

No email has been sent. No contact has been imported or created. No external
account or payment details were created. Changes and pushes are limited to the
Mailcheap fork; remote-humans-agi and website repositories were not changed.
