---
"@fonderie/webhooks": patch
---

Fix a CRITICAL SSRF blocklist bypass: an internal IPv4 embedded in IPv6 was only blocked in the dotted mapped form (`::ffff:1.2.3.4`). The hex-colon mapped form (`::ffff:a9fe:a9fe` = 169.254.169.254 cloud metadata), fully-expanded mapped, NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`), and deprecated IPv4-compatible (`::/96`) embeddings all passed the check — a workspace member could register a webhook at one of these, have the server proxy to cloud metadata / loopback / RFC1918, and read the response back from the delivery log. `isBlockedAddress` now canonicalizes the address (full 8-group expansion, dotted-tail handling) and extracts the embedded IPv4 from every wrapping notation before applying the IPv4 blocklist; public IPv4-in-IPv6 (e.g. `::ffff:8.8.8.8`) stays allowed. Registration and the DNS-pinned delivery path share this logic, so both are covered.
