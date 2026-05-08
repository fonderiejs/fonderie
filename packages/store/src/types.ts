export interface IStoreAdapter {
	query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
	transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T>;
}
