import type { AdminClient, AdminScope, IAdminCreatedLink, IAdminOperator } from '@fonderie/client';
import { useAdminOperators } from '@fonderie/vue-admin';
import type { PropType, VNode } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { empty, icon, pageHeader, pill } from '../ui';
import { table, td } from './common';

// Access levels as people think of them; scopes underneath.
const LEVELS: Array<{ label: string; scopes: AdminScope[]; hint: string }> = [
	{ label: 'Read only', scopes: ['read'], hint: 'look around, change nothing' },
	{ label: 'Editor', scopes: ['read', 'write'], hint: 'change config, templates, users' },
	{
		label: 'Owner',
		scopes: ['read', 'write', 'secrets'],
		hint: 'secrets, tokens and operators too',
	},
];
const levelOf = (scopes: readonly AdminScope[]) =>
	scopes.includes('secrets') ? 'Owner' : scopes.includes('write') ? 'Editor' : 'Read only';
const scopesFor = (label: string): AdminScope[] =>
	LEVELS.find((l) => l.label === label)?.scopes ?? ['read'];

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
	},
	setup(props) {
		const { report, isLoading, error, invite, recover, update, revokeLink } = useAdminOperators(
			props.client,
		);
		const email = ref('');
		const level = ref('Editor');
		const minted = ref<IAdminCreatedLink | null>(null);
		const copied = ref(false);

		const status = (o: IAdminOperator): VNode =>
			o.disabledAt
				? pill('neutral', 'disabled')
				: o.locked
					? pill('warn', 'locked')
					: !o.enrolled
						? pill('warn', 'setting up')
						: pill('ok', 'active');

		const mintedNotice = (link: IAdminCreatedLink): VNode => {
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
					h('strong', `Send this link to ${link.email}. It is shown once.`),
					` It works once and expires ${new Date(link.expiresAt).toLocaleString()}.`,
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
								copied.value ? 'Copied' : 'Copy',
							),
							h(
								'button',
								{
									type: 'button',
									style: styles.buttonGhost,
									'aria-label': 'Dismiss',
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
			const r = report.value;
			const e = error.value;
			return h('div', { style: styles.container }, [
				pageHeader(
					'Operators',
					'The people who can sign in to this console. Each one uses a password and an authenticator app; there is no sign-up.',
				),
				e
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							e.status === 403 && e.reason === 'FORBIDDEN'
								? 'Managing operators needs the Owner level.'
								: e.explanation,
						)
					: null,
				minted.value ? mintedNotice(minted.value) : null,
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
						h('strong', { style: { fontSize: '13.5px', marginRight: '4px' } }, 'Invite'),
						h('input', {
							type: 'email',
							required: true,
							value: email.value,
							onInput: (ev: Event) => (email.value = (ev.target as HTMLInputElement).value),
							placeholder: 'teammate@company.com',
							style: { ...styles.input, flex: 1, minWidth: '220px' },
							'aria-label': 'Email to invite',
						}),
						h(
							'select',
							{
								value: level.value,
								onChange: (ev: Event) => (level.value = (ev.target as HTMLSelectElement).value),
								style: styles.input,
								'aria-label': 'Access level',
							},
							LEVELS.map((l) =>
								h('option', { key: l.label, value: l.label }, `${l.label} — ${l.hint}`),
							),
						),
						h(
							'button',
							{ type: 'submit', style: styles.buttonPrimary, disabled: !email.value.trim() },
							[icon('plus', 14), 'Create invite link'],
						),
					],
				),
				isLoading.value && !r
					? h('p', { style: styles.status }, 'Loading…')
					: r && r.operators.length === 0
						? empty('No operators yet', undefined, 'users')
						: r
							? table(
									['Operator', 'Access', 'Status', 'Last sign-in', ''],
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
														'aria-label': `Access level for ${o.email}`,
													},
													LEVELS.map((l) => h('option', { key: l.label, value: l.label }, l.label)),
												),
											),
											td([
												status(o),
												o.enrolled && o.backupCodesLeft <= 2 && !o.disabledAt
													? h(
															'div',
															{ style: { ...styles.muted, marginTop: '4px' } },
															`${o.backupCodesLeft} backup code(s) left`,
														)
													: null,
											]),
											td(o.lastLoginAt ? new Date(o.lastLoginAt).toLocaleString() : 'never', {
												...styles.muted,
												whiteSpace: 'nowrap',
											}),
											td(
												mine
													? h('span', { style: styles.muted }, 'you')
													: [
															h(
																'button',
																{
																	type: 'button',
																	style: { ...styles.button, ...small, marginRight: '6px' },
																	onClick: () => {
																		if (
																			window.confirm(
																				`Create a recovery link for ${o.email}? It signs them out everywhere; the link sets a new password and a new authenticator.`,
																			)
																		)
																			void recover(o.id)
																				.then(setMinted)
																				.catch(() => {});
																	},
																},
																'Recovery link',
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
																				`Disable ${o.email}? They are signed out immediately.`,
																			)
																		)
																			void update(o.id, { disabled: !o.disabledAt }).catch(
																				() => {},
																			);
																	},
																},
																o.disabledAt ? 'Enable' : 'Disable',
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
							h('h2', { style: styles.subtitle }, 'Pending links'),
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
											pill(l.kind === 'invite' ? 'info' : 'warn', l.kind, false),
											h('span', { style: { flex: 1 } }, [
												l.email,
												l.kind === 'invite'
													? h('span', { style: styles.muted }, ` · ${levelOf(l.scopes)}`)
													: null,
											]),
											h(
												'span',
												{ style: styles.muted },
												`expires ${new Date(l.expiresAt).toLocaleString()}`,
											),
											h(
												'button',
												{
													type: 'button',
													style: { ...styles.buttonDanger, ...small },
													onClick: () => void revokeLink(l.id).catch(() => {}),
												},
												'Revoke',
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
