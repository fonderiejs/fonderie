<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/audit — signatures

## @fonderie/audit

```ts
new AuditModule(store: IStoreAdapter): AuditModule
  .name: "@fonderie/audit"
  .deps: string[]
  .install(app: IFonderieApp): void

interface IAuditEvent {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    meta: Record<string, unknown>;
    createdAt: Date;
}

interface IAuditQuery {
    workspaceId: string;
    type?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}

interface IAuditEventDTO {
    id: string;
    type: string;
    actorId: string | null;
    requestId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
}

interface IAuditPageDTO {
    events: IAuditEventDTO[];
    nextCursor: string | null;
}
```
