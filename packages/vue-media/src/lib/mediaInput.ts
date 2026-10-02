import { blobToBase64 } from './blobToBase64';

/**
 * What an upload accepts: a Blob/File (a browser's `<input type="file">`), or
 * the image's base64 — raw or as a `data:` URL.
 *
 * Prefer base64 on React Native: native pickers return it directly
 * (expo-image-picker `base64: true`, expo-image-manipulator), while turning a
 * file URI into a Blob there goes through fetch, the native blob store and
 * FileReader — a chain that can hand the server bytes that are not the image.
 */
export type MediaInput = Blob | { base64: string };

export async function toBase64(input: MediaInput): Promise<string> {
	if (typeof Blob !== 'undefined' && input instanceof Blob) return blobToBase64(input);
	const raw = (input as { base64?: unknown })?.base64;
	if (typeof raw !== 'string' || raw.length === 0) {
		throw new Error('Nothing to upload: pass a Blob, or { base64 } with the image data.');
	}
	const comma = raw.startsWith('data:') ? raw.indexOf(',') : -1;
	// Some encoders wrap lines; base64 has no whitespace of its own.
	return (comma >= 0 ? raw.slice(comma + 1) : raw).replace(/\s+/g, '');
}
