import {
	type AdminClient,
	type AdminLocale,
	type AdminScope,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminTokens } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { empty, icon, pageHeader, pill } from '../ui';
import { table, td } from './common';

const ALL: AdminScope[] = ['read', 'write', 'secrets'];

// Who can be here. Issuing and revoking need the ROOT token — the one in the
// deployment's config; a scoped token gets 401 on these and the page says so.
export const TokensScreen = defineComponent({
	name: 'FonderieTokensScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
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
			const t = createAdminT(props.locale);
			const loc = props.locale;
			const r = report.value;
			return h('div', { style: styles.container }, [
				pageHeader(t('tokens.title'), t('tokens.lead')),
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 401 ? t('tokens.needsRoot') : error.value.explanation,
						)
					: null,
				h('h2', { style: { ...styles.subtitle, marginTop: 0 } }, t('tokens.rootToken')),
				r
					? h(
							'div',
							{ style: { ...styles.card, display: 'flex', gap: '12px', alignItems: 'flex-start' } },
							[
								icon('lock', 18, { marginTop: '2px' }),
								h('div', [
									pill(
										r.admin.ok ? 'ok' : 'bad',
										r.admin.ok ? t('tokens.strong') : t('tokens.weak'),
									),
									...r.admin.problems.map((p) =>
										h(
											'div',
											{
												key: p.message,
												style: {
													marginTop: '6px',
													color: 'var(--fonderie-danger,#e00)',
													fontSize: '13px',
												},
											},
											p.message,
										),
									),
								]),
							],
						)
					: null,
				h('h2', { style: styles.subtitle }, t('tokens.issuedTokens')),
				r?.issued === null
					? h('p', { style: styles.muted }, t('tokens.issuingOff'))
					: [
							minted.value
								? h(
										'div',
										{
											style: {
												...styles.notice,
												background:
													'color-mix(in srgb, var(--fonderie-accent,#00d294) 10%, transparent)',
												borderColor:
													'color-mix(in srgb, var(--fonderie-accent,#00d294) 35%, transparent)',
											},
										},
										[
											h('strong', t('tokens.copyNow')),
											` (${minted.value.name})`,
											h(
												'div',
												{
													style: {
														...styles.code,
														display: 'block',
														marginTop: '8px',
														padding: '8px 10px',
														wordBreak: 'break-all',
													},
												},
												minted.value.token,
											),
										],
									)
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
											.then((tk) => {
												minted.value = { name: tk.name, token: tk.token };
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
										placeholder: t('tokens.namePlaceholder'),
										style: styles.input,
										'aria-label': t('tokens.nameLabel'),
									}),
									...ALL.map((s) =>
										h(
											'label',
											{
												key: s,
												style: {
													...styles.badge,
													cursor: 'pointer',
													height: '32px',
													boxSizing: 'border-box',
													padding: '0 10px',
													fontSize: '13px',
												},
											},
											[
												h('input', {
													type: 'checkbox',
													checked: scopes.value.includes(s),
													onChange: () => toggle(s),
												}),
												` ${t(`tokens.scope.${s}`)}`,
											],
										),
									),
									h('input', {
										value: days.value,
										onInput: (e: Event) => (days.value = (e.target as HTMLInputElement).value),
										placeholder: t('tokens.daysPlaceholder'),
										style: { ...styles.input, width: '140px' },
										'aria-label': t('tokens.daysLabel'),
									}),
									h(
										'button',
										{
											type: 'submit',
											style: styles.buttonPrimary,
											disabled: !name.value.trim() || scopes.value.length === 0 || isLoading.value,
										},
										[icon('plus', 14), t('tokens.issue')],
									),
								],
							),
							r?.issued && r.issued.length > 0
								? table(
										[
											t('tokens.col.name'),
											t('tokens.col.scopes'),
											t('tokens.col.created'),
											t('tokens.col.expires'),
											t('tokens.col.lastUsed'),
											'',
										],
										r.issued.map((tk) =>
											h('tr', { key: tk.id }, [
												td([
													tk.name,
													tk.revokedAt ? [' ', pill('neutral', t('tokens.revoked'))] : '',
												]),
												td(tk.scopes.map((sc) => t(`tokens.scope.${sc}`)).join(', '), styles.mono),
												td(
													`${formatAdminDate(tk.createdAt, loc, 'date')} · ${tk.createdBy}`,
													styles.muted,
												),
												td(
													tk.expiresAt
														? formatAdminDate(tk.expiresAt, loc, 'date')
														: t('common.never'),
													styles.muted,
												),
												td(
													tk.lastUsedAt ? formatAdminDate(tk.lastUsedAt, loc) : t('common.never'),
													styles.muted,
												),
												td(
													tk.revokedAt
														? ''
														: h(
																'button',
																{
																	type: 'button',
																	style: styles.buttonDanger,
																	onClick: () => {
																		if (
																			window.confirm(t('tokens.revokeConfirm', { name: tk.name }))
																		)
																			void revoke(tk.id).catch(() => {});
																	},
																},
																t('tokens.revoke'),
															),
												),
											]),
										),
									)
								: empty(t('tokens.emptyTitle'), t('tokens.emptyBody'), 'tokens'),
						],
				h('h2', { style: styles.subtitle }, t('tokens.legacyTitle')),
				r && r.legacy.length === 0
					? h('p', { style: styles.muted }, t('tokens.legacyNone'))
					: h(
							'ul',
							{ style: styles.list },
							(r?.legacy ?? []).map((l) =>
								h('li', { key: l.module, style: styles.row }, [
									h('span', { style: styles.mono }, l.module),
									' ',
									h('span', { style: styles.muted }, t('tokens.legacyRow')),
								]),
							),
						),
			]);
		};
	},
});
