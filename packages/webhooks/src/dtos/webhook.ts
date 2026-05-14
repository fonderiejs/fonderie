import type { IWebhookEndpoint, IWebhookDelivery } from '../types';

export interface IWebhookEndpointDTO {
	id: string;
	url: string;
	events: string[];
	enabled: boolean;
	createdAt: string;
}

export interface IWebhookEndpointCreatedDTO extends IWebhookEndpointDTO {
	secret: string;
}

export interface IWebhookDeliveryDTO {
	id: string;
	eventId: string;
	eventType: string;
	status: string;
	attempts: number;
	responseStatus: number | null;
	deliveredAt: string | null;
	createdAt: string;
}

export function toEndpointDTO(e: IWebhookEndpoint): IWebhookEndpointDTO {
	return {
		id: e.id,
		url: e.url,
		events: e.events,
		enabled: e.enabled,
		createdAt: e.createdAt.toISOString(),
	};
}

export function toEndpointCreatedDTO(e: IWebhookEndpoint): IWebhookEndpointCreatedDTO {
	return { ...toEndpointDTO(e), secret: e.secret };
}

export function toDeliveryDTO(d: IWebhookDelivery): IWebhookDeliveryDTO {
	return {
		id: d.id,
		eventId: d.eventId,
		eventType: d.eventType,
		status: d.status,
		attempts: d.attempts,
		responseStatus: d.responseStatus,
		deliveredAt: d.deliveredAt?.toISOString() ?? null,
		createdAt: d.createdAt.toISOString(),
	};
}
