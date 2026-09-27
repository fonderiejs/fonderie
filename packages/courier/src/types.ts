import type { ICourierMessage, IDefaultTemplate } from '@fonderie/core/types';
import type { ILocaleSettings } from '@fonderie/core';

export type { ICourierMessage, IDefaultTemplate };

// A module ships its built-in copy as Record<ItsMessageKey, IDefaultTemplate>;
// the app hands courier one (or an array, aggregated like getMigrationsPath())
// and the resolver falls back to it before the last-resort JSON dump.
export type DefaultTemplateMap = Record<string, IDefaultTemplate>;

// What a channel learned from the provider about a successful send. The
// provider message id is what delivery webhooks key their updates on — a
// channel that doesn't return it leaves delivery tracking permanently
// 'sent' (the webhook UPDATE matches zero rows).
export interface ISendResult {
	providerMessageId?: string;
}

export interface ICourierChannel {
	name: string;
	send(message: ICourierMessage, template: IRenderedTemplate): Promise<ISendResult | void>;
}

export interface IRenderedTemplate {
	subject?: string; // email only
	html?: string; // email only
	text: string; // all channels
	// The version actually used — a saved row's tag, a built-in's language, or
	// the system locale for the default copy. Absent for the last-resort dump.
	// Recorded in the message log beside the locale that was asked for.
	locale?: string;
}

export interface ITemplateResolver {
	resolve(type: string, data: Record<string, unknown>, locale?: string): Promise<IRenderedTemplate>;
	/** Receives the app's locales at install (core owns them). Optional for custom resolvers. */
	setLocales?(settings: ILocaleSettings): void;
}

export type { IMessageLog, MessageLogStatus } from './log';
