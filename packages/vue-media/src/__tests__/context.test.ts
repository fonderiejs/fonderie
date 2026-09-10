import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, MediaClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useDeleteMedia, useUploadAvatar, useUploadMedia } from '../composables';

const fakeMedia = {
	delete: async () => ({ reason: 'OK', explanation: '', result: { id: 'a1' } }),
} as unknown as MediaClient;
// useUploadAvatar resolves the whole client (media + auth), so provide both.
const fakeClient = { media: fakeMedia, auth: {} } as unknown as FonderieClient;

// Renders `run` inside a component's setup(), capturing its value or error.
async function runInSetup<T>(run: () => T, plugin?: boolean) {
	let value: T | undefined;
	let error: unknown;
	const Root = defineComponent({
		setup() {
			try {
				value = run();
			} catch (err) {
				error = err;
			}
			return () => h('div');
		},
	});
	const app = createSSRApp(Root);
	if (plugin) app.use(FonderiePlugin, fakeClient);
	await renderToString(app);
	return { value, error };
}

test('media composables resolve from the plugin with their action + idle shape', async () => {
	const upload = (await runInSetup(() => useUploadMedia(), true)).value!;
	assert.equal(typeof upload.upload, 'function');
	assert.equal(upload.isUploading.value, false);
	assert.equal(upload.error.value, null);

	const avatar = (await runInSetup(() => useUploadAvatar(), true)).value!;
	assert.equal(typeof avatar.uploadAvatar, 'function');
	assert.equal(avatar.isUploading.value, false);
	assert.equal(avatar.error.value, null);

	const del = (await runInSetup(() => useDeleteMedia(), true)).value!;
	assert.equal(typeof del.remove, 'function');
	assert.equal(del.isDeleting.value, false);
	assert.equal(del.error.value, null);
});

test('useDeleteMedia drives the resolved client and clears loading', async () => {
	const del = (await runInSetup(() => useDeleteMedia(), true)).value!;
	await del.remove('a1');
	assert.equal(del.isDeleting.value, false);
	assert.equal(del.error.value, null);
});

test('an explicit sub-client bypasses the plugin', async () => {
	const explicit = { marker: 'explicit-media' } as unknown as MediaClient;
	const { value, error } = await runInSetup(() => useUploadMedia(explicit));
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.upload, 'function');
});

test('composables throw a named error without plugin or argument', async () => {
	const { error } = await runInSetup(() => useUploadMedia());
	assert.match(String(error), /useUploadMedia: no client/);
});
