import type { ICourierMessage } from '@fonderie-js/core/types';

export type { ICourierMessage };

export interface ICourierChannel {
	name: string
	send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>
}

export interface IRenderedTemplate {
	subject?: string    // email only
	html?:    string    // email only
	text:     string    // all channels
}

export interface ITemplateResolver {
	resolve(type: string, data: Record<string, unknown>): Promise<IRenderedTemplate>
}
