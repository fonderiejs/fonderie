---
'@fonderie/client': minor
'@fonderie/admin': patch
---

The admin console in Chinese, Simplified (简体中文) and Traditional (繁體中文).

- All 609 console strings in `zh-Hans` and `zh-Hant`, alongside English, French and Spanish. The language menu lists both. The Traditional copy uses Taiwan/Hong Kong software terms (使用者, 設定, 範本, 權杖, 工作階段), not a character conversion of the Simplified copy.
- `detectAdminLocale` picks the script from the browser's language: `zh-TW`, `zh-HK` and `zh-MO` get Traditional; `zh`, `zh-CN` and `zh-SG` get Simplified.
- `ADMIN_LOCALES` is now `['en', 'fr', 'es', 'zh-Hans', 'zh-Hant']`. The parity test checks both scripts for empty strings and dropped `{placeholders}`, and checks that Traditional is not a copy of Simplified.
- `@fonderie/admin` bumps so the console it ships includes the new language.
