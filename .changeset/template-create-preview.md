---
'@fonderie/client': patch
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
'@fonderie/admin': minor
---

Adding a locale or a new template now has the same live preview as the editor, and flags fields still identical to the default copy ("Still the default copy: Subject, Plain-text body") — a half-translated email looked finished in a textarea and only showed its English subject once sent. The console page now loads its script as `app.js?v=<version>`, so a page opened after a deploy never reuses the previous bundle from cache.
