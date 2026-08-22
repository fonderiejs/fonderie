// Test-only stand-in for @react-native-async-storage/async-storage, which
// cannot load under Node (it requires react-native). Wired in via the
// tsconfig.test.json "paths" mapping that tsx honors at runtime.
const AsyncStorage = {
	async setItem(_key: string, _value: string): Promise<void> {
		// no-op
	},
	async getItem(_key: string): Promise<string | null> {
		return null;
	},
	async removeItem(_key: string): Promise<void> {
		// no-op
	},
};

export default AsyncStorage;
