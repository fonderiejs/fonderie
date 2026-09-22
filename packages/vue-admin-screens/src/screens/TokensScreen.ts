import type { AdminClient, AdminScope } from '@fonderie/client';
import { useAdminTokens } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { table, td } from './common';

const ALL: AdminScope[] = ['read', 'write', 'secrets'];

// Who can be here. Issuing and revoking need the ROOT token — the one in the
// deployment's config; a scoped token gets 401 on these and the page says so.
export const TokensScreen = defineComponent({
	name: 'FonderieTokensScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error, issue, revoke } = useAdminTokens(props.client);
		const name = ref('');
		const scopes = ref<AdminScope[]>(['read']);
		const days = ref('');
		const minted = ref<{ name: string; token: string } | null>(null);
		const toggle = (s: AdminScope) =>
			(scopes.value = scopes.value.includes(s)
				? scopes.value.filter((x) => x !== s)
				: [...scopes.value, s]);

		return () => {
			const r = report.value;
			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Access'),
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 401
								? 'Issuing and revoking need the root token (the one in your deployment config).'
								: error.value.explanation,
						)
					: null,
				h('h2', { style: styles.subtitle }, 'Root token'),
				r
					? h('p', [
							h(
								'span',
								{ style: r.admin.ok ? styles.ok : styles.bad },
								r.admin.ok ? 'strong' : 'weak',
							),
							...r.admin.problems.map((p) =>
								h('div', { key: p.message, style: styles.bad }, p.message),
							),
						])
					: null,
				h('h2', { style: styles.subtitle }, 'Issued tokens'),
				r?.issued === null
					? h(
							'p',
							{ style: styles.muted },
							'Issuing is off — give AdminModule a store and run its migrations.',
						)
					: [
							minted.value
								? h('p', { style: styles.ok }, [
										'Copy this now — it is never shown again. ',
										h('span', { style: styles.mono }, minted.value.token),
										` (${minted.value.name})`,
									])
								: null,
							h(
								'form',
								{
									style: styles.toolbar,
									onSubmit: (e: Event) => {
										e.preventDefault();
										const d = Number(days.value);
										void issue({
											name: name.value.trim(),
											scopes: scopes.value,
											...(days.value && Number.isInteger(d) && d > 0 ? { expiresInDays: d } : {}),
										})
											.then((t) => {
												minted.value = { name: t.name, token: t.token };
												name.value = '';
												days.value = '';
											})
											.catch(() => {});
									},
								},
								[
									h('input', {
										value: name.value,
										onInput: (e: Event) => (name.value = (e.target as HTMLInputElement).value),
										placeholder: 'name',
										style: { ...styles.button, cursor: 'text' },
										'aria-label': 'Name',
									}),
									...ALL.map((s) =>
										h('label', { key: s, style: { ...styles.badge, cursor: 'pointer' } }, [
											h('input', {
												type: 'checkbox',
												checked: scopes.value.includes(s),
												onChange: () => toggle(s),
											}),
											` ${s}`,
										]),
									),
									h('input', {
										value: days.value,
										onInput: (e: Event) => (days.value = (e.target as HTMLInputElement).value),
										placeholder: 'days (optional)',
										style: { ...styles.button, cursor: 'text', width: '140px' },
										'aria-label': 'Days',
									}),
									h(
										'button',
										{
											type: 'submit',
											style: styles.button,
											disabled: !name.value.trim() || scopes.value.length === 0 || isLoading.value,
										},
										'Issue',
									),
								],
							),
							r?.issued && r.issued.length > 0
								? table(
										['Name', 'Scopes', 'Created', 'Expires', 'Last used', ''],
										r.issued.map((t) =>
											h('tr', { key: t.id }, [
												td([
													t.name,
													t.revokedAt ? h('span', { style: styles.badge }, ' revoked') : '',
												]),
												td(t.scopes.join(', '), styles.mono),
												td(
													`${new Date(t.createdAt).toLocaleDateString()} · ${t.createdBy}`,
													styles.muted,
												),
												td(
													t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'never',
													styles.muted,
												),
												td(
													t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : 'never',
													styles.muted,
												),
												td(
													t.revokedAt
														? ''
														: h(
																'button',
																{
																	type: 'button',
																	style: styles.button,
																	onClick: () => {
																		if (
																			window.confirm(
																				`Revoke "${t.name}"? Anything using it stops working immediately.`,
																			)
																		)
																			void revoke(t.id).catch(() => {});
																	},
																},
																'Revoke',
															),
												),
											]),
										),
									)
								: h('p', { style: styles.muted }, 'None issued.'),
						],
				h('h2', { style: styles.subtitle }, 'Legacy per-brick tokens'),
				r && r.legacy.length === 0
					? h(
							'p',
							{ style: styles.muted },
							"None — every brick's admin surface goes through this token.",
						)
					: h(
							'ul',
							{ style: styles.list },
							(r?.legacy ?? []).map((l) =>
								h('li', { key: l.module, style: styles.row }, [
									h('span', { style: styles.mono }, l.module),
									' ',
									h(
										'span',
										{ style: styles.muted },
										'still registers its standalone routes with its own token (deprecated)',
									),
								]),
							),
						),
			]);
		};
	},
});
