---
'@fonderie/events': patch
---

Forward `consume` and `claimTimeoutMs` from the declarative `{ type: 'pg' }` transport config.

Producer-only mode shipped on `PGTransport`'s constructor, but `resolveTransport` never copied the option across — so `new EventsModule({ transport: { type: 'pg', connectionUrl, consume: false } })` type-checked at the call site and silently did nothing, still opening a LISTEN client and a poll loop. That is the form the examples, the templates and the docs all use, which made the option effectively missing for most apps and left the serverless case it was written for unreachable without dropping down to the class form.

Two tests cover it: one asserts the declarative form actually suppresses the consumer, and one reads this file and asserts every optional key on the `{ type: 'pg' }` union is forwarded inside `resolveTransport` — options declared in one place and forwarded in another drift apart by default, and the type system cannot see the gap.
