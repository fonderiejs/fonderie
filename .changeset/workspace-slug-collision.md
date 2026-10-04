---
'@fonderie/workspaces': patch
---

Two businesses with the same name can both create a workspace. The slug was the
lower-cased name with no de-duplication, so the second "Acme Plumbing" — and the
second business whose name has no Latin letters (水管公司 slugs to an empty
string) — hit the unique slug index and got a 500. A taken slug now gets a short
random suffix (`acme-plumbing-3f9a1c`), and an empty one falls back to
`workspace`.
