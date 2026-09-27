<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-courier-admin-screens — signatures

## @fonderie/react-courier-admin-screens

```ts
interface ITemplateCreateScreenProps {
    client: CourierAdminClient;
    type?: string;
    locales?: string[];
    defaultLocale?: string;
    onCreated?: (created: {
        type: string;
        locale: string | null;
    }) => void;
    locale?: AdminLocale | undefined;
}

interface ITemplateEditorScreenProps {
    client: CourierAdminClient;
    type: string;
    locale?: string | null;
    onSaved?: () => void;
    system?: boolean;
    onDeleted?: () => void;
    onAddLocale?: (type: string, context: {
        locales: string[];
        defaultLocale?: string;
    }) => void;
    onSelectLocale?: (template: ITemplateSelection) => void;
    uiLocale?: AdminLocale | undefined;
}

interface ITemplateListScreenProps {
    client: CourierAdminClient;
    onSelectTemplate?: (template: ITemplateSelection) => void;
    onCreateTemplate?: (context: {
        locales: string[];
    }) => void;
    locale?: AdminLocale | undefined;
}

interface ITemplateSelection {
    type: string;
    locale: string | null;
    system: boolean;
}

function TemplateCreateScreen({ client, type, locales, defaultLocale, onCreated, locale, }: ITemplateCreateScreenProps): Element

function TemplateEditorScreen({ client, type, locale, onSaved, system, onDeleted, onAddLocale, onSelectLocale, uiLocale, }: ITemplateEditorScreenProps): Element

function TemplateListScreen({ client, onSelectTemplate, onCreateTemplate, locale, }: ITemplateListScreenProps): Element
```
