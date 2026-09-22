---
'@fonderie/admin': minor
'@fonderie/client': patch
---

`host` — answer only for requests addressed to a hostname you name

`AdminModule({ host: 'admin.example.com' })`, or a list. Every other host
gets the same `404` an unmounted surface gives — deliberately not a `403`,
which would confirm the surface exists and that you found the wrong door.
Case-insensitive, port-optional unless you configure one, and it covers the
served dashboard's two unguarded asset routes as well: serving a page that
says "admin" on your public API hostname is precisely what this prevents.

The concrete reason it exists: platforms hand every deployment a permanent
URL of their own (`project-abc123.vercel.app`) that answers whatever your
custom domain answers, walking around anything you put in front of the
domain. Binding closes that hole while the rest of the app keeps serving on
both hostnames.

**It is not an access control**, and the option's doc comment says so.
`Host` is client-set, so this only means something when the edge decides the
hostname and your origin is not reachable around it — the same footgun
`trustProxy` carries in `@fonderie/core`. A refused request is still logged,
so the caller learns nothing and the operator learns something, and the
manifest reports the binding as `admin.host` (client type updated to match).
