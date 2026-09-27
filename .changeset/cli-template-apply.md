---
'@fonderie/cli': minor
---

`fonderie template export · diff · apply`: email templates join config and secrets as reviewed files. One `TemplateSet` per locale; HTML and multi-line text live in their own files next to the manifest (`htmlFrom` / `textFrom`), so a copy change reviews as a copy change and `diff` reports it as `html changed (12 → 14 lines)`. Each entry is the whole template, matching the server's full-replace save; `--prune` deletes only within the file's locale.

The scope now travels in the file for every kind: `metadata.environment` / `metadata.locale` is honoured, and a `--env` / `--locale` flag that disagrees with it is refused. Before, apply ignored metadata, so applying a prod export without `--env` wrote prod values into the shared `all` rows. Unknown manifest fields (a misspelled `descripton`) are now reported instead of silently ignored.
