---
'@fonderie/client': minor
---

New option `new FonderieClient({ sse: { baseUrl } })` serves the Server-Sent Events stream from a different host than the API. A serverless API can't hold streams open, so they're often served by a separate long-running host, for example `stream.example.com` next to `api.example.com`. Only `/sse/stream` goes to that host; every other request still uses `baseUrl`.
