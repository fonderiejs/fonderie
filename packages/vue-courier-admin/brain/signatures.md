<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-courier-admin — signatures

## @fonderie/vue-courier-admin

```ts
interface ICourierAdminClientOptions {
    baseUrl: string;
    adminToken: string;
}

interface IRollbackTemplateInput {
    toVersion: number;
}

interface ISetTemplateInput {
    text: string;
    subject?: string;
    html?: string;
    active?: boolean;
    ifVersion?: number;
}

interface ITemplateEntry {
    type: string;
    locale: string | null;
    subject: string | null;
    html: string | null;
    text: string;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface ITemplateRevision {
    type: string;
    locale: string | null;
    subject: string | null;
    html: string | null;
    text: string;
    version: number;
    actor: string | null;
    createdAt: string;
}

new CourierAdminClient(opts: ICourierAdminClientOptions): CourierAdminClient
  .listTemplates(): Promise<IApiResponse<ITemplateEntry[]>>
  .getTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .setTemplate(type: string, input: ISetTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .deleteTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<undefined>>
  .listRevisions(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateRevision[]>>
  .rollback(type: string, input: IRollbackTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useDeleteTemplate(client: CourierAdminClient): { deleteTemplate: (type: string, locale?: string | null | undefined) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<...>; }

function useSaveTemplate(client: CourierAdminClient): { saveTemplate: (type: string, input: ISetTemplateInput, locale?: string | null | undefined) => Promise<ITemplateEntry>; isLoading: Ref<...>; error: Ref<...>; }

function useTemplate(client: CourierAdminClient, type: string, locale?: string | null | undefined): { template: Ref<{ type: string; locale: string | null; subject: string | null; ... 5 more ...; updatedAt: string; } | null, ITemplateEntry | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useTemplateRevisions(client: CourierAdminClient, type: string, locale?: string | null | undefined): { revisions: Ref<{ type: string; locale: string | null; subject: string | null; ... 4 more ...; createdAt: string; }[], ITemplateRevision[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; rollback: (toVersion: number) => Promise<...>; }

function useTemplates(client: CourierAdminClient): { templates: Ref<{ type: string; locale: string | null; subject: string | null; html: string | null; text: string; active: boolean; version: number; updatedBy: string | null; updatedAt: string; }[], ITemplateEntry[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }
```
