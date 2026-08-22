---
"@fonderie/react-auth": minor
"@fonderie/react-native-auth": minor
"@fonderie/vue-auth": minor
---

Re-export `isMfaRequired` and `IMfaRequiredResult` from the package index, matching the existing `FonderieApiError`/auth-type re-exports — MFA-aware login now needs only one import: `import { isMfaRequired, useLogin } from '@fonderie/react-native-auth'`. No knowledge of the `@fonderie/client` dependency required (importing from `@fonderie/client` continues to work).
