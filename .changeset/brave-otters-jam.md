---
'@fonderie/billing': patch
---

Warn when an event reaches the wrong webhook endpoint

The unconsumed-event warning asked whether this package handles a type
*anywhere*, which misses the more common misconfiguration by construction: an
event ticked on BOTH endpoints when only one handles it is consumed — just not
there — so the check stayed silent while every such event was delivered twice,
processed once and ignored once.

Observed in production: a payment endpoint registered for all fourteen event
types instead of its eight, so every subscription event went to both endpoints.
Nothing broke, and nothing said so.

The question is now per-endpoint. Each route passes the event set it owns, and
the two causes get different messages, because the fixes differ: remove it from
*this* endpoint, versus remove it from the account or add a handler. Warn-once
is keyed by route and type, so the same type at two endpoints reports twice
rather than collapsing into one.

Calling without an expected set keeps the old package-wide behaviour.
