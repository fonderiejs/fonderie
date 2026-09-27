import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defineLocales } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { authController } from '../controllers/auth.controller';

// A new account's locale is the language the person signed up in, else the
// app's system locale — so the very first email, the verification code,
// already arrives in it instead of always in en-US.

const config: IAuthConfig = { jwtSecret: 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb', sessionDuration: '7d', providers: ['email'] };

function harness() {
	let savedLocale: unknown;
	const emitted: Array<{ type?: string; locale?: string }> = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			if (sql.includes('INSERT INTO fonderie_users')) {
				savedLocale = params[4];
				return [{ id: 'u1' }] as T[];
			}
			if (sql.includes('FROM fonderie_users') && sql.includes('WHERE id')) {
				return [{ id: 'u1', email: 'ada@example.com', locale: savedLocale, preferences: {} }] as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const bus = {
		emit: async (_event: string, payload: { type?: string; locale?: string }) => {
			emitted.push(payload);
		},
	} as never;
	const register = (locales: ReturnType<typeof defineLocales>, extra: Record<string, unknown>) =>
		authController(store, config, bus, locales).register({
			meta: { body: { email: 'ada@example.com', password: 'a long enough passphrase', ...extra } },
			request: new Request('http://localhost/auth/register', { method: 'POST' }),
			user: null,
		} as never);
	return { register, emitted, saved: () => savedLocale };
}

test('sign-up in a language: stored canonical, and the first email is sent in it', async () => {
	const h = harness();
	await h.register(defineLocales(), { locale: 'fr-ca' });
	assert.equal(h.saved(), 'fr-CA');
	const first = h.emitted.find((e) => e.type === 'email-registration');
	assert.equal(first?.locale, 'fr-CA');
});

test('no language, or an unreadable one: the app system locale, not a hard-coded en-US', async () => {
	const h = harness();
	await h.register(defineLocales({ default: 'en-CA' }), {});
	assert.equal(h.saved(), 'en-CA');
	const h2 = harness();
	await h2.register(defineLocales({ default: 'en-CA' }), { locale: 'not a tag' });
	assert.equal(h2.saved(), 'en-CA', 'lenient: sign-up never fails over a locale');
});
