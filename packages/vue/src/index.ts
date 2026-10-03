export type { FonderieClient } from '@fonderie/client';
export type { IWorkspaceScoped } from './provider';
export {
	FONDERIE_INJECTION_KEY,
	FonderiePlugin,
	provideFonderie,
	useFonderieClient,
	useFonderieSubClient,
	useWorkspaceId,
} from './provider';
export type { ConfigClient, IAuthErrorInfo, IClientLog, IConfigStorage, IRemoteConfigState, ISseClientEvent, SessionState, SseClient, SseStatus } from '@fonderie/client';
export { isSwitchOn } from '@fonderie/client';
export { toApiError, useClientQuery, useRemoteConfig, useScopedQuery, useSse, useSseStatus, useWrite, withRemoteConfig } from './composables';
export type { IScopedQuery, IScopedQueryOptions } from './composables';
export type { IClientQueryResult, IUseClientQueryOptions } from './composables';
export type { IUseSseOptions, IWithRemoteConfigOptions } from './composables';
