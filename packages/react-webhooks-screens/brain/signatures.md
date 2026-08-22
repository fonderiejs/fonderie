<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-webhooks-screens — signatures

## @fonderie/react-webhooks-screens

```ts
interface IWebhookDetailScreenProps {
    client?: WebhooksClient;
    endpointId: string;
    onNavigateToList?: () => void;
}

interface IWebhooksListScreenProps {
    client?: WebhooksClient;
    onSelectEndpoint?: (endpointId: string) => void;
}

function WebhookDetailScreen({ client, endpointId, onNavigateToList, }: IWebhookDetailScreenProps): Element

function WebhooksListScreen({ client, onSelectEndpoint }: IWebhooksListScreenProps): Element
```
