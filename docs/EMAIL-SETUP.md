# Email that lands: the Fonderie pattern

How to take a Fonderie app from "SMTP is configured" to "a real recipient gets a
message that authenticates, looks like your product, and can be replied to".

Written from doing it end to end. Every trap below was hit in practice, and most
of them fail **silently** — the dashboard says verified, the send reports
success, and the message quietly goes to spam or authenticates as nobody.

> **The rule that matters most:** a green provider dashboard tells you the DNS
> records exist. It does not tell you a delivered message authenticated. Only the
> raw headers of a received email do that.

---

## The shape

```
From:      LeadEasyGen <hello@email.example.com>   ← app's brand, sending subdomain
Reply-To:  hello@example.com                       ← an address that RECEIVES
DKIM d=    email.example.com                       ← aligned with From
SPF        checked against send.email.example.com  ← the envelope, not the From
MX         example.com → your inbox provider       ← untouched by any of this
```

Four identities that people routinely conflate. Keeping them separate is most of
the work.

| | what it is | who cares |
|---|---|---|
| **From** | the authenticated sending identity | DKIM, DMARC, and the recipient |
| **Envelope / return-path** | where bounces go | SPF |
| **Reply-To** | where humans reply | your inbox |
| **MX** | where inbound mail is delivered | everyone who emails you |

---

## 1. Brand the shell with the app's name

`@fonderie/courier` renders every template inside a shared shell. Until you tell
it otherwise, that shell is headed **Fonderie** — the framework, not your product.

A recipient signed up for *your* app and has never heard of Fonderie. On a
receipt that reads as a different company at best, and as phishing at worst.

```ts
new CourierModule({
  brandName: 'LeadEasyGen',   // ← set once; every template inherits it
  channels: { … },
  email: { … },
})
```

Set it **once** on the config rather than per message. A message may still
override it in its own data — a multi-tenant app can brand per workspace.

Unset falls back to `Fonderie` rather than rendering an empty heading: a blank
heading looks broken, which is worse than unbranded.

The shell also carries **"Powered by Fonderie"** below the card, on the canvas
rather than inside the frame. An app that overrides the whole shell
(`_layout.html`) owns that decision — and owns keeping its frame current.

---

## 2. Choose the sending domain

Three options. They differ in one thing: **where sending reputation accrues.**

| | From address | reputation lands on | apex SPF |
|---|---|---|---|
| **A. Apex** | `hello@example.com` | the apex | may need merging |
| **B. Apex + custom return-path** | `hello@example.com` | the apex | untouched |
| **C. Sending subdomain** | `hello@email.example.com` | the subdomain | untouched |

**B is the pragmatic default.** The provider authenticates via
`send.example.com` (the envelope), so your apex SPF is never touched, and you
keep the cleanest possible From address. Reputation still accrues to the apex.

**C is what mature senders do.** Anthropic sends transactional mail from
`email.anthropic.com` (Mailgun) and marketing from `mail.anthropic.com`
(HubSpot), with the apex reserved for corporate mail. If transactional mail ever
goes complaint-heavy, it cannot touch the domain serving your site.

**Pick C when** you have — or will soon have — more than one *kind* of mail.
Marketing blasts and password resets should never share a reputation. Retrofitting
the split after the apex has months of sending history is much more annoying than
starting there.

**Pick B when** there is one kind of mail, low volume, and a clean address is
worth more than isolation you do not yet need.

> C has a consequence that surprises people: a sending subdomain has **no MX**,
> because a sending domain has no reason to receive. Replies to the From address
> **bounce**. See §5.

---

## 3. The DNS records, and what breaks them

Providers differ in detail; the shapes are the same.

| record | host | purpose |
|---|---|---|
| DKIM | `<selector>._domainkey[.sub]` | signing key |
| Return-path | `send[.sub]`, sometimes `rsend[.sub]` | envelope / SPF |
| DMARC | `_dmarc` | policy + reporting |

### Registrars strip the domain

If the provider says a record is for `send.email.example.com`, most registrars
want the Host as `send.email` — they append the rest. Entering the full name
produces `send.email.example.com.example.com`, which resolves nowhere and looks
identical in the UI.

### Duplicate records invalidate each other

**Two SPF records on one name make both invalid.** Same for two DMARC records.
Two CNAMEs on one host is invalid DNS outright — resolvers pick unpredictably, so
a leftover parking CNAME can work for weeks and then serve a parking page.

```bash
dig +short @8.8.8.8 CNAME www.example.com   # must return exactly ONE target
```

### Each provider domain has its OWN DKIM key

Adding a second domain (apex **and** subdomain) means **two** DKIM records at two
hosts, with **different keys**. They coexist.

> Hit in practice: the subdomain's key was pasted over the apex's existing record
> instead of added alongside it. The provider kept showing *Verified* from a
> cached check while live mail signed against a key no longer in DNS. Nothing
> bounced. It would have surfaced only in a recipient's headers.

**Add a new record. Never edit an existing one** to onboard a second domain.

### Copy the key with the button

Provider UIs truncate long keys with `[…]`. Selecting the visible text gives a
broken key that fails silently. Use the copy control.

### The registrar may own your apex SPF

Namecheap's *Email Forwarding* feature publishes and **locks**
`v=spf1 include:spf.efwd.registrar-servers.com ~all`. You cannot merge into it.

That is not a problem — it is the argument for options B or C, where SPF is
evaluated on a subdomain you control.

---

## 4. DMARC: get it parsing, then leave it alone

```
_dmarc   TXT   v=DMARC1; p=none; rua=mailto:hello@example.com
```

**It must begin with `v=DMARC1`.** Anything else and every receiver discards the
whole record — you have no DMARC while the registrar UI looks configured.

> Hit in practice: a paste landed as `vav=DMARC1; p=none;`. Valid-looking in the
> UI, inert everywhere else.

**`p=none` without `rua` does nothing at all.** The reporting address is the
entire point at this stage.

**Watch for a trailing dot.** Some registrars append one to values that look like
hostnames, producing `rua=mailto:hello@example.com.` — reports may be dropped.

**Tighten later, not now.** `p=none` → `quarantine` → `reject`, only once reports
show nothing but your own senders. Going straight to `reject` before SPF and DKIM
are confirmed aligned bounces your own mail. When you do tighten, set **`sp=`**
too — subdomains inherit the apex policy otherwise.

---

## 5. Reply-To, once the From cannot receive

A sending subdomain has no MX. Replies to the From address bounce.

People **do** reply to transactional mail: a question about a receipt, a "this
wasn't me" about a password reset. A bounced reply is worse than no reply,
because the sender believes they reached you and never follows up.

```ts
email: {
  provider: 'smtp',
  from: 'LeadEasyGen <hello@email.example.com>',
  replyTo: 'hello@example.com',   // ← an address that actually receives
  smtp: { … },
}
```

`replyTo` never substitutes for `from`. They are different headers with different
jobs — From carries the authenticated identity that DKIM and DMARC align against;
`replyTo` only routes humans. Conflating them breaks alignment.

Requires `@fonderie/courier` ≥ 7.4.0.

---

## 6. Provider options worth turning OFF

**Click tracking — off for transactional mail.** It rewrites every link through a
tracking domain, including **password-reset and email-verification links**. An
unrecognisable redirect in a security email is what phishing looks like, some
filters score it that way, and it puts a third party in the critical path of
account recovery. You gain click counts on messages where nobody needs them.

**Open tracking — off.** Providers themselves warn it is inaccurate. Apple Mail
Privacy Protection prefetches images at delivery, so it reports opens that never
happened; Gmail proxies them, so the IP is never the recipient's. If you want
open data, self-host it and be honest about what it measures.

**Inbound receiving — off**, unless you genuinely want to process inbound mail
programmatically. Enabling it takes over the **apex MX** and silently breaks
whatever currently delivers your mail.

---

## 7. Verify with headers, never with a dashboard

Send one real message to an address you control, open the raw source, and confirm
all three:

```
spf=pass      dkim=pass      dmarc=pass
```

with the DKIM `d=` equal to your From domain. Alignment is the part a dashboard
cannot tell you.

Then check what the app itself reports:

```bash
# whatever your ops route is — courier's message log is the source of truth
curl -s -X POST https://api.example.com/internal/cron/purge \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.email'
# { "sent": 6, "failed": 0, "pending": 0, "lastError": null }
```

`failed: 0` means the provider accepted them. Only headers say they
authenticated.

### And keep checking, after the day you set it up

Headers prove one message, once. The records can be edited, a registrar can
rewrite them, a provider can rotate a key — and none of that produces an error,
because the failure happens at the *receiver*. `checkSenderDns` from
`@fonderie/courier` asks DNS the same questions on a schedule:

```ts
const report = await checkSenderDns(config.email.from, {
  dkimSelectors: ['resend'],                       // see below
  returnPathDomain: 'send.email.example.com',      // see below
});
for (const line of describeSenderDnsProblems(report)) console.error('[courier]', line);
```

Public TXT lookups only — no provider API, no credentials, works with any SMTP
backend.

**Both options matter, and both encode a trap this document already warns about.**

`returnPathDomain` exists because **SPF is checked against the envelope, not the
From** (§ The shape). Without it the check looks for SPF on the From domain,
which on a correctly-configured provider-owned return-path has none — and would
report a textbook-correct setup as broken.

`dkimSelectors` exists because **a selector cannot be discovered from DNS**. It
is chosen by whoever signs and appears only in a sent message's header
(`s=resend`); DNS has no way to list what sits under `_domainkey`. Without it the
check cannot tell "no SPF because the provider owns the return-path, and DKIM
carries alignment" (correct) from "no SPF and no DKIM" (broken) — so it reports
the ambiguity rather than guessing. Supply the selector and it gives a verdict.

Findings that are real but not failures — a `p=none` policy, an absent SPF
covered by DKIM — are reported as advice and deliberately do **not** fail the
check. See [OPERATIONS.md](OPERATIONS.md#reconciling-what-you-declare-against-what-actually-holds-it).

---

## Order of operations

Nothing here is destructive if done in this order, and every step is reversible.

1. **Clean the zone** — delete registrar parking records and duplicate CNAMEs
2. **Add the domain** at the provider, tracking and receiving **off**
3. **Add its DNS records** — new rows, correct hosts, copied values
4. **Verify with `dig`** against the *authoritative* nameserver, not a cache
5. **Fix DMARC** so it parses, with `rua`
6. **Set `brandName`** so the shell is yours
7. **Set `replyTo`** if the From domain cannot receive
8. **Switch `SMTP_FROM`** and redeploy
9. **Send one real message and read the headers**
10. **Only then** remove any previous sender

Step 10 last, always. Add before remove — the old sender is your rollback.

---

## Quick diagnosis

| symptom | cause |
|---|---|
| Provider says Verified, mail fails DKIM | key in DNS ≠ key the provider expects — usually an edited record |
| SPF fails on everything | two SPF records, or the registrar's locked one being edited |
| DMARC reports never arrive | record does not start with `v=DMARC1`, or no `rua`, or a trailing dot |
| Host resolves two different ways | duplicate CNAME — often a leftover parking record |
| Replies bounce | From is on a domain with no MX and no `Reply-To` |
| Inbound mail stops | provider's "receiving" toggle took over the apex MX |
| Record not found at all | Host field contained the full domain, so it was appended twice |
| Emails headed with the wrong company | `brandName` unset on the courier config |

---

## Reference

| | |
|---|---|
| Shell, `brandName`, layout override | `@fonderie/courier` → `src/templates/layout.ts` |
| `replyTo`, send paths | `@fonderie/courier` → `src/channels/email.ts` |
| Channel config | `ICourierConfig.email` |
| Delivery state | `fonderie_message_log` |
