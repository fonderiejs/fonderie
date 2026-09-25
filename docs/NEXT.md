# What to work on next

Living doc. Opened 2026-09-25 after a session that closed a CI hang six release
cycles old, themed the operator console, and made the config brick usable for
the first time. Update it as items close; do not fork it.

Ordered by what it costs to leave undone, not by effort.

---

## 0. ~~UNVERIFIED — confirm LeadEasyGen actually booted~~ ✅ CLOSED 2026-09-25

Verified live against `api.leadeasygen.com`:

```
/readyz               {"status":"ready","dependencies":true}
/_admin/ui            200   themed shell, 4294 bytes, 0 external font fetches
/_admin/ui/app.js     200   65 token refs, switcher present, 0 stray hex
/_admin/environment   401   EXISTS ⇒ the admin 1.0.0 rename is deployed
/_admin/secrets       401   EXISTS ⇒ ConfigModule registered and mounted
```

The two decisive ones are the 401s. `/_admin/environment` answering 401 rather
than 404 proves the rename shipped; `/_admin/secrets` answering at all proves
`ConfigModule` registered — which can only happen if `CONFIG_SECRET_KEY` was
valid *and* the boot-time table read succeeded. That was the risk; it is clear.

The host is not recorded in the repo (only the env var *name*); it was found by
probing `leadeasygen-api.vercel.app` and `api.leadeasygen.com`.

<details><summary>Original item, kept for the reasoning</summary>

**Do this before anything else.** `543a500` registers `ConfigModule`, and its
manager reads `fonderie_config` **during boot**, before any route is served. If
the table were missing the API would fail at *startup*, not on first request.

The migration is confirmed applied (63 applied, config absent from pending), and
CI is green — but **CI proves nothing here**: the `API e2e (MFA)` job runs
against a local postgres service, not the deployment. Nobody has opened the
deployed console since the merge.

- **Check:** open `/_admin/ui`. It should load themed, with a System/Light/Dark
  switcher bottom-right and a working **Config & secrets** page.
- **If it 500s:** revert `543a500` (the wiring). The schema commit beneath it
  (`af420f6`) is inert — it only adds three unused tables.

</details>

---

## 1. ~~Nothing calls `app.shutdown()`~~ ✅ CLOSED 2026-09-25

The LeadEasyGen worker (`leadeasygen-api@c4e6057`) now holds its `FonderieApp`
and calls `app.shutdown()` during SIGTERM, ahead of the existing explicit
teardown. It had been building the app, booting it and discarding the
reference — correct for what it named, silently wrong for anything it did not.

Order: `shutdown()` first (it takes the notification bus down via
`EventsModule.stop()`), then the existing loop for the scrape bus, which belongs
to no app. Both idempotent, which the double-SIGTERM path already relied on.

Still true and worth knowing for the next consumer:

<details><summary>Original item</summary>

## Nothing calls `app.shutdown()`

`@fonderie/core` 0.21.0 shipped `IFonderieModule.stop?()` and
`FonderieApp.shutdown()`, and **no code anywhere calls it.** A shutdown contract
nobody invokes is exactly the "check that checks nothing" pattern this session
kept tripping over.

Three modules implement `stop()` today — verified against the built artifacts,
not a grep:

| module | releases |
|---|---|
| `ConfigModule` | TTL refresh interval, LISTEN client |
| `EventsModule` | transport's pool, LISTEN client, poll loop |
| `WebhooksModule` | retry timer (predates the contract; it had grown its own `stop()` with nothing to call it) |

**Where it actually matters:** the LeadEasyGen **scrape worker on Cloud Run**,
which really does receive SIGTERM. The API on Vercel never shuts down cleanly,
so it gains nothing.

</details>

`examples/leadeasygen/microservices/api/src/worker.ts:243` already has a
`shutdown(signal)` handler with a forced-exit timeout, wired to SIGINT/SIGTERM.
**Read it before changing it** — the work is likely routing it through
`app.shutdown()` rather than writing a new path, and it may already be close to
right.

---

## 2. The CI hang: fixed, not yet proven

Root cause was real and is fixed (`@fonderie/events` 5.8.1, PR #454). Four
consecutive green runs since, including two Release runs at 3–4 minutes that had
previously hung to timeout twice in a row.

But it reproduced at roughly **one in three**, so four greens is *consistent
with* fixed, not proof. **No action — just don't re-open it on one bad run.**

If it recurs, `TURBO_LOG_ORDER: stream` (PR #452) means the dump from the
process actually hanging is now printed and names it. That is the whole reason
this was findable at all.

### The postmortem, because the lesson generalises

`runWorker(...).stop()` awaited the in-flight drain unconditionally:

```ts
await inFlight?.catch(() => {});                              // froze here
if (server) await new Promise((r) => server.close(() => r())); // never reached
```

A drain that never settles froze `stop()` **before** the server closed, so a
listening socket held the process open. `fail 0`, no error, runner never exits.

**Why it took six cycles:** turbo's `--log-order` defaults to `grouped` in CI,
which flushes a task's output *when the command finishes*. A hung task never
finishes, so its dump was never printed — only `npm test` and `turbo test`,
whose stderr goes straight to the job log. That absence was read as *"every
child has exited, so turbo holds a dead handle"*, and every theory built on it
was inference from a swallowed signal.

**Three diagnoses were wrong. Do not resurrect them:**

1. *The `pg.Pool` leak in `PGTransport.stop()` is the hang* (PR #448). The leak
   was real and the fix stands, but it was not this. One green run after a
   rebase looked like confirmation; for an intermittent bug it proves nothing.
2. *tsx doesn't pass `NODE_OPTIONS` to children.* False — verified directly, the
   probe fires in the CLI, the runner and the per-file child alike.
3. *Keep-alive blocks `server.close()`.* Not on Node 22 (0/8 locally), and the
   test written against it passed **with and without** the fix, so it was
   discarded rather than shipped as false assurance.

**The method that worked:** make the missing signal appear, then read it. Two
bisects (25 jobs) and several hypotheses cost a day; once the log streamed, the
fix took twenty minutes. *When a diagnosis rests on an absent signal, first
prove the signal would have appeared.*

---

## 3. Config brick: two sharp edges, no owner

Shipped and working, but both of these will bite eventually:

- **`CONFIG_SECRET_KEY` is effectively non-rotatable.** Stored secrets are
  AES-GCM ciphertext under it and the brick has **no re-encrypt path**. Losing
  or changing the key makes every stored secret undecryptable. A
  `rotateSecretKey(old, new)` that re-encrypts in a transaction is the fix;
  until then, treat the key as permanent.
- **LISTEN invalidation is off on Vercel.** It needs a dedicated connection,
  which a transaction-mode pooler refuses, so the TTL poll is the only refresh
  path. A config change takes up to `ttl` (default 30s) to propagate. Fine
  today; worth knowing before someone debugs "my config change did nothing".

---

## 4. Housekeeping

- `settings.local.json` — untracked at the fonderie root and not gitignored.
- Two merged `chore/*` branches still on the `leadeasygen-api` remote.
- `gh` here authenticates as **`fonderiejs`**, which is *not* a collaborator on
  `louischoleski/leadeasygen-api`. Branches push over SSH; PRs cannot be opened
  or merged. Either add the collaborator or expect to merge that repo by hand.

---

## What is NOT next

Checked this session and found already done — these were stale in my notes and
should not be re-raised:

- **Trial-abuse defence (P1 "Risk Before Keys").** Live in `main`: `RiskEngine`,
  `DEFAULT_RULESETS`, `trialDays` are wired in `src/fonderie.ts`. `fonderie#278`
  is merged, not draft.
- **`@fonderie/geo` and `@fonderie/risk`** are published (0.2.13, 0.2.14), not
  parked on branches.
- **`@fonderie/config`'s readiness under-report** — fixed in 6.0.0 (PR #453).
  Secrets routes now refuse with `503 SECRETS_DISABLED` when no encryptor is
  configured, rather than serving plaintext.
- **The `/_admin/config` collision** — fixed in `@fonderie/admin` 1.0.0 (PR
  #450). The declared-vs-held report moved to `/_admin/environment`, which is
  what it always was, freeing the name for the brick that stores config.

---

## Shipped 2026-09-24/25

**fonderie** — PRs #446–#457.

| package | version | what |
|---|---|---|
| `@fonderie/core` | 0.21.0 | module shutdown contract |
| `@fonderie/config` | 6.1.0 | secrets fail closed without an encryptor (**major** in 6.0.0) |
| `@fonderie/events` | 5.9.0 | `stop()` cannot hang; pool released |
| `@fonderie/admin` | 1.0.1 | themed console, theme switcher, `/_admin/environment` (**major** in 1.0.0) |
| `@fonderie/client` + 4 frontend mirrors | 1.0.0 | `environment()`, `useAdminEnvironment`, `EnvironmentScreen` |

**leadeasygen-api** — `94826d4` → `543a500`: billing 10.0.0 (Stripe dahlia),
admin 1.0.0, events 5.8.1, then config's schema and its wiring as **two separate
commits**.

That split was not ceremony. Vercel deploys from its own git integration, so a
push **races** the `Apply migrations (production)` job — and the config manager
reads its table during boot. Expand first, then use: the schema commit is safe
whichever side wins the race, because nothing reads the tables yet.
