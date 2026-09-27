---
'@fonderie/react-admin-screens': patch
'@fonderie/vue-admin-screens': patch
'@fonderie/admin': patch
---

Opening a subscriber whose account no longer exists (deleted or purged, billing rows left behind) showed "No user with that email." — wrong on two counts: the lookup was by id, and the page dead-ended. It now says "No account with id … — it was deleted, or never existed here. Its billing records remain." and still shows that subscriber's plan, credits, grant form and ledger.
