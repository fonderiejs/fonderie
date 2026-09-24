import type { AdminClient, IAdminMigrationModule } from '@fonderie/client';
import { useAdminMigrations } from '@fonderie/vue-admin';
import type { PropType, VNode } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page, refreshButton } from './common';

// Why a module might not be appliable, in the operator's terms. Order matters:
// being blocked by an earlier module is the more actionable answer, so it is
// reported before the destructive one even when both are true.
function why(m: IAdminMigrationModule, everApplied: boolean): string | null {
	if (m.pending.length === 0) return null;
	if (m.blockedBy) return `Apply "${m.blockedBy}" first — it runs before this one and is behind.`;
	if (everApplied && m.pending.some((p) => p.impact === 'destructive'))
		return 'Contains a migration that deletes data. No down-migration brings it back — apply this one through CI or `npm run migrate`.';
	return null;
}

export const MigrationsScreen = defineComponent({
	name: 'FonderieMigrationsScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error, refresh, apply } = useAdminMigrations(props.client);

		const section = (m: IAdminMigrationModule, everApplied: boolean): VNode => {
			const blocked = why(m, everApplied);
			const files = m.pending.map((p) => p.file);
			return h('section', { style: { marginBottom: '24px' } }, [
				h('h2', { style: styles.subtitle }, `${m.name} — ${m.pending.length} pending`),
				h(
					'ul',
					m.pending.map((p) =>
						h('li', [
							h('code', p.file),
							' ',
							h(
								'span',
								{ style: p.impact === 'destructive' ? styles.bad : styles.advice },
								p.impact,
							),
							p.destructive.length > 0
								? h(
										'ul',
										p.destructive.map((s) => h('li', [h('code', s.slice(0, 120))])),
									)
								: null,
						]),
					),
				),
				blocked
					? h('p', { style: styles.advice }, blocked)
					: h(
							'button',
							{
								type: 'button',
								style: styles.button,
								disabled: isLoading.value || !m.appliable,
								onClick: () => {
									if (
										window.confirm(
											`Apply ${m.pending.length} migration(s) to "${m.name}"? This changes the database schema.`,
										)
									)
										// The composable already put any failure in `error` and
										// re-read the real state; nothing useful is left to do.
										void apply(m.name, files).catch(() => {});
								},
							},
							`Apply ${m.pending.length} migration${m.pending.length === 1 ? '' : 's'}`,
						),
			]);
		};

		return () =>
			page(
				'Migrations',
				{ isLoading, error },
				() => {
					const r = report.value;
					if (!r) return null;
					const behind = r.modules.filter((m) => m.pending.length > 0);
					if (behind.length === 0) return h('p', { style: styles.ok }, 'Every module is up to date.');
					return [
						r.everApplied
							? null
							: h(
									'p',
									{ style: styles.advice },
									'This database has never been migrated — treating it as a first install, so nothing is held back.',
								),
						...behind.map((m) => section(m, r.everApplied)),
					].filter(Boolean) as VNode[];
				},
				[refreshButton('Refresh', isLoading.value, () => void refresh())],
				{
					errorText: (e) =>
						e.status === 403
							? 'Applying migrations needs a token with the write scope.'
							: e.explanation,
				},
			);
	},
});
