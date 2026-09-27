import type { AdminClient } from '@fonderie/client';
import { useAdminEnvironment } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { pill } from '../ui';
import { page } from './common';

// Declared vs held: readiness per module, and whether each environment
// variable the app reads is set. Values are never shown.
export const EnvironmentScreen = defineComponent({
	name: 'FonderieEnvironmentScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error } = useAdminEnvironment(props.client);
		return () => {
			const r = report.value;
			const missing = r?.env.filter((e) => !e.set).length ?? 0;
			return page(
				'Environment',
				{ isLoading, error },
				() => {
					if (!r) return null;
					return [
						h('h2', { style: { ...styles.subtitle, marginTop: 0 } }, 'Variables'),
						r.env.length === 0
							? h(
									'p',
									{ style: styles.muted },
									'No variables declared — pass `env` to AdminModule.',
								)
							: h(
									'div',
									{
										style: {
											...styles.grid,
											gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
											gap: '8px',
										},
									},
									r.env.map((e) =>
										h(
											'div',
											{
												key: e.name,
												style: {
													...styles.card,
													padding: '10px 12px',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													gap: '8px',
												},
											},
											[
												h('span', { style: { ...styles.mono, wordBreak: 'break-all' } }, e.name),
												pill(e.set ? 'ok' : 'bad', e.set ? 'set' : 'missing'),
											],
										),
									),
								),
						h('h2', { style: styles.subtitle }, 'Module readiness'),
						h(
							'ul',
							{ style: styles.list },
							r.modules.map((m) =>
								h('li', { key: m.name, style: styles.row }, [
									h(
										'div',
										{
											style: {
												display: 'flex',
												justifyContent: 'space-between',
												gap: '12px',
												alignItems: 'center',
											},
										},
										[
											h('span', { style: { ...styles.mono, fontWeight: 600 } }, m.name),
											pill(
												m.problems.length === 0
													? 'ok'
													: m.problems.some((p) => p.severity === 'error')
														? 'bad'
														: 'warn',
												m.problems.length === 0
													? 'ready'
													: `${m.problems.length} problem${m.problems.length === 1 ? '' : 's'}`,
											),
										],
									),
									...m.problems.map((p) =>
										h(
											'div',
											{
												key: p.message,
												style: {
													marginTop: '6px',
													fontSize: '13px',
													color:
														p.severity === 'error'
															? 'var(--fonderie-danger,#e00)'
															: 'var(--fonderie-text-muted,#5c5c5c)',
												},
											},
											p.message,
										),
									),
								]),
							),
						),
					];
				},
				[
					r && r.env.length > 0
						? pill(missing ? 'bad' : 'ok', missing ? `${missing} missing` : 'all set')
						: null,
				],
				{
					lead: 'Whether each module is configured and each variable the app reads is set. Values are never shown.',
				},
			);
		};
	},
});
