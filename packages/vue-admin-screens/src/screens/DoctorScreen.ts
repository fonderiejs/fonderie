import { type AdminClient, type AdminLocale, createAdminT } from '@fonderie/client';
import { useDoctor } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { pill } from '../ui';
import { page, refreshButton, table, td } from './common';

// Every reconciliation check, on demand. ok is false only for a hard failure;
// findings on a passing check are advice.
export const DoctorScreen = defineComponent({
	name: 'FonderieDoctorScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { report, isLoading, error, refresh } = useDoctor(props.client);
		return () => {
			const t = createAdminT(props.locale);
			return page(
				t('doctor.title'),
				{ isLoading: { value: isLoading.value && !report.value }, error },
				() => {
					const r = report.value;
					if (!r) return null;
					return table(
						[
							{ label: t('doctor.colResult'), style: { width: '110px' } },
							t('doctor.colCheck'),
							{ label: t('doctor.colTime'), style: { textAlign: 'right', width: '90px' } },
						],
						r.checks.map((c) =>
							h('tr', { key: c.name }, [
								td(
									pill(
										c.skipped ? 'neutral' : c.ok ? (c.findings.length ? 'warn' : 'ok') : 'bad',
										c.skipped
											? t('common.status.skipped')
											: c.ok
												? c.findings.length
													? t('common.status.advice')
													: t('common.status.ok')
												: t('common.status.failed'),
									),
								),
								td([
									h('div', [
										h('span', { style: { ...styles.mono, fontWeight: 600 } }, c.name),
										' ',
										h('span', { style: styles.muted }, c.module),
									]),
									c.skipped
										? h('div', { style: { ...styles.muted, marginTop: '4px' } }, c.skipped)
										: null,
									...c.findings.map((f) =>
										h(
											'div',
											{
												key: f,
												style: {
													marginTop: '4px',
													fontSize: '13px',
													lineHeight: 1.55,
													color: c.ok
														? 'var(--fonderie-text,#171717)'
														: 'var(--fonderie-danger,#e00)',
												},
											},
											f,
										),
									),
								]),
								td(`${c.durationMs} ms`, {
									...styles.muted,
									textAlign: 'right',
									whiteSpace: 'nowrap',
								}),
							]),
						),
					);
				},
				[
					report.value && !isLoading.value
						? pill(
								report.value.ok ? 'ok' : 'bad',
								report.value.ok ? t('doctor.allPass') : t('doctor.oneFailed'),
							)
						: null,
					refreshButton(
						t('doctor.runAgain'),
						isLoading.value,
						() => void refresh(),
						t('common.working'),
					),
				],
				{
					loadingText: t('doctor.running'),
					lead: t('doctor.lead'),
				},
			);
		};
	},
});
