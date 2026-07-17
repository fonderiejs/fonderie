<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/courier — signatures

## @fonderie/courier

Subpath exports: `@fonderie/courier/types`, `@fonderie/courier/migrations`

```ts
new CourierModule(config: ICourierConfig, store?: IStoreAdapter | undefined, bus?: EventBus | undefined): CourierModule
  .name: "@fonderie/courier"
  .deps: string[]
  .dispatcher: Dispatcher
  .install(app: IFonderieApp): void

function handleSendGridDelivery(req: Request, store: IStoreAdapter, webhookSecret?: string | undefined): Promise<Response>

function handleMailgunDelivery(req: Request, store: IStoreAdapter, signingKey?: string | undefined): Promise<Response>

function handleMailtrapDelivery(req: Request, store: IStoreAdapter): Promise<Response>

new Dispatcher(config: ICourierConfig, resolver: ITemplateResolver, store?: IStoreAdapter | undefined): Dispatcher
  .registerChannel(channel: ICourierChannel): Dispatcher
  .dispatch(message: ICourierMessage): Promise<void>

new SmsChannel(config: ISmsChannelConfig): SmsChannel
  .name: "sms"
  .send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>

new PushChannel(config: IPushChannelConfig): PushChannel
  .name: "push"
  .send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>

new EmailChannel(config: IEmailChannelConfig): EmailChannel
  .name: "email"
  .send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>

new DBTemplateResolver(store: IStoreAdapter): DBTemplateResolver
  .resolve(type: string, data: Record<string, unknown>, locale?: string | undefined): Promise<IRenderedTemplate>

new FSTemplateResolver(directory: string): FSTemplateResolver
  .resolve(type: string, data: Record<string, unknown>, locale?: string | undefined): Promise<IRenderedTemplate>

interface IMessageLog {
    id: string;
    messageType: string;
    channel: string;
    recipient: string;
    locale: string | null;
    status: MessageLogStatus;
    error: string | null;
    attempts: number;
    provider: string | null;
    providerMessageId: string | null;
    openedAt: string | null;
    clickedAt: string | null;
    bouncedAt: string | null;
    bounceReason: string | null;
    createdAt: string;
    sentAt: string | null;
}

type MessageLogStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam';

interface ICourierMessage {
    type: string;
    locale?: string;
    recipient: {
        email: string | null;
        phone: string | null;
        deviceToken: string | null;
    };
    data: Record<string, unknown>;
}

interface ICourierChannel {
    name: string;
    send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>;
}

interface IRenderedTemplate {
    subject?: string;
    html?: string;
    text: string;
}

interface ITemplateResolver {
    resolve(type: string, data: Record<string, unknown>, locale?: string): Promise<IRenderedTemplate>;
}

const Channel: { readonly EMAIL: "email"; readonly SMS: "sms"; readonly PUSH: "push"; }

interface ICourierConfig {
    channels: Record<string, Array<'email' | 'sms' | 'push'>>;
    sms?: ISmsChannelConfig;
    push?: IPushChannelConfig;
    email?: IEmailChannelConfig;
    templates?: {
        source: 'db' | 'fs';
        directory?: string;
    };
    delivery?: {
        signingKeys?: {
            sendgrid?: string;
            mailgun?: string;
        };
    };
}

interface IEmailChannelConfig {
    provider: 'resend' | 'ses' | 'smtp';
    from: string;
    apiKey?: string;
    smtp?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
    };
}

interface ISmsChannelConfig {
    provider: 'twilio' | 'vonage';
    from: string;
    accountSid?: string;
    authToken?: string;
    apiKey?: string;
    apiSecret?: string;
}

interface IPushChannelConfig {
    provider: 'fcm';
    serviceAccount: Record<string, unknown>;
}
```
