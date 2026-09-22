---
'@fonderie/admin': patch
---

`host` accepts a scheme or a trailing path instead of silently matching nothing

`host` is compared against the request's `Host`, which is a bare hostname with
an optional port — never a scheme. But the option sits beside config that *is*
full URLs, so `https://admin.example.com` is the natural slip, and it used to
go into the allow-set verbatim. It then matched no request at all: every route
under the prefix answered 404, which is by design indistinguishable from the
surface never having been mounted. A typo in optional hardening locked the
operator out of their own dashboard with nothing to read.

`https://admin.example.com`, `http://admin.example.com/`, `admin.example.com/`
and `admin.example.com` now all name the same host. The boundary is unchanged —
another hostname is still 404, and an entry given with a port is still exact.
