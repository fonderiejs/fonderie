// ── Public API ───────────────────────────────────────────────────
export { RemoteConfigModule }                        from './module';
export { RemoteConfigManager, CONFIG_MANAGER_KEY }   from './manager';
export { configContextMiddleware, getConfig }        from './middlewares/config-context';
export { listConfigEntries, getConfigEntry,
         setConfigEntry, deleteConfigEntry }         from './services/config';

export type { IConfigEntry, IConfigSnapshot }        from './types';
export type { IRemoteConfigOptions }                 from './config';
