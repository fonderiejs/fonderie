import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'fonderie_access_token';

export function persistToken(token: string) {
	return AsyncStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
	return AsyncStorage.removeItem(TOKEN_KEY);
}

export function readToken() {
	return AsyncStorage.getItem(TOKEN_KEY);
}
