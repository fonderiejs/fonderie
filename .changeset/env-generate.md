---
'@fonderie/cli': minor
---

New `fonderie env generate` writes `.env.example` from the `env.json` of every installed brick, plus the app's `fonderie.env.json`, and creates or completes `.env`:
- existing values are kept;
- secrets that have a recipe are generated with `crypto.randomBytes`;
- local defaults are filled in;
- a deprecated name's value is carried over to the new name;
- what only a human can supply is listed at the end.

It refuses to write `.env` inside a git repository that does not ignore it. `--check` exits 1 when `.env.example` is out of date (for CI), and `--example-only` skips `.env`.

`fonderie add` now writes `.env.example` the same way. It used to write from a hardcoded table that could only ever produce `DATABASE_URL` and a placeholder `JWT_SECRET` that auth rejects in production.
