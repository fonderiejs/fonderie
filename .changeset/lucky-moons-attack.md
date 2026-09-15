---
'@fonderie/webhooks': patch
---

Move to undici 8

Two majors on the library the SSRF guard depends on, so the pinning contract was
verified directly rather than inferred from a green suite: `pinnedTransport`
builds an undici `Agent` whose `connect.lookup` forces the socket to a
pre-validated IP, closing the DNS-rebinding TOCTOU. If undici 8 stopped calling
that hook, or changed its callback shape, the socket would follow live DNS again
and the hole would reopen silently — with every existing test still passing,
because the only `pinnedTransport` test asserts an internal address is REJECTED,
which returns before undici is ever reached.

Probed 6.28.1 and 8.10.2 side by side against a local server, requesting a
hostname that does not resolve: both call `lookup`, both pass `all: true`, and
both deliver the socket to the pinned address. The contract is unchanged.
