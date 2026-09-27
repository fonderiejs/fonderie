export type { FonderieClient } from '@fonderie/client';
export {
	FONDERIE_INJECTION_KEY,
	FonderiePlugin,
	provideFonderie,
	useFonderieClient,
	useFonderieSubClient,
} from './provider';
export type { ConfigClient, IRemoteConfigState } from '@fonderie/client';
export { useFlag, useRemoteConfig } from './composables';
export type { IUseRemoteConfigOptions, IUseRemoteConfigReturn } from './composables';
