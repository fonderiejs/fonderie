import type { ICourierMessage, IDefaultTemplate } from '@fonderie/core/types';

export type { ICourierMessage, IDefaultTemplate };

// A module ships its built-in copy as Record<ItsMessageKey, IDefaultTemplate>;
// the app hands courier one (or an array, aggregated like getMigrationsPath())
// and the resolver falls back to it before the last-resort JSON dump.
export type DefaultTemplateMap = Record<string, IDefaultTemplate>;

export interface ICourierChannel {
	name: string;
	send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>;
}

export interface IRenderedTemplate {
	subject?: string; // email only
	html?: string; // email only
	text: string; // all channels
}

export interface ITemplateResolver {
	resolve(type: string, data: Record<string, unknown>, locale?: string): Promise<IRenderedTemplate>;
}

export type { IMessageLog, MessageLogStatus } from './log';
