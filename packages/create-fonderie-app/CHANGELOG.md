# create-fonderie-app

## 0.1.3

### Patch Changes

- 981fd30: Security: bump `giget` `^1.2.3` → `^3.3.1` to clear a critical-severity
  advisory chain in its transitive `tar` dependency (`<=7.5.20`) — arbitrary
  file creation/overwrite via hardlink and symlink path traversal, plus
  several DoS vectors (GHSA-34x7-hfp2-rc4v and related). `create-fonderie-app`
  uses only the stable `downloadTemplate` export, so the major bump is
  transparent to consumers; verified via a clean `npm run audit:ship` and a
  live scaffold run against the real template.
