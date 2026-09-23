---
'@fonderie/cli': patch
---

`fonderie migrate` names the database it checked, and says when that database has never been migrated

Two failures that looked identical from the output: a url pointing at your
deployment, and a url pointing somewhere that has never seen this app. Both
printed a confident list of pending migrations, and the second reported
"first-time setup, nothing to lose" — which is the branch that suppresses the
destructive flag. A wrong url produced a green gate that would have waved a
`DROP TABLE` through.

Found in CI: the gate ran against an environment secret and reported 61 pending
including `800_drop_legacy_credits.sql` on a deployment where that migration was
applied weeks ago.

Now:

- every run prints `checking <host>:<port>/<database>` — never the credentials,
  so a wrong target is obvious at a glance
- the applied count is read directly (`select count(*) from fonderie_migrations`)
  rather than inferred from pending-vs-total, because `pending()` catches the
  read failure and returns every file — it cannot distinguish a missing table
  from a fresh install
- a missing `fonderie_migrations` table says so loudly and states the
  consequence: treated as a first install, nothing flagged, **and if you expected
  an existing deployment the url is wrong and this check proves nothing**
- a live database reports `(N already applied)`, which is the number that gives
  a wrong target away immediately
