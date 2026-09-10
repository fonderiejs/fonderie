---
"@fonderie/core": patch
---

Cap declared-oversize bodies of ANY content-type in the body parser, not just json/form. The parser only reads (and streamed-caps) json and url-encoded bodies; a `multipart/form-data` upload was handed to the route uncapped — on an adapter with no transport-level cap (adapter-hono on node-server) a route buffering that upload was an unbounded-memory DoS. The parser now rejects any body whose Content-Length exceeds `maxBodyBytes` with `413`, regardless of type (the chunked/no-Content-Length streaming case remains the consuming route's responsibility).
