<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react — signatures

## @fonderie/react

```ts
new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient
  .billing: BillingClient
  .workspaces: WorkspacesClient
  .audit: AuditClient
  .webhooks: WebhooksClient
  .customers: CustomersClient
  .setAccessToken(token: string | undefined): void
  .clearCache(): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .request<T = unknown>(opts: { method: string; path: string; body?: unknown; token?: string | undefined; workspaceId?: string | undefined; cache?: number | false | undefined; bust?: boolean | undefined; invalidate?: string[] | undefined; }): Promise<...>
  .get<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .delete<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>

interface IFonderieProviderProps {
    client: FonderieClient;
    children?: ReactNode;
}

function FonderieProvider({ client, children }: IFonderieProviderProps): FunctionComponentElement<ProviderProps<FonderieClient | null>>

function useFonderieClient(): FonderieClient

function useFonderieSubClient<T>(explicit: T | undefined, select: (client: FonderieClient) => T, hookName: string): T
```
