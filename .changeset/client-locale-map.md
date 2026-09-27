---
'@fonderie/client': minor
---

`LocaleMap<T>` — a read-only map with one value per console language. `adminLocaleNames` and `adminLocaleTags` are typed with it and frozen at runtime: they are shared by every console on a page, so an embedding app can no longer rename a language for everyone by assignment. Their published signatures now read `LocaleMap<string>` instead of the expanded object type.
