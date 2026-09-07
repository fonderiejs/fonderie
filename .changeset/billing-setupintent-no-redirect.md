---
'@fonderie/billing': patch
---

`createSetupIntent` now sets `automatic_payment_methods.allow_redirects: 'never'` so in-app card entry stays on-page: the embedded Payment Element only offers methods that need no off-site redirect (cards/wallets), which is also exactly what an off-session-chargeable saved card must be. Without it a redirect-based method could bounce the user off the site on confirm — contrary to the in-app design.
