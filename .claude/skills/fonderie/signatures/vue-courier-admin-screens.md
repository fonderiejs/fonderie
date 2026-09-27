<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-courier-admin-screens — signatures

## @fonderie/vue-courier-admin-screens

```ts
interface ITemplateSelection {
    type: string;
    locale: string | null;
    system: boolean;
}

component TemplateCreateScreen(props: { client, type, locales, defaultLocale, locale }) — emits: created

component TemplateEditorScreen(props: { client, type, locale, system, allowAddLocale, localeTabs, uiLocale }) — emits: saved, deleted, add-locale, select-locale

component TemplateListScreen(props: { client, allowCreate, locale }) — emits: select-template, create-template
```
