<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-config-admin-screens — signatures

## @fonderie/react-config-admin-screens

```ts
interface IConfigEditorScreenProps {
    client: ConfigAdminClient;
    kind: 'config' | 'secret';
    configKey: string;
    environment?: string;
    onSaved?: () => void;
}

interface IConfigListScreenProps {
    client: ConfigAdminClient;
    environment?: string;
    onSelectConfig?: (key: string) => void;
    onSelectSecret?: (key: string) => void;
}

function ConfigEditorScreen({ client, kind, configKey, environment, onSaved, }: IConfigEditorScreenProps): Element

function ConfigListScreen({ client, environment, onSelectConfig, onSelectSecret, }: IConfigListScreenProps): Element
```
