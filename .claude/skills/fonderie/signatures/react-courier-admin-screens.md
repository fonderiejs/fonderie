<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-courier-admin-screens — signatures

## @fonderie/react-courier-admin-screens

```ts
interface ITemplateCreateScreenProps {
    client: CourierAdminClient;
    type?: string;
    locales?: string[];
    onCreated?: (created: {
        type: string;
        locale: string | null;
    }) => void;
}

interface ITemplateEditorScreenProps {
    client: CourierAdminClient;
    type: string;
    locale?: string | null;
    onSaved?: () => void;
    system?: boolean;
    onDeleted?: () => void;
    onAddLocale?: (type: string) => void;
}

interface ITemplateListScreenProps {
    client: CourierAdminClient;
    onSelectTemplate?: (template: ITemplateEntry) => void;
    onCreateTemplate?: (context: {
        locales: string[];
    }) => void;
}

function TemplateCreateScreen({ client, type, locales, onCreated, }: ITemplateCreateScreenProps): Element

function TemplateEditorScreen({ client, type, locale, onSaved, system, onDeleted, onAddLocale, }: ITemplateEditorScreenProps): Element

function TemplateListScreen({ client, onSelectTemplate, onCreateTemplate, }: ITemplateListScreenProps): Element
```
