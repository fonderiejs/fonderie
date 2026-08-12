export const TOKEN_KEY = 'fonderie_access_token';

export function persistToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
	localStorage.removeItem(TOKEN_KEY);
}

export function readToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}
