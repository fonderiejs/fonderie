import { matchesTopic } from '@fonderie/core';
import type { IEventCatalogEntryWithModule, IEventScope, IFonderieContext, ISseStream } from '@fonderie/core';

import type { ISseMessage } from './types';

export interface IConnection {
	topics: string[];
	ctx: IFonderieContext;
	stream: ISseStream;
}

/**
 * Who may receive an entry's event on a given connection. The connection's
 * user and workspace are what the app's middleware chain resolved when the
 * stream opened (ctx.user, ctx.workspace — withWorkspace already verified
 * membership); sse adds no identity logic of its own.
 */
export async function mayReceive(
	entry: IEventCatalogEntryWithModule,
	ctx: IFonderieContext,
	scope: IEventScope,
): Promise<boolean> {
	const { audience } = entry;
	if (audience === 'public') return true;
	if (!ctx.user) return false;
	if (audience === 'user') return !!scope.userId && scope.userId === ctx.user.id;
	if (audience === 'workspace') return !!scope.workspaceId && scope.workspaceId === ctx.workspace?.id;
	try {
		return (await audience(ctx, scope)) === true;
	} catch (err) {
		console.error(`[sse] audience check for ${entry.type} failed:`, (err as Error)?.message);
		return false;
	}
}

export class Hub {
	private readonly connections = new Set<IConnection>();

	constructor(private readonly catalog: ReadonlyMap<string, IEventCatalogEntryWithModule>) {}

	add(connection: IConnection): void {
		this.connections.add(connection);
	}

	remove(connection: IConnection): void {
		this.connections.delete(connection);
	}

	get size(): number {
		return this.connections.size;
	}

	countForUser(userId: string): number {
		let n = 0;
		for (const c of this.connections) if (c.ctx.user?.id === userId) n++;
		return n;
	}

	/** Deliver to every connection that subscribed to the type AND may receive it. */
	async deliver(message: ISseMessage): Promise<void> {
		// Default deny, even for a message that somehow arrived: no entry, no delivery.
		const entry = this.catalog.get(message.type);
		if (!entry) return;
		for (const connection of [...this.connections]) {
			if (connection.stream.closed) {
				this.connections.delete(connection);
				continue;
			}
			if (!connection.topics.some((filter) => matchesTopic(filter, message.type))) continue;
			if (!(await mayReceive(entry, connection.ctx, message.scope))) continue;
			connection.stream.send({
				id: message.id,
				event: message.type,
				data: { type: message.type, data: message.data, at: message.at },
			});
		}
	}

	closeAll(): void {
		for (const connection of this.connections) connection.stream.close();
		this.connections.clear();
	}
}
