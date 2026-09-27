import type { AdminClient } from '@fonderie/client';
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
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error, refresh } = useDoctor(props.client);
		return () =>
			page(
				'Doctor',
				{ isLoading: { value: isLoading.value && !report.value }, error },
				() => {
					const r = report.value;
					if (!r) return null;
					return table(
						[
							{ label: 'Result', style: { width: '110px' } },
							'Check',
							{ label: 'Time', style: { textAlign: 'right', width: '90px' } },
						],
						r.checks.map((c) =>
							h('tr', { key: c.name }, [
								td(
									pill(
										c.skipped ? 'neutral' : c.ok ? (c.findings.length ? 'warn' : 'ok') : 'bad',
										c.skipped ? 'skipped' : c.ok ? (c.findings.length ? 'advice' : 'ok') : 'failed',
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
								report.value.ok ? 'all checks pass' : 'a check failed',
							)
						: null,
					refreshButton('Run again', isLoading.value, () => void refresh()),
				],
				{
					loadingText: 'Running the checks…',
					lead: 'Every reconciliation check across the installed modules, run on demand.',
				},
			);
	},
});
