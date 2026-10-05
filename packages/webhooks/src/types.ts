export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface IWebhookEndpoint {
	id: string;
	workspaceId: string;
	url: string;
	secret: string;
	events: string[];
	enabled: boolean;
	createdAt: Date;
}

export interface IWebhookDelivery {
	id: string;
	endpointId: string;
	eventId: string;
	eventType: string;
	payload: Record<string, unknown>;
	status: DeliveryStatus;
	attempts: number;
	responseStatus: number | null;
	responseBody: string | null;
	nextAttemptAt: Date | null;
	deliveredAt: Date | null;
	createdAt: Date;
}

/** A deleted endpoint in the undo bin — never its secret. */
export interface IBinnedEndpoint {
	id: string;
	url: string;
	events: string[];
	deletedBy: string | null;
	deletedAt: Date;
	/** When the bin forgets it. */
	purgeAt: Date;
}
