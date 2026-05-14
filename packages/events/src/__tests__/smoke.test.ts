import { describe, it, before, after } from 'node:test';
import assert                          from 'node:assert/strict';

import { EventBus }       from '../bus';
import { MemoryTransport } from '../transports/memory';

describe('EventBus (memory transport)', () => {
	let bus: EventBus;

	before(async () => {
		bus = new EventBus(new MemoryTransport());
		await bus.start();
	});

	after(async () => {
		await bus.stop();
	});

	it('delivers a typed event to a registered handler', async () => {
		const received: unknown[] = [];
		bus.on<{ userId: string }>('user.registered', async (payload) => {
			received.push(payload);
		});

		await bus.emit('user.registered', { userId: 'u-1' });

		assert.equal(received.length, 1);
		assert.deepEqual(received[0], { userId: 'u-1' });
	});

	it('delivers to wildcard handler', async () => {
		const types: string[] = [];
		bus.on<unknown>('*', async (_payload, meta) => {
			types.push(meta.type);
		});

		await bus.emit('user.deleted',  { userId: 'u-2' });
		await bus.emit('user.verified', { userId: 'u-3' });

		assert.ok(types.includes('user.deleted'));
		assert.ok(types.includes('user.verified'));
	});

	it('does not deliver to unrelated handlers', async () => {
		const received: unknown[] = [];
		bus.on<unknown>('order.created', async (p) => { received.push(p) });

		await bus.emit('invoice.created', { id: 'inv-1' });

		assert.equal(received.length, 0);
	});

	it('passes requestId through meta', async () => {
		let capturedMeta: { requestId?: string } | undefined;
		bus.on<unknown>('ping', async (_p, meta) => { capturedMeta = meta });

		await bus.emit('ping', {}, { requestId: 'req-abc' });

		assert.equal(capturedMeta?.requestId, 'req-abc');
	});
});
