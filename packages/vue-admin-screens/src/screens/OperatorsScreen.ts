import {
	type AdminClient,
	type AdminLocale,
	type AdminScope,
	type AdminT,
	createAdminT,
	formatAdminDate,
	type IAdminCreatedLink,
	type IAdminOperator,
} from '@fonderie/client';
import { useAdminOperators } from '@fonderie/vue-admin';
import type { PropType, VNode } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { empty, icon, pageHeader, pill } from '../ui';
import { table, td } from './common';

// Access levels as people think of them; scopes underneath.
type LevelId = 'read' | 'editor' | 'owner';
const LEVELS: Array<{ id: LevelId; scopes: AdminScope[] }> = [
	{ id: 'read', scopes: ['read'] },
	{ id: 'editor', scopes: ['read', 'write'] },
	{ id: 'owner', scopes: ['read', 'write', 'secrets'] },
];
const levelOf = (scopes: readonly AdminScope[]): LevelId =>
	scopes.includes('secrets') ? 'owner' : scopes.includes('write') ? 'editor' : 'read';
const scopesFor = (id: string): AdminScope[] => LEVELS.find((l) => l.id === id)?.scopes ?? ['read'];

const small = { height: '28px' };

// The people who can sign in here. No registration: an owner invites, the
// invitee sets a password and an authenticator. Lost device or password → a
// recovery link from another owner.
export const OperatorsScreen = defineComponent({
	name: 'FonderieOperatorsScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		// The signed-in operator's email: their own row offers no disable or
		// recovery (the server refuses both for yourself anyway).
		me: { type: String, default: undefined },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { report, isLoading, error, invite, recover, update, revokeLink } = useAdminOperators(
			props.client,
		);
		const email = ref('');
		const level = ref<string>('editor');
		const minted = ref<IAdminCreatedLink | null>(null);
		const copied = ref(false);

		const status = (t: AdminT, o: IAdminOperator): VNode =>
			o.disabledAt
				? pill('neutral', t('common.status.disabled'))
				: o.locked
					? pill('warn', t('common.status.locked'))
					: !o.enrolled
						? pill('warn', t('operators.settingUp'))
						: pill('ok', t('common.status.active'));

		const mintedNotice = (t: AdminT, link: IAdminCreatedLink): VNode => {
			const url = `${window.location.origin}${link.url}`;
			return h(
				'div',
				{
					style: {
						...styles.notice,
						background: 'color-mix(in srgb, var(--fonderie-accent,#00d294) 10%, transparent)',
						borderColor: 'color-mix(in srgb, var(--fonderie-accent,#00d294) 35%, transparent)',
					},
				},
				[
					h('strong', t('operators.mintedTitle', { email: link.email })),
					` ${t('operators.mintedBody', { date: formatAdminDate(link.expiresAt, props.locale) })}`,
					h(
						'div',
						{ style: { display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' } },
						[
							h(
								'code',
								{ style: { ...styles.code, flex: 1, padding: '7px 10px', wordBreak: 'break-all' } },
								url,
							),
							h(
								'button',
								{
									type: 'button',
									style: styles.button,
									onClick: () => {
										void navigator.clipboard?.writeText(url);
										copied.value = true;
									},
								},
								copied.value ? t('common.copied') : t('common.copy'),
							),
							h(
								'button',
								{
									type: 'button',
									style: styles.buttonGhost,
									'aria-label': t('common.dismiss'),
									onClick: () => {
										minted.value = null;
										copied.value = false;
									},
								},
								[icon('close', 14)],
							),
						],
					),
				],
			);
		};

		const setMinted = (l: IAdminCreatedLink) => {
			copied.value = false;
			minted.value = l;
		};

		return () => {
			const t = createAdminT(props.locale);
			const r = report.value;
			const e = error.value;
			return h('div', { style: styles.container }, [
				pageHeader(t('operators.title'), t('operators.lead')),
				e
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							e.status === 403 && e.reason === 'FORBIDDEN'
								? t('operators.needsOwner')
								: e.explanation,
						)
					: null,
				minted.value ? mintedNotice(t, minted.value) : null,
				h(
					'form',
					{
						style: {
							...styles.card,
							display: 'flex',
							gap: '8px',
							alignItems: 'center',
							flexWrap: 'wrap',
							marginBottom: '20px',
						},
						onSubmit: (ev: Event) => {
							ev.preventDefault();
							void invite({ email: email.value.trim(), scopes: scopesFor(level.value) })
								.then((l) => {
									setMinted(l);
									email.value = '';
								})
								.catch(() => {});
						},
					},
					[
						icon('users', 16),
						h(
							'strong',
							{ style: { fontSize: '13.5px', marginRight: '4px' } },
							t('operators.invite'),
						),
						h('input', {
							type: 'email',
							required: true,
							value: email.value,
							onInput: (ev: Event) => (email.value = (ev.target as HTMLInputElement).value),
							placeholder: t('operators.invitePlaceholder'),
							style: { ...styles.input, flex: 1, minWidth: '220px' },
							'aria-label': t('operators.inviteLabel'),
						}),
						h(
							'select',
							{
								value: level.value,
								onChange: (ev: Event) => (level.value = (ev.target as HTMLSelectElement).value),
								style: styles.input,
								'aria-label': t('operators.accessLevelLabel'),
							},
							LEVELS.map((l) =>
								h(
									'option',
									{ key: l.id, value: l.id },
									`${t(`operators.level.${l.id}`)} — ${t(`operators.levelHint.${l.id}`)}`,
								),
							),
						),
						h(
							'button',
							{ type: 'submit', style: styles.buttonPrimary, disabled: !email.value.trim() },
							[icon('plus', 14), t('operators.createInvite')],
						),
					],
				),
				isLoading.value && !r
					? h('p', { style: styles.status }, t('common.loading'))
					: r && r.operators.length === 0
						? empty(t('operators.emptyTitle'), undefined, 'users')
						: r
							? table(
									[
										t('operators.col.operator'),
										t('operators.col.access'),
										t('operators.col.status'),
										t('operators.col.lastSignIn'),
										'',
									],
									r.operators.map((o) => {
										const mine = o.email === props.me;
										return h('tr', { key: o.id }, [
											td([
												h('div', { style: { fontWeight: 600 } }, o.name || o.email),
												o.name ? h('div', { style: styles.muted }, o.email) : null,
											]),
											td(
												h(
													'select',
													{
														value: levelOf(o.scopes),
														disabled: mine,
														onChange: (ev: Event) =>
															void update(o.id, {
																scopes: scopesFor((ev.target as HTMLSelectElement).value),
															}).catch(() => {}),
														style: { ...styles.input, ...small, fontSize: '12.5px' },
														'aria-label': t('operators.accessLevelFor', { email: o.email }),
													},
													LEVELS.map((l) =>
														h('option', { key: l.id, value: l.id }, t(`operators.level.${l.id}`)),
													),
												),
											),
											td([
												status(t, o),
												o.enrolled && o.backupCodesLeft <= 2 && !o.disabledAt
													? h(
															'div',
															{ style: { ...styles.muted, marginTop: '4px' } },
															t(
																o.backupCodesLeft === 1
																	? 'operators.backupCodesLeftOne'
																	: 'operators.backupCodesLeftMany',
																{ n: o.backupCodesLeft },
															),
														)
													: null,
											]),
											td(
												o.lastLoginAt
													? formatAdminDate(o.lastLoginAt, props.locale)
													: t('common.never'),
												{
													...styles.muted,
													whiteSpace: 'nowrap',
												},
											),
											td(
												mine
													? h('span', { style: styles.muted }, t('common.you'))
													: [
															h(
																'button',
																{
																	type: 'button',
																	style: { ...styles.button, ...small, marginRight: '6px' },
																	onClick: () => {
																		if (
																			window.confirm(
																				t('operators.recoveryConfirm', { email: o.email }),
																			)
																		)
																			void recover(o.id)
																				.then(setMinted)
																				.catch(() => {});
																	},
																},
																t('operators.recoveryLink'),
															),
															h(
																'button',
																{
																	type: 'button',
																	style: {
																		...(o.disabledAt ? styles.button : styles.buttonDanger),
																		...small,
																	},
																	onClick: () => {
																		if (
																			o.disabledAt ||
																			window.confirm(
																				t('operators.disableConfirm', { email: o.email }),
																			)
																		)
																			void update(o.id, { disabled: !o.disabledAt }).catch(
																				() => {},
																			);
																	},
																},
																o.disabledAt ? t('operators.enable') : t('operators.disable'),
															),
														],
												{ textAlign: 'right', whiteSpace: 'nowrap' },
											),
										]);
									}),
								)
							: null,
				r && r.links.length > 0
					? [
							h('h2', { style: styles.subtitle }, t('operators.pendingLinks')),
							h(
								'ul',
								{ style: styles.list },
								r.links.map((l) =>
									h(
										'li',
										{
											key: l.id,
											style: { ...styles.row, display: 'flex', gap: '12px', alignItems: 'center' },
										},
										[
											pill(
												l.kind === 'invite' ? 'info' : 'warn',
												l.kind === 'invite'
													? t('operators.linkKind.invite')
													: t('operators.linkKind.recovery'),
												false,
											),
											h('span', { style: { flex: 1 } }, [
												l.email,
												l.kind === 'invite'
													? h(
															'span',
															{ style: styles.muted },
															` · ${t(`operators.level.${levelOf(l.scopes)}`)}`,
														)
													: null,
											]),
											h(
												'span',
												{ style: styles.muted },
												t('operators.expiresOn', {
													date: formatAdminDate(l.expiresAt, props.locale),
												}),
											),
											h(
												'button',
												{
													type: 'button',
													style: { ...styles.buttonDanger, ...small },
													onClick: () => void revokeLink(l.id).catch(() => {}),
												},
												t('operators.revoke'),
											),
										],
									),
								),
							),
						]
					: null,
			]);
		};
	},
});
