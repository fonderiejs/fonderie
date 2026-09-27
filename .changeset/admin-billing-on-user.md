---
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/admin': patch
---

Billing lives on the user. Every user is billable — a wallet needs no subscription, and no subscription means the free tier — but the Subscriber page listed only people with a subscription, so free users could not be found to grant credits.

- **Users:** a Plan column (plan name, or "free"), and a "Plan & credits" section on each user: plan and status with renew/end date, credit balance, the grant form and the ledger. `UsersScreen` takes optional `billingClient` and `openUserId`.
- **Subscriptions** (was "Subscriber"): a money list — who pays, who is behind — with status filters and counts, and a "Renews / ends" column. Opening a user subscriber goes to their user page; workspace subscribers open in place. `SubscriberScreen` takes `onOpenUser`.
- **Fixes:** a canceled subscription said "Renews"; it now says "Ends" or "Ended". The credit breakdown read "granted 0 · purchased 5" after an admin grant; it now reads "5 permanent · 0 plan allowance" (admin grants and purchases never expire; the plan allowance can).
- New shared `SubscriberBilling` component in both packages.
