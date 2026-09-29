---
'@fonderie/adapter-koa': patch
---

A client disconnecting from a Server-Sent Events stream no longer reports `ERR_STREAM_PREMATURE_CLOSE` through Koa's `app.on('error')`. The error appeared on every closed tab or app, because Koa's own pipe treats a client leaving as an error, although for a stream it's the normal way to end. Event streams are now written with core's streaming writer on the raw response, the same one core `listen()` and Express use, which treats a disconnect as an ordinary end. Cleanup still runs, and every other response is unchanged.
