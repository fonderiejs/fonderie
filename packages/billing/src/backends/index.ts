import type { IStoreAdapter }        from '@fonderie-js/store'
import type { RateLimitBackendConfig } from '../config'
import { MemoryCounterBackend }        from './memory'
import { DBCounterBackend }            from './db'

export function createBackend(
	config: RateLimitBackendConfig | undefined,
	store:  IStoreAdapter,
) {
	if (!config || config === 'memory') return new MemoryCounterBackend()
	if (config === 'db')               return new DBCounterBackend(store)
	return config
}

export type { ICounterBackend }   from './types'
export { MemoryCounterBackend }   from './memory'
export { DBCounterBackend }       from './db'
