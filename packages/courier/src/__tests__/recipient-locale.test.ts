import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import type { ICourierConfig } from '../config';
import { Dispatcher } from '../dispatcher';
import type { ICourierMessage, ITemplateResolver } from '../types';

// Which language a message is written in. Senders without a session (billing
// webhooks, invitations) passed none, so a French-speaking customer got their
// receipt in English. Order: the sender's explicit locale → the recipient's
// own account → the sender's fallback (the business's) → the default.

const config: ICourierConfig = { channels: { receipt: ['email'] } };

function harness(accounts: Record<string, string>, opts: { tableMissing?: boolean; lookup?: boolean } = {}) {
	const asked: Array<string | undefined> = [];
	const resolver: ITemplateResolver = {
		async resolve(_type, _data, locale) {
			asked.push(locale);
			return { subject: 's', text: 't' };
		},
	};
	const store = {
		query: async (sql: string, params: unknown[] = []) => {
			if (sql.includes('FROM fonderie_users')) {
				if (opts.tableMissing) throw Object.assign(new Error('relation "fonderie_users" does not exist'), { code: '42P01' });
				const [email, phone] = params as [string | null, string | null];
				const hit = (email && accounts[email.toLowerCase()]) || (phone && accounts[phone]);
				return hit ? [{ locale: hit }] : [];
			}
			if (sql.includes('INSERT INTO fonderie_message_log')) return [{ id: 'log-1' }];
			return [];
		},
		transaction: async (fn: (tx: unknown) => unknown) => fn(store),
	} as unknown as IStoreAdapter;
	const d = new Dispatcher(opts.lookup === false ? { ...config, recipientLocaleLookup: false } : config, resolver, store);
	d.registerChannel({ name: 'email', async send() {} });
	const send = (m: Partial<ICourierMessage>) =>
		d.dispatch({ type: 'receipt', recipient: { email: null, phone: null, deviceToken: null }, data: {}, ...m } as ICourierMessage);
	return { asked, send };
}

test("no language given: the recipient's own account decides", async () => {
	const h = harness({ 'marie@client.example': 'fr-CA', '+15145550100': 'zh-Hant' });
	await h.send({ recipient: { email: 'Marie@Client.example', phone: null, deviceToken: null } });
	await h.send({ recipient: { email: null, phone: '+15145550100', deviceToken: null } });
	assert.deepEqual(h.asked, ['fr-CA', 'zh-Hant']);
});

test("the sender's explicit language always wins", async () => {
	const h = harness({ 'marie@client.example': 'fr-CA' });
	await h.send({ locale: 'es-US', fallbackLocale: 'en-CA', recipient: { email: 'marie@client.example', phone: null, deviceToken: null } });
	assert.deepEqual(h.asked, ['es-US']);
});

test("no account: the sender's fallback (the business's language), never above the recipient's own", async () => {
	const h = harness({ 'known@client.example': 'en-US' });
	await h.send({ fallbackLocale: 'fr-CA', recipient: { email: 'new@client.example', phone: null, deviceToken: null } });
	await h.send({ fallbackLocale: 'fr-CA', recipient: { email: 'known@client.example', phone: null, deviceToken: null } });
	assert.deepEqual(h.asked, ['fr-CA', 'en-US']);
});

test('no users table (courier without auth), or lookup turned off: straight to the fallback', async () => {
	const missing = harness({}, { tableMissing: true });
	await missing.send({ fallbackLocale: 'fr-CA', recipient: { email: 'a@client.example', phone: null, deviceToken: null } });
	const off = harness({ 'a@client.example': 'zh-Hans' }, { lookup: false });
	await off.send({ fallbackLocale: 'fr-CA', recipient: { email: 'a@client.example', phone: null, deviceToken: null } });
	assert.deepEqual([...missing.asked, ...off.asked], ['fr-CA', 'fr-CA']);
});
