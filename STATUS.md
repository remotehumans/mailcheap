# Bring Your Own Brain: Mailcheap setup status
Updated: 12 October 2026

## Done
- Read the full approved brief.
- Created the fork: https://github.com/remotehumans/mailcheap
- Confirmed GitHub identifies remotehumans as a user account, not an organisation.
  The fork is at the requested repository address.
- Inspected security-relevant source directly through GitHub.
- Saved the preliminary review in REVIEW.md.
- Identified the existing Remote Humans Automations Coolify server:
  91.98.23.109, server UUID ao484s8ook4c4osggos44sgs.
- Identified Remote Humans Apps project, production_internal environment.

## Genuine blocker
The Mac has approximately 100–140 MB available and returns
"No space left on device" for the clone directory, shell temporary files,
and the Bitwarden CLI cache lock.
Deleting this chat's temporary screenshots did not resolve it.
Pruning unused uv cache entries found no unused entries.

The local clone has not been created.
This STATUS.md is saved in the fork because local file creation is blocked.
No security fixes have yet been implemented or tested.

## URLs
- Fork: https://github.com/remotehumans/mailcheap
- Intended dashboard: https://newsletter.remotehumans.ai (not deployed)
- Intended local checkout:
  /Users/elliott/Documents/AI Projects_local/mailcheap

## Credential names and state
- "Mailcheap - Bring Your Own Brain": planned Bitwarden login item;
  not created. Target collection: "AI Agent Logins".
- ADMIN_PASSWORD and SESSION_SECRET: not generated or configured yet.
- AWS / Amazon SES credentials: presence not determined because Bitwarden
  lookup failed. Do not treat this as an absent AWS account.
- Upstash / QStash credentials: presence not determined for the same reason.
- Cloudflare API credentials: not yet verified.
No secret values are included in this report.

## DNS records added
None. Existing records were not changed or deleted.

## Deployment and data state
No application or MongoDB instance has been created for this setup.
No AWS identities, IAM users, SNS topics, QStash schedules or new accounts
have been created. No contacts were imported and no email was sent.
Sending must remain disabled with SENDING_ENABLED=false when deployed.

## Elliott's exact next step
Free at least 3 GB on the Mac, then ask Codex to resume this approved setup.
Do not send credentials in chat and do not create AWS or Upstash accounts yet.
The existing vault must first be checked once its CLI can operate.

## Work to resume
1. Clone the existing fork into the intended local checkout.
2. Complete REVIEW.md, fix serious findings, test, and push only this fork.
3. Check the vault for AWS, QStash and Cloudflare credentials and confirm
   the shared login collection.
4. Create a private Coolify MongoDB and the application. Generate secrets
   directly into Coolify and save the admin login in Bitwarden.
5. Add only the required absent DNS records. Verify HTTPS and login.
6. Configure SES identity mail.remotehumans.ai, DKIM, custom MAIL FROM
   bounce.mail.remotehumans.ai, configuration set mailcheap, SNS version 2,
   and a least-privilege runtime IAM user if existing AWS access permits.
7. Configure QStash only with an existing account.
8. Create the Bring Your Own Brain newsletter with no contacts.
9. Verify disabled sending. If AWS/Upstash credentials are actually absent,
   give Elliott the precise account and credential requirements.
10. Keep sending disabled until SES production access is verified.
