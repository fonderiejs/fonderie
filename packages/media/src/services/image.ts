/**
 * Decode a base64 payload to bytes. Accepts both a bare base64 string and a
 * data URI (`data:image/png;base64,<...>`) — the frontend `FileReader` produces
 * the latter, so callers don't have to strip it.
 */
export function decodeBase64(input: string): Uint8Array {
	const comma = input.startsWith('data:') ? input.indexOf(',') : -1;
	const b64 = comma >= 0 ? input.slice(comma + 1) : input;
	return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Identify an image from its magic bytes — NOT from a client-claimed MIME type,
 * which is trivially spoofed. Returns the canonical content type or `null` for
 * anything unrecognised. SVG is deliberately not detected (it's XML, can carry
 * scripts, and is a stored-XSS vector), so it falls through to `null` and is
 * rejected upstream.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
	const b = bytes;
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
		return 'image/png';
	}
	// JPEG: FF D8 FF
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
		return 'image/jpeg';
	}
	// GIF: "GIF87a" / "GIF89a"
	if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) {
		return 'image/gif';
	}
	// WEBP: "RIFF" .... "WEBP" (bytes 0-3 and 8-11)
	if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
		return 'image/webp';
	}
	return null;
}
