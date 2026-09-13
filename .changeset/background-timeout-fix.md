---
'@fonderie/core': patch
---

`background()`'s await timeout is now reliable. The timer was `unref`'d so it wouldn't hold a long-running process open — but when the work never settles, that timer is the only thing keeping the event loop alive, so the process could drain before it fired and the bound silently would not exist. The `clearTimeout` after the race is what keeps a long-running host free, so the `unref` was both unnecessary and harmful.
