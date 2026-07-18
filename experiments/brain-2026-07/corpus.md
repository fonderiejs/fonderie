# Naive-phrasing corpus (retrieval eval set)

Status: **generated draft — must be reviewed/replaced with real user
phrasings** (Discord, support, sales calls) before any gate number counts.
Format: `entry | canonical task # | source`. Source is `gen` (adversarially
generated) until a human swaps in `real`. Target: 30–50 entries, every
canonical task covered by ≥3 phrasings, at least half `real`.

Scoring (used by Phase 1/2 gates and later `fonderie brain eval`): a hit =
the top-ranked slice contains the required nodes from
`canonical-questions.md` for that task. Hit rate target ≥90%.

| Entry | Task | Source |
| --- | --- | --- |
| let people make accounts | 1 | gen |
| add login | 1 | gen |
| users should stay signed in | 1 | gen |
| sign in with google | 2 | gen |
| add github login button | 2 | gen |
| social auth | 2 | gen |
| only logged in people can see the dashboard | 3 | gen |
| protect this endpoint | 3 | gen |
| make this page private | 3 | gen |
| teams like slack | 4 | gen |
| let users invite coworkers | 4 | gen |
| add organizations | 4 | gen |
| multiple people share one account | 4 | gen |
| let people pay | 5 | gen |
| add stripe | 5 | gen |
| I want a pro plan for $9 | 5 | gen |
| monetize the app | 5 | gen |
| charge per seat | 6 | gen |
| bill the whole team | 6 | gen |
| price goes up when they add members | 6 | gen |
| pro users get exports | 7 | gen |
| lock this feature behind the paid plan | 7 | gen |
| free tier limited to 3 projects | 7 | gen |
| make some users admins | 8 | gen |
| only owners can delete stuff | 8 | gen |
| viewer vs editor roles | 8 | gen |
| send a welcome email | 9 | gen |
| forgot password email | 9 | gen |
| email people when they get invited | 9 | gen |
| handle stripe events | 10 | gen |
| tell other apps when something happens here | 10 | gen |
| stop bots hammering the login | 10 | gen |

## Repo-sourced phrasings (real — extracted 2026-07-18)

Actual prompts used in this repo's experiments (token-cost `prompt*.txt`,
multi-module `prompts/stage{1..4}.txt`). Provenance = `repo-experiment`:
real task language written for the runs, not synthesized here — a step up
from `gen`, though still not end-user support phrasing. They cover canonical
tasks 1, 4, 8 + rate-limit + audit; billing/courier/webhooks tasks still lack
real coverage and need genuine user phrasings. All five resolve correctly
against brain.json (compound prompts fan out to the right multiple packages).

| Entry | Task | Source |
| --- | --- | --- |
| Add user accounts to my app — people should be able to sign up and log in | 1 | repo-experiment |
| Add email/password authentication: signup, login, logout, server-side sessions, password reset by email, input validation, and rate limiting on the login endpoint | 1,3,9,10 (compound) | repo-experiment |
| Add workspaces (organizations): create a workspace; invite members by email with expiring, single-use invitations; accept or reject; list members | 4,9 (compound) | repo-experiment |
| Add roles and permissions: each workspace has ADMIN and GUEST roles; permission checks enforced on every workspace route; assign/remove roles | 8 | repo-experiment |
| password reset and invitation acceptance are not rate limited; authentication and role changes are not audited — add an audit log of every login, logout, reset, and role grant | 10,audit (compound) | repo-experiment |

## Coverage gap (for the human review)

Real coverage exists for auth, workspaces, permissions, rate-limit, audit.
**Still `gen`-only — need real phrasings before the gate counts:** billing
(tasks 5–7), courier (task 9 standalone), webhooks (task 10 outbound). Best
sources: sales-call notes, Discord, or the first real support tickets.
