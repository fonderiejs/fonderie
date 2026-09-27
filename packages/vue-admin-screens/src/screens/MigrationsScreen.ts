import {
	type AdminClient,
	type AdminLocale,
	type AdminT,
	createAdminT,
	type IAdminMigrationModule,
} from '@fonderie/client';
import { useAdminMigrations } from '@fonderie/vue-admin';
import type { PropType, VNode } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { empty, pill } from '../ui';
import { page, refreshButton } from './common';

// Why a module might not be appliable, in the operator's terms. Order matters:
// being blocked by an earlier module is the more actionable answer, so it is
// reported before the destructive one even when both are true.
function why(t: AdminT, m: IAdminMigrationModule, everApplied: boolean): string | null {
	if (m.pending.length === 0) return null;
	if (m.blockedBy) return t('migrations.blockedBy', { module: m.blockedBy });
	if (everApplied && m.pending.some((p) => p.impact === 'destructive'))
		return t('migrations.destructiveBlocked');
	return null;
}

export const MigrationsScreen = defineComponent({
	name: 'FonderieMigrationsScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { report, isLoading, error, refresh, apply } = useAdminMigrations(props.client);

		const section = (t: AdminT, m: IAdminMigrationModule, everApplied: boolean): VNode => {
			const blocked = why(t, m, everApplied);
			const files = m.pending.map((p) => p.file);
			return h('section', { style: { ...styles.card, marginBottom: '16px' } }, [
				h('h2', { style: { ...styles.subtitle, marginTop: 0 } }, [
					h('span', { style: styles.mono }, m.name),
					pill('warn', t('migrations.pendingCount', { n: m.pending.length })),
				]),
				h(
					'ul',
					{ style: { margin: '0 0 12px', paddingLeft: '18px', lineHeight: 1.9 } },
					m.pending.map((p) =>
						h('li', [
							h('code', { style: styles.code }, p.file),
							' ',
							p.impact === 'destructive'
								? pill('bad', t('migrations.destructive'))
								: pill('neutral', t('migrations.additive')),
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
					? h('p', { style: { ...styles.notice, marginBottom: 0 } }, blocked)
					: h(
							'button',
							{
								type: 'button',
								style: styles.buttonPrimary,
								disabled: isLoading.value || !m.appliable,
								onClick: () => {
									if (
										window.confirm(
											t('migrations.confirmApply', { n: m.pending.length, module: m.name }),
										)
									)
										// The composable already put any failure in `error` and
										// re-read the real state; nothing useful is left to do.
										void apply(m.name, files).catch(() => {});
								},
							},
							m.pending.length === 1
								? t('migrations.applyOne')
								: t('migrations.applyMany', { n: m.pending.length }),
						),
			]);
		};

		return () => {
			const t = createAdminT(props.locale);
			return page(
				t('migrations.title'),
				{ isLoading, error },
				() => {
					const r = report.value;
					if (!r) return null;
					const behind = r.modules.filter((m) => m.pending.length > 0);
					if (behind.length === 0)
						return empty(t('migrations.upToDate'), t('migrations.noPending'), 'migrations');
					return [
						r.everApplied ? null : h('p', { style: styles.notice }, t('migrations.firstInstall')),
						...behind.map((m) => section(t, m, r.everApplied)),
					].filter(Boolean) as VNode[];
				},
				[
					refreshButton(
						t('common.refresh'),
						isLoading.value,
						() => void refresh(),
						t('common.working'),
					),
				],
				{
					loadingText: t('common.loading'),
					lead: t('migrations.lead'),
					errorText: (e) => (e.status === 403 ? t('migrations.needsWrite') : e.explanation),
				},
			);
		};
	},
});
