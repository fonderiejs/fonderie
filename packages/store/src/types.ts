export interface IStoreAdapter {
	query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
	transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T>;
}

export interface IPoolConfig {
	connectionString?:        string
	host?:                    string
	port?:                    number
	database?:                string
	user?:                    string
	password?:                string
	max?:                     number
	idleTimeoutMillis?:       number
	connectionTimeoutMillis?: number
	ssl?:                     boolean | { rejectUnauthorized: boolean }
}
