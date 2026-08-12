<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-courier-admin-screens — signatures

## @fonderie/react-courier-admin-screens

```ts
interface ITemplateEditorScreenProps {
    client: CourierAdminClient;
    type: string;
    locale?: string | null;
    onSaved?: () => void;
}

interface ITemplateListScreenProps {
    client: CourierAdminClient;
    onSelectTemplate?: (template: ITemplateEntry) => void;
}

function TemplateEditorScreen({ client, type, locale, onSaved, }: ITemplateEditorScreenProps): Element

function TemplateListScreen({ client, onSelectTemplate }: ITemplateListScreenProps): Element
```
