import type { AdminClient } from '@fonderie/client';
import { useDoctor } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page, refreshButton } from './common';

export const DoctorScreen = defineComponent({
	name: 'FonderieDoctorScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error, refresh } = useDoctor(props.client);
		return () =>
			page(
				'Doctor',
				{ isLoading, error },
				() => {
					const r = report.value;
					if (!r) return null;
					return h(
						'ul',
						{ style: styles.list },
						r.checks.map((c) =>
							h('li', { key: c.name, style: styles.row }, [
								h(
									'span',
									{ style: c.skipped ? styles.muted : c.ok ? styles.ok : styles.bad },
									c.skipped ? 'skipped' : c.ok ? 'ok' : 'failed',
								),
								' ',
								h('span', { style: styles.mono }, c.name),
								' ',
								h('span', { style: styles.muted }, `${c.module} · ${c.durationMs} ms`),
								c.skipped ? h('div', { style: styles.muted }, c.skipped) : null,
								...c.findings.map((f) =>
									h('div', { key: f, style: c.ok ? styles.advice : styles.bad }, f),
								),
							]),
						),
					);
				},
				[
					refreshButton('Run again', isLoading.value, () => void refresh()),
					report.value && !isLoading.value
						? h(
								'span',
								{ style: report.value.ok ? styles.ok : styles.bad },
								report.value.ok ? 'all checks pass' : 'a check failed',
							)
						: h('span'),
				],
				{ loadingText: 'Running the checks…' },
			);
	},
});
