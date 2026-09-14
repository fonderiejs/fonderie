---
'@fonderie/auth': minor
---

Security: linking an OAuth identity now revokes an **unverified** password on
the account it links into.

Linking is by email, which is what makes "one person, one account" work — but
it means the provider merges into whatever row already holds that address, and
anyone can register an address they do not own. Only verification proves
otherwise.

The sequence that was exploitable:

1. someone registers `victim@example.com` with a password and never verifies
2. the real owner later signs in with Google as `victim@example.com`
3. `upsertByProvider` merges into the existing row — the provider's
   `email_verified` claim only proves the *provider* side
4. the same statement sets `email_verified_at`, so the account is now treated
   as verified
5. the earlier registrant's password still works, on a now-trusted account

Enabling `requireVerification` does not close this. It gates an account while
unverified, and step 4 is exactly the moment that gate lifts.

So an unverified password is now dropped at the moment of linking. Read it as:
a password on an unverified account is a *claim*, not a credential — nobody
ever proved that mailbox belongs to whoever set it, and the provider has just
proven it belongs to the person signing in.

**This does revoke a credential**, in one case only: the prior row existed,
had a password, and had never been verified. A verified account linking a
provider keeps its password — the ordinary "I use both" flow is untouched, and
so is a returning OAuth user.

Legitimate users lose one password reset and nothing else; they own the
mailbox, so the reset reaches them. Someone who does not own it cannot receive
that mail, which is the point.

The owner is told. A `password-revoked` notice ships with a default template
and is sent to the address the provider just proved ownership of — so it
reaches the right person, and a password that silently stops working is no
longer something the user has to diagnose. It fires ONLY on an actual
revocation; claiming one that did not happen would be worse than silence.

`upsertByProvider` also returns `clearedUnverifiedPassword` for callers that
want to react themselves.
