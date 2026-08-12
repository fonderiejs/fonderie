<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-audit — signatures

## @fonderie/vue-audit

```ts
new AuditClient(http: HttpClient, tokens: TokenStore): AuditClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listEvents(input?: IListAuditEventsInput | undefined): Promise<IApiResponse<IAuditPageResult>>

interface IAuditEventDTO {
    id: string;
    type: string;
    actorId: string | null;
    requestId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
}

interface IListAuditEventsInput {
    type?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useAuditEvents(client: AuditClient, filters?: IListAuditEventsInput): { events: Ref<{ id: string; type: string; actorId: string | null; requestId: string | null; payload: Record<...>; createdAt: string; }[], IAuditEventDTO[] | { ...; }[]>; ... 5 more ...; loadMore: () => Promise<...>; }
```
