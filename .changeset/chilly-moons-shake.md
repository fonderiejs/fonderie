---
'@fonderie/rate-limit': patch
---

A failing rate-limit store is now logged instead of swallowed

The catch that implements fail-open discarded its error **unbound**
(`} catch {`), and nothing in the package logged anywhere. So a limiter whose
store was unreachable let every request through, indistinguishably from one
working perfectly: no error, no 500, no log line.

That is not hypothetical. A consumer shipped with the store's table missing
from its migration list. `consume()` threw on every call, the checkout brake
on its trial-abuse path passed everything unthrottled, and it stayed that way
for weeks — found only because an unrelated CI step happened to print a
migration count.

Fail-open remains the default and remains right: an outage should not lock
every user out, especially where other defences sit behind the limiter. What
was wrong is that it was *silent*. It now reports the key, the underlying
error, and explicitly that the request was **not** limited.

The fail-CLOSED path logs too. Returning 429 tells the caller they were
throttled, which is the opposite of what happened, so the operator still needs
the real reason.

No API change. If you parse logs, expect a new `[rate-limit] store
unavailable for "<key>"` line on store failure — its appearance means a
limiter you are relying on is not limiting.
