---
'@fonderie/media': minor
---

Account deletion can now erase a person's media. `mediaModule.accountEraser()`
(or `accountEraser(store, { provider })`) returns `{ name: 'media', erase(subject) }`
for the purge: assets the person owns — their avatar — lose their row and their
stored bytes, so `GET /media/:id` stops serving them; assets they uploaded for
a workspace or a customer stay with that owner, with the uploader removed. The
row goes first, then the bytes; if the storage provider fails, the assets are
put back and `erase` throws, so a retry still finds the bytes instead of leaving
them stored with nothing pointing at them. A second run erases nothing.
