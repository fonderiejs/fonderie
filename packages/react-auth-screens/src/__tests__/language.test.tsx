import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { LoginScreen, RegisterScreen } from '../screens';

// A screen in the app's UI language, end to end: the client's locale →
// useUiT → the dictionary → what renders. These screens were English-only.

const html = (client: FonderieClient, el: ReturnType<typeof createElement>) =>
	renderToString(createElement(FonderieProvider, { client }, el));

test('the login screen speaks the client language: French for fr-CA, Traditional for zh-TW, Simplified for zh-CN', () => {
	const fr = html(new FonderieClient({ baseUrl: 'http://api.test', locale: 'fr-CA' }), createElement(LoginScreen));
	assert.match(fr, /Connexion/);
	assert.match(fr, /Mot de passe oublié/);
	assert.doesNotMatch(fr, /Forgot password/);

	assert.match(html(new FonderieClient({ baseUrl: 'http://api.test', locale: 'zh-TW' }), createElement(LoginScreen)), /忘記密碼/);
	assert.match(html(new FonderieClient({ baseUrl: 'http://api.test', locale: 'zh-CN' }), createElement(LoginScreen)), /忘记密码/);
});

test('English stays the default, a screen can override, and setLocale switches the language', () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test', locale: 'en-US' });
	assert.match(html(client, createElement(LoginScreen)), /Forgot password\?/);
	assert.match(html(client, createElement(LoginScreen, { locale: 'es-US' })), /¿Olvidaste tu contraseña\?/);
	client.setLocale('fr-CA');
	assert.match(html(client, createElement(LoginScreen)), /Mot de passe oublié/);
});

test('a screen handed only a sub-client (no provider) still finds the language', () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test', locale: 'fr-CA' });
	const out = renderToString(createElement(LoginScreen, { client: client.auth }));
	assert.match(out, /Mot de passe oublié/);
});

test('the register screen renders its fields in the language', () => {
	const out = html(new FonderieClient({ baseUrl: 'http://api.test', locale: 'zh-HK' }), createElement(RegisterScreen));
	assert.match(out, /建立帳戶/);
	assert.match(out, /電子郵件/);
});
