# Editor passkeys

Passkeys are scoped to `https://edit.cottontailchildcare.com`. Each enrollment
requires an unexpired, one-use invitation generated through SSH plus the existing
editor password. There is no public enrollment or password-reset route.

Install dependencies with `npm ci` in `cms`. On first setup only, run
`node passkeys.js init`. State lives outside the repo at
`~/.config/cottontail-auth/passkeys.json`, mode 600. Back up this directory privately;
it contains public credentials, counters, invitation hashes, and enforcement state.
Never replace it with a blank file during deployments.

Create separate invitations from `/home/bryce/apps/cottontail/cms` on Ubuntu:

```sh
node passkeys.js invite Bryce
node passkeys.js invite Kristel
```

Each link expires after seven days, can enroll one passkey, and is replaced by
issuing a new link for that person and device label. To prepare two links at once,
use `node passkeys.js invite Kristel Mac` and `node passkeys.js invite Kristel iPhone`.
These are labels for keeping invitations separate; each link must still be opened
on the intended device by its owner. Open it on the intended person's own iPhone or
Mac, enter the editor password, and approve the Apple Passwords passkey prompt.
Then return to `/login` and sign in with the passkey to test it. Apple account
recovery and iCloud Keychain configuration remain under each person's control.
Do not share Apple accounts or use one person's enrollment link for the other.

Password sign-in stays enabled during setup. **Passkeys do not yet protect against
password-only entry until enforcement is enabled.** Check readiness:

```sh
node passkeys.js status
```

Once Bryce and Kristel have each enrolled AND signed in with their passkey:

```sh
node passkeys.js require
systemctl --user restart cottontail-cms
```

The CLI refuses enforcement before both are tested. Enabling it disables the
server's password login route and invalidates outstanding enrollment invitations;
the restart invalidates pre-existing password sessions. New invitations can still
be issued over SSH for additional approved devices. Sessions last 12 hours;
the enrolled passkey itself has no 30-day expiry.

## Lost device / recovery

Use existing trusted SSH access to Ubuntu, not a public recovery link:

```sh
cd /home/bryce/apps/cottontail/cms
node passkeys.js recover
systemctl --user restart cottontail-cms
```

This temporarily restores password sign-in and cancels outstanding invitations.
Keep this window short, issue new invitations only to approved people, test both
passkeys, and require passkeys again. For a lost or compromised passkey, revoke
that person's credentials with `node passkeys.js revoke Bryce` (or `Kristel`),
then restart the service before restoring enforcement. Do not delete the whole
state file: missing or corrupt state fails closed.

Verification: `npm test` uses generated P-256 credential keys and actual WebAuthn
verification to test invitation gating, signatures, origin/challenge checks,
required device verification, replay rejection, persistence, and enforcement.
