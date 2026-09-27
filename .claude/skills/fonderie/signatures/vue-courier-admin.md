<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-courier-admin — signatures

## @fonderie/vue-courier-admin

```ts
interface IBuiltInTemplate {
    type: string;
    locale: string;
    subject: string | null;
    html: string | null;
    text: string;
}

interface ICourierAdminClientOptions {
    baseUrl: string;
    adminToken: string;
    prefix?: string;
    actor?: string;
}

interface IPreviewTemplateInput {
    text: string;
    subject?: string;
    html?: string;
    data?: Record<string, unknown>;
}

interface IRenderedTemplateResult {
    subject?: string;
    html?: string;
    text: string;
    variables: string[];
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

interface ITemplateCatalog {
    defaultLocale: string;
    fallbacks: Record<string, string[]>;
    emails: ITemplateCatalogEntry[];
}

interface ITemplateCatalogEntry {
    type: string;
    system: boolean;
    builtIn: {
        default: boolean;
        languages: string[];
    };
    versions: Array<{
        locale: string | null;
        active: boolean;
        version: number;
        updatedAt: string;
    }>;
}

interface ITemplateEntry {
    system?: boolean;
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

interface ITemplateResolution {
    requested: string;
    chain: string[];
    defaultLocale: string;
    sent: string;
    source: 'saved' | 'built-in';
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
  .getTemplateCatalog(): Promise<IApiResponse<ITemplateCatalog>>
  .getBuiltInTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<IBuiltInTemplate>>
  .resolveTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateResolution>>
  .getTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .setTemplate(type: string, input: ISetTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .deleteTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<undefined>>
  .listRevisions(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateRevision[]>>
  .rollback(type: string, input: IRollbackTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .previewTemplate(type: string, input: IPreviewTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<IRenderedTemplateResult>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown, requestId?: string | undefined): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .requestId: string | undefined
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useBuiltInTemplate(client: CourierAdminClient, type: string, locale?: string | null | undefined): { builtIn: Ref<{ type: string; locale: string; subject: string | null; html: string | null; text: string; } | null, IBuiltInTemplate | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useTemplate(client: CourierAdminClient, type: string, locale?: string | null | undefined): { template: Ref<{ system?: boolean; type: string; locale: string | null; subject: string | null; ... 5 more ...; updatedAt: string; } | null, ITemplateEntry | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useTemplateCatalog(client: CourierAdminClient): { catalog: Ref<{ defaultLocale: string; fallbacks: Record<string, string[]>; emails: { type: string; system: boolean; builtIn: { ...; }; versions: { ...; }[]; }[]; } | null, ITemplateCatalog | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useTemplateResolution(client: CourierAdminClient): { resolution: Ref<{ requested: string; chain: string[]; defaultLocale: string; sent: string; source: "saved" | "built-in"; } | null, ITemplateResolution | ... 1 more ... | null>; isResolving: Ref<...>; error: Ref<...>; resolve: (type: string, locale?: string | ... 1 more ... | undefined) => Promise<...>; }

function useTemplatePreview(client: CourierAdminClient): { preview: Ref<{ subject?: string; html?: string; text: string; variables: string[]; } | null, IRenderedTemplateResult | { ...; } | null>; isPreviewing: Ref<...>; error: Ref<...>; renderPreview: (type: string, input: IPreviewTemplateInput, locale?: string | ... 1 more ... | undefined) => Promise<...>; clearPreview: () => void; }

function useTemplateRevisions(client: CourierAdminClient, type: string, locale?: string | null | undefined): { revisions: Ref<{ type: string; locale: string | null; subject: string | null; ... 4 more ...; createdAt: string; }[], ITemplateRevision[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; rollback: (toVersion: number) => Promise<...>; }

function useTemplates(client: CourierAdminClient): { templates: Ref<{ system?: boolean; type: string; locale: string | null; subject: string | null; html: string | null; text: string; active: boolean; version: number; updatedBy: string | null; updatedAt: string; }[], ITemplateEntry[] | { ...; }[]>; ... 4 more ...; removeTemplate: (type: string, locale?: string | ... 1 more ... | undefined) => Promise<...>; }
```
