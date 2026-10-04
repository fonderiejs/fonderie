import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { FonderieClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { LoginScreen } from '../screens';

// The Vue login screen in the app's UI language, end to end through the plugin.

async function render(client: FonderieClient, props: Record<string, unknown> = {}): Promise<string> {
	const app = createSSRApp({ render: () => h(LoginScreen, props) });
	app.use(FonderiePlugin, client);
	return renderToString(app);
}

test('French for fr-CA, Traditional for zh-TW, English by default, and a per-screen override', async () => {
	assert.match(await render(new FonderieClient({ baseUrl: 'http://api.test', locale: 'fr-CA' })), /Mot de passe oublié/);
	assert.match(await render(new FonderieClient({ baseUrl: 'http://api.test', locale: 'zh-TW' })), /忘記密碼/);
	const en = new FonderieClient({ baseUrl: 'http://api.test', locale: 'en-US' });
	assert.match(await render(en), /Forgot password\?/);
	assert.match(await render(en, { locale: 'es-US' }), /¿Olvidaste tu contraseña\?/);
});
