// Read a File/Blob (from an `<input type="file">`) into a RAW base64 string —
// FileReader yields a `data:<mime>;base64,<payload>` URL, so strip the prefix.
// Composables run client-side, where FileReader is available.
export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('Could not read the file'));
		reader.onload = () => {
			const result = String(reader.result);
			const comma = result.indexOf(',');
			resolve(comma >= 0 ? result.slice(comma + 1) : result);
		};
		reader.readAsDataURL(blob);
	});
}
