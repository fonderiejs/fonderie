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
