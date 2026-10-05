---
'@fonderie/auth': minor
'@fonderie/core': minor
'@fonderie/client': minor
'@fonderie/react-auth': minor
'@fonderie/react-native-auth': minor
'@fonderie/vue-auth': minor
'@fonderie/react-workspaces': minor
'@fonderie/vue-workspaces': minor
'@fonderie/workspaces': major
'@fonderie/billing': major
'@fonderie/webhooks': major
---

Big moves now ask the person to prove it's still them, and handing a team over waits for the new owner (docs/INSIDER-THREAT-DESIGN.md, Phase 4).

A stolen session, or a colleague's unlocked phone, could give a team away, end its plan at once, or add a webhook that streams every event of the business to someone else's server. Each took one request.

**Step-up** (`@fonderie/auth`):
- `GET /auth/step-up` lists the proofs this account can give.
- `POST /auth/step-up/code` sends a code to the account's email or phone.
- `POST /auth/step-up` checks the proof and returns a 5-minute token. The client sends it back as `X-Step-Up`.
- With two-factor on, only the authenticator is accepted; a password alone is what a thief may have. Otherwise the password, or a code that was sent.
- `AuthModule` puts a verifier on every request, so other modules ask it without importing auth.
- The client (`auth.stepUp`, `isStepUpRequired`) holds the proof and sends it automatically. `useStepUp` is in React, React Native and Vue.
- `X-Step-Up` joins core's default CORS headers.
- Apply auth migration `025_step_up_codes`.

**Breaking:** without a fresh proof, these now answer `403 STEP_UP_REQUIRED`. Prove it, then retry.
- `@fonderie/workspaces`: `POST /workspaces/transfer-ownership`.
- `@fonderie/billing`: `POST /billing/subscription/cancel` with `atPeriodEnd: false`. Cancelling at period end, the default, is unchanged.
- `@fonderie/webhooks`: `POST /webhooks`, and `PATCH /webhooks/:id` when it changes the URL.
- Each module takes `stepUp: false` to turn this off. They need `@fonderie/auth` 7.27 or later registered; without its verifier they refuse rather than wave the move through.

**Breaking — ownership is offered, not moved** (`@fonderie/workspaces`):
- `POST /workspaces/transfer-ownership` now answers `202 OWNERSHIP_OFFERED`. Nothing moves until the member accepts.
- New routes:
  - `GET /workspaces/transfer-ownership` returns the open offer.
  - `POST /workspaces/transfer-ownership/accept` and `/decline` are for the member it is offered to.
  - `DELETE /workspaces/transfer-ownership` withdraws it (owner only).
- An offer lapses after 7 days, and a new one replaces it. Accepting claims the offer and moves ownership in one transaction.
- New trail events: `ownership.offered`, `.declined` and `.withdrawn`. On `ownership.transferred` the actor is now the new owner, and `targetUserId` the previous one.
- Message keys: `workspace-ownership-offered` goes to the member, and `workspace-ownership-accepted` to the previous owner. They replace `workspace-ownership-received`.
- Client: `getOwnershipOffer`, `acceptOwnership`, `declineOwnership` and `withdrawOwnershipOffer`, and the `useOwnershipOffer` hook.
- Apply workspaces migration `007_ownership_offers`.
