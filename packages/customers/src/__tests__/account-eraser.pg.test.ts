import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { accountEraser } from '../eraser';
import { getMigrationsPath } from '../migrations';

// Erasing an account in customers (deletion design Phase 4), on a REAL
// Postgres: the person stops being named as creator / note author, the
// business's customers and notes stay, other people stay named, a re-run
// finds nothing. Every row here is this file's own (fresh ids) — CI runs every
// suite against one shared database.
//
//   CUSTOMERS_PG_URL=postgres://... npm test -w @fonderie/customers

const PG_URL = process.env['CUSTOMERS_PG_URL'];
const skip = PG_URL ? false : 'set CUSTOMERS_PG_URL to run';

let store: IStoreAdapter & { end?: () => Promise<void> };

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
});

after(async () => {
	await store?.end?.();
});

async function customer(workspaceId: string, createdBy: string | null): Promise<string> {
	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_customers (workspace_id, first_name, created_by) VALUES ($1, 'Pat', $2) RETURNING id`,
		[workspaceId, createdBy],
	);
	return row!.id;
}

async function note(customerId: string, authorId: string | null, body: string): Promise<string> {
	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_customer_notes (customer_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
		[customerId, authorId, body],
	);
	return row!.id;
}

test('the person is no longer named on the customers they created or the notes they wrote; the records stay', { skip }, async () => {
	const ws = randomUUID();
	const gone = randomUUID();
	const colleague = randomUUID();
	const mine1 = await customer(ws, gone);
	const mine2 = await customer(ws, gone);
	const theirs = await customer(ws, colleague);
	const n1 = await note(theirs, gone, 'called back about the quote');
	const n2 = await note(mine1, colleague, 'prefers email');

	const out = await accountEraser(store).erase({ userId: gone, email: 'gone@acme.example', phone: null });
	assert.equal(out.erased, 3, '2 customers + 1 note');
	assert.match(out.kept ?? '', /belong to the business/);

	const cs = await store.query<{ id: string; createdBy: string | null }>(
		`SELECT id, created_by AS "createdBy" FROM fonderie_customers WHERE workspace_id = $1 ORDER BY id`,
		[ws],
	);
	assert.equal(cs.length, 3, 'every customer record is kept');
	const by = new Map(cs.map((c) => [c.id, c.createdBy]));
	assert.equal(by.get(mine1), null);
	assert.equal(by.get(mine2), null);
	assert.equal(by.get(theirs), colleague, "a colleague's customer still names them");

	const ns = await store.query<{ id: string; authorId: string | null; body: string }>(
		`SELECT id, author_id AS "authorId", body FROM fonderie_customer_notes WHERE id = ANY($1::uuid[])`,
		[[n1, n2]],
	);
	const notes = new Map(ns.map((n) => [n.id, n]));
	assert.deepEqual(notes.get(n1), { id: n1, authorId: null, body: 'called back about the quote' }, 'the note stays, by nobody');
	assert.equal(notes.get(n2)?.authorId, colleague, "a colleague's note still names them");

	// Idempotent: the purge retries the whole fan-out when a later brick fails.
	const again = await accountEraser(store).erase({ userId: gone, email: 'gone@acme.example', phone: null });
	assert.equal(again.erased, 0);
});

test('negative: someone with nothing in customers erases nothing and touches no one else', { skip }, async () => {
	const ws = randomUUID();
	const bystander = randomUUID();
	const c = await customer(ws, bystander);
	const n = await note(c, bystander, 'met at the trade show');

	const out = await accountEraser(store).erase({ userId: randomUUID(), email: null, phone: null });
	assert.equal(out.erased, 0);
	const [row] = await store.query<{ createdBy: string; authorId: string }>(
		`SELECT c.created_by AS "createdBy", n.author_id AS "authorId"
		   FROM fonderie_customers c JOIN fonderie_customer_notes n ON n.customer_id = c.id
		  WHERE c.id = $1 AND n.id = $2`,
		[c, n],
	);
	assert.deepEqual(row, { createdBy: bystander, authorId: bystander });
});

test('the eraser names itself as the receipt expects', () => {
	assert.equal(accountEraser({} as IStoreAdapter).name, 'customers');
});
