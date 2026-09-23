---
'@fonderie/billing': patch
---

The webhook version-drift advice stops claiming data is being lost

It read: "fields move between versions, so a payload can parse to null and be
silently ignored". That was true before 9.6.0 and is no longer true — since
then `normalizeInvoice` falls back to the legacy locations and
`enrichInvoiceRefs` recovers the PaymentIntent a 2025+ webhook payload cannot
carry. The check compares two version strings and has no idea the handlers were
hardened, so it inferred a consequence that no longer follows.

An attention page that overstates gets ignored wholesale, which costs more than
the drift it is reporting.

It now also names the remedy, because the obvious one does not exist: a
provider fixes an endpoint's API version when the endpoint is CREATED and
refuses to change it afterwards. Someone following the old advice went to the
dashboard and found "This field cannot be changed". The options are recreating
the endpoint pinned to the client's version — which issues a new signing secret
— or moving the client pin forward and re-verifying the payload shapes.

Tests assert the absence of the old claim as well as the presence of the new
wording, so the overstatement cannot come back.
