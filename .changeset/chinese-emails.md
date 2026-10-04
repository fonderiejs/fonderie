---
'@fonderie/core': minor
'@fonderie/courier': minor
'@fonderie/auth': minor
'@fonderie/workspaces': minor
'@fonderie/billing': minor
---

Every built-in email in Chinese, Simplified and Traditional, and amounts written the way the reader writes them.

- **Chinese in both scripts.** All 24 built-in emails (auth 13, billing 10, workspaces 1) ship in `zh-Hans` (Simplified) and `zh-Hant` (Traditional), alongside English, French and Spanish. The Traditional copy is written for Traditional readers (帳戶, 電子郵件, 儲值), not converted character by character.
- **The script follows the reader.** `zh-TW`, `zh-HK` and `zh-MO` get Traditional; `zh`, `zh-CN` and `zh-SG` get Simplified, derived from CLDR via `Intl.Locale#maximize` with no hand-kept region list. New in core: `localeScriptTag()` and `localeCopyKeys()`. `localeChain()` now puts the script right after the tag (`zh-HK` → `zh-Hant`), so an app's saved `zh-Hant` template also reaches Hong Kong and Taiwan readers, and never Simplified ones. This applies only to languages written in more than one script.
- **Amounts in the reader's language.** Billing formatted every amount as en-US before anyone knew who would read it, so a Québec customer's French receipt said `CA$19.99`. Notices now also carry the raw amount under core's reserved `$format` data key, and courier formats it in the resolved language: `19,99 $` for fr-CA, `$19.99` for en-CA. The plain string is still sent too, so an older courier shows it unchanged. `$format` accepts `{ money: { amount, currency, precision } }` and `{ date, style? }`.
- `SHIPPED_TEMPLATE_LANGUAGES` is now `['es', 'fr', 'zh-Hans', 'zh-Hant']`, so the parity checks and `check:template-coverage` require Chinese in every notifying module. The gate's pattern was lower-case only and would have skipped `zh-Hans` while still passing.
