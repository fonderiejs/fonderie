---
'@fonderie/client': minor
'@fonderie/react-billing': minor
'@fonderie/vue-billing': minor
'@fonderie/react-native-billing': patch
---

Add the in-app pack-purchase surface for `@fonderie/billing`'s `POST /billing/wallet/purchase`.

- `@fonderie/client`: `billing.purchaseWalletPack({ packId, idempotencyKey })` → `IWalletPurchaseResult` (`status`: `credited` / `checkout_required` / `declined` / `processing`).
- `@fonderie/react-billing` + `@fonderie/vue-billing`: `usePurchasePack` — charges the saved card, generates one idempotency key per attempt and retries an indeterminate `processing` in place with the SAME key (so a retry can't double-charge), and resolves to the outcome so the caller can fall back to hosted checkout on `checkout_required`. `@fonderie/react-native-billing` re-exports it.

Buy a credit pack without leaving the site when a card is on file; fall back to hosted checkout only when there's no saved card or the card needs 3-D Secure.
