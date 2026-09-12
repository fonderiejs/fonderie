---
'@fonderie/core': minor
'@fonderie/auth': patch
'@fonderie/billing': patch
'@fonderie/customers': patch
'@fonderie/workspaces': patch
---

Notifications, webhooks and domain events are no longer silently dropped on serverless.

Work dispatched off the request path was detached (`bus?.emit(...).catch(() => {})`). On a long-running host that promise finishes in the background; on serverless it does not — the instance is frozen the moment the response is written, so the work is abandoned mid-flight. A registration returned "Account created. Check your email" while the verification email was never sent, and nothing appeared in the logs, because the code that would have reported the failure never ran either. The same applied to payment receipts, dunning notices, low-balance warnings, workspace invitations and customer events.

Core gains `background(work)`, and 43 dispatch sites across auth, billing, customers and workspaces now go through it. Its behaviour is chosen by `FONDERIE_BACKGROUND_TASKS`:

- `auto` (default) — wait on serverless, detach anywhere else
- `await` — always finish the work before responding
- `detach` — never wait; only safe where the process outlives the response

Detection is a positive list of serverless markers (`VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`, `FUNCTION_TARGET`, `K_SERVICE`, `FUNCTIONS_WORKER_RUNTIME`), never an attempt to recognise a long-running host — there is no reliable signal for "this process outlives the response", so EC2, Docker and bare metal are the fallback and keep today's behaviour exactly. An unrecognised serverless platform is no worse off than before, and can opt in explicitly.

Awaiting is bounded by `FONDERIE_BACKGROUND_TIMEOUT_MS` (default 5000) so a hung provider degrades to lost work rather than a hung request, and rejections are still swallowed — background work must never fail the request that triggered it. `setBackgroundRunner()` lets an adapter or app supply a platform primitive such as Vercel's `waitUntil`, which is strictly better than either mode: the work completes without delaying the response.

Deliberately unchanged: `.catch(() => {})` used for cleanup and compensation inside an already-awaited flow (invoice teardown, orphaned-blob removal) is error swallowing, not detached work, and wrapping it would change its meaning. `LoginEventModel.recordSafe` is also still detached — making it awaitable changes a synchronous signature and its call sites, so it is left for a follow-up.
