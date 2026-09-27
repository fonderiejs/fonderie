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
    onDeleted?: () => void;
    environments?: string[];
}

interface IConfigListScreenProps {
    client: ConfigAdminClient;
    environment?: string;
    onSelectConfig?: (key: string, environment: string) => void;
    onSelectSecret?: (key: string, environment: string) => void;
    publicConfigUrl?: string;
    onCreateConfig?: (context: {
        environments: string[];
        environment: string | null;
    }) => void;
    onCreateSecret?: (context: {
        environments: string[];
        environment: string | null;
    }) => void;
}

function ConfigEditorScreen({ client, kind, configKey, environment, onSaved, onDeleted, environments, }: IConfigEditorScreenProps): Element

function ConfigListScreen({ client, environment, onSelectConfig, onSelectSecret, onCreateConfig, onCreateSecret, publicConfigUrl, }: IConfigListScreenProps): Element
```
