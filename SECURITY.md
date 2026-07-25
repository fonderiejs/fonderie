# Security policy

Fonderie ships the parts of a SaaS backend that are easiest to get
dangerously wrong — authentication, sessions, billing, permissions,
transactional email. The whole premise is that these are audited once and
reused, instead of re-derived (and re-broken) in every app. That premise
only holds if real issues reach us and get fixed in the open. This document
is how.

## Supported versions

Security fixes land on the latest published major of each package (the
`latest` dist-tag on npm). During the pre-1.0 phase the SDK publishes under
the `@fonderie` scope; treat the newest published version as the supported
one. There is no backport guarantee for older majors yet.

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Use GitHub's private reporting instead:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (GitHub Private Vulnerability Reporting).
2. Describe the issue, the affected package(s) and version(s), and a
   reproduction if you have one.

If private reporting is unavailable to you, open a minimal public issue that
says only "security report, please open a private channel" — with **no
details** — and we'll follow up.

### What to include

- Which `@fonderie/*` package and version.
- The impact (what an attacker can do).
- Steps or a proof-of-concept to reproduce.
- Any suggested fix, if you have one.

### What to expect

- **Acknowledgement** within a few days.
- An initial assessment (is it valid, how severe) after triage.
- A fix released as a patch/minor on the affected package, with the advisory
  published once users have a version to upgrade to.
- Credit to you in the advisory unless you prefer to remain anonymous.

## Scope

**In scope** — anything in a shipped `@fonderie/*` package that lets an
attacker do something they shouldn't: authentication or session bypass,
privilege escalation across workspaces/roles, injection (SQL, header/CRLF,
template), secret exposure, or a vulnerable dependency Fonderie actually
ships.

**Out of scope** — vulnerabilities in *peer* dependencies the consuming app
provides and controls (e.g. your chosen version of Express), issues that
require a misconfiguration the docs warn against, and anything in the
example/experiment skeletons under `experiments/`.

## How we keep our own house honest

- CI fails on high+ advisories in Fonderie's **shipped** dependency surface
  (`npm run audit:ship` — excludes dev tooling and peer deps).
- Every body-taking route must validate input or carry a reviewed exemption
  (`npm run audit:validation`).
- Auth fails closed in production (a weak/placeholder JWT secret is fatal),
  and `app.checkProductionReadiness()` surfaces config footguns before boot.

If you find a place where these guarantees don't hold, that itself is worth
reporting.
