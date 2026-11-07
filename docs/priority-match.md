# Priority Match

Priority Match lets an operator-designated Premium user send one highlighted invitation to the profile currently open in their feed.

The recipient receives the sender's profile with **Accept** and **Decline** buttons. No like is created and no match is created until the recipient presses **Accept**. Declining removes the invitation. Existing skip history in either direction blocks sending or accepting an invitation.

## Enable Premium

This repository does not currently include subscription billing or payment verification. Premium is therefore an operator-managed entitlement for now.

After applying migrations, an operator can enable Premium for a Telegram user ID in the Cloudflare D1 database:

```sql
UPDATE users SET is_premium = 1 WHERE id = <TELEGRAM_USER_ID>;
```

To revoke it:

```sql
UPDATE users SET is_premium = 0 WHERE id = <TELEGRAM_USER_ID>;
```

A Premium user opens a profile in the feed and sends `/priority` to invite that person. Apply database migrations with the project's normal D1 migration procedure before deploying the code.
