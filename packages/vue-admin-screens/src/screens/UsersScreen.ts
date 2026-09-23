import type { AuthAdminClient } from '@fonderie/client';
import {
	useAdminLoginHistory,
	useAdminUser,
	useAdminUserSessions,
	useAdminUsers,
} from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { refreshButton, table, td } from './common';

// Who is signed up, and why can't this one log in. Lists on arrival — an
// operator who must know an address before they can see anything cannot find
// the account they are being asked about. Picking a row, or an exact email,
// opens the account: live sessions, recent sign-ins, suspend and sign-out.
export const UsersScreen = defineComponent({
	name: 'FonderieUsersScreen',
	props: {
		client: { type: Object as PropType<AuthAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
	},
	setup(props) {
		const input = ref('');
		const email = ref('');
		const selectedId = ref('');
		const list = useAdminUsers(props.client, { limit: props.pageSize });
		const { user, isLoading, error, suspend, unsuspend, revokeSessions } = useAdminUser(
			props.client,
			{ email, id: selectedId },
		);
		const userId = computed(() => user.value?.id ?? null);
		const sessions = useAdminUserSessions(props.client, userId);
		const history = useAdminLoginHistory(props.client, userId, { limit: 20 });
		const showList = computed(() => !email.value && !selectedId.value);
		const yesNo = (v: boolean) =>
			h('span', { style: v ? styles.ok : styles.muted }, v ? 'yes' : 'no');
		const row = (k: string, v: unknown) => h('tr', [td(k), td(v as never)]);
		const clear = () => {
			email.value = '';
			selectedId.value = '';
			input.value = '';
		};

		return () => {
			const u = user.value;
			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Users'),
				h(
					'form',
					{
						style: styles.toolbar,
						onSubmit: (e: Event) => {
							e.preventDefault();
							selectedId.value = '';
							email.value = input.value.trim();
						},
					},
					[
						h('input', {
							type: 'email',
							value: input.value,
							onInput: (e: Event) => (input.value = (e.target as HTMLInputElement).value),
							placeholder: 'email address',
							style: { ...styles.button, cursor: 'text', minWidth: '280px' },
							'aria-label': 'Email',
						}),
						h(
							'button',
							{ type: 'submit', style: styles.button, disabled: isLoading.value },
							'Look up',
						),
						showList.value
							? refreshButton('Refresh', list.isLoading.value, () => void list.refresh())
							: refreshButton('← All users', false, clear),
					],
				),
				showList.value
					? h('div', [
							list.error.value
								? h('p', { style: styles.error, role: 'alert' }, list.error.value.explanation)
								: null,
							list.users.value.length === 0 && !list.isLoading.value
								? h('p', { style: styles.muted }, 'No users yet.')
								: table(
										['Email', 'Name', 'Created', 'Status'],
										list.users.value.map((u) =>
											h('tr', { key: u.id }, [
												td(
													h(
														'button',
														{
															type: 'button',
															style: { ...styles.navItem, padding: 0 },
															onClick: () => (selectedId.value = u.id),
														},
														u.email,
													),
												),
												td(
													`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
														h('span', { style: styles.muted }, '—'),
												),
												td(new Date(u.createdAt).toLocaleDateString()),
												td(
													u.suspended
														? h('span', { style: styles.badge }, 'suspended')
														: u.deletedAt
															? h('span', { style: styles.badge }, 'deleted')
															: h('span', { style: styles.muted }, 'active'),
												),
											]),
										),
									),
							list.isLoading.value ? h('p', { style: styles.status }, 'Loading…') : null,
							list.hasMore.value && !list.isLoading.value
								? h(
										'button',
										{
											type: 'button',
											style: { ...styles.button, marginTop: '8px' },
											onClick: () => void list.loadMore(),
										},
										'Load more',
									)
								: null,
						])
					: null,
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 404 ? 'No user with that email.' : error.value.explanation,
						)
					: null,
				u
					? [
							h('h2', { style: styles.subtitle }, [
								u.firstName || u.lastName ? `${u.firstName} ${u.lastName}`.trim() : u.email,
								' ',
								u.suspended ? h('span', { style: styles.badge }, 'suspended') : null,
								u.deletedAt ? h('span', { style: styles.badge }, 'deleted') : null,
							]),
							h('table', { style: styles.table }, [
								h('tbody', [
									row('id', h('span', { style: styles.mono }, u.id)),
									row('email', [u.email, ' · verified ', yesNo(u.isEmailVerified)]),
									row('MFA', yesNo(u.mfaEnabled)),
									row(
										'provider',
										`${u.provider || 'password'}${u.hasPassword ? '' : ' · no password set'}`,
									),
									row(
										'last login',
										u.lastLogin
											? new Date(u.lastLogin).toLocaleString()
											: h('span', { style: styles.muted }, 'never'),
									),
									row('created', new Date(u.createdAt).toLocaleString()),
								]),
							]),
							h('div', { style: { ...styles.toolbar, marginTop: '12px' } }, [
								u.suspended
									? refreshButton('Unsuspend', isLoading.value, () => void unsuspend())
									: refreshButton('Suspend', isLoading.value, () => void suspend()),
								refreshButton(
									'Sign out everywhere',
									isLoading.value,
									() => void revokeSessions().then(() => sessions.refresh()),
								),
							]),
							h('h2', { style: styles.subtitle }, 'Live sessions'),
							sessions.sessions.value.length === 0
								? h('p', { style: styles.muted }, 'None.')
								: h(
										'ul',
										{ style: styles.list },
										sessions.sessions.value.map((s) =>
											h('li', { key: s.id, style: styles.row }, [
												h('span', { style: styles.mono }, s.ipAddress ?? '—'),
												' ',
												h('span', { style: styles.muted }, s.userAgent ?? ''),
												' ',
												h(
													'span',
													{ style: styles.muted },
													`since ${new Date(s.createdAt).toLocaleString()}`,
												),
											]),
										),
									),
							h('h2', { style: styles.subtitle }, 'Recent sign-ins'),
							history.events.value.length === 0 && !history.isLoading.value
								? h('p', { style: styles.muted }, 'None recorded.')
								: h(
										'ul',
										{ style: styles.list },
										history.events.value.map((e) =>
											h('li', { key: e.id, style: styles.row }, [
												h(
													'span',
													{ style: e.outcome === 'success' ? styles.ok : styles.bad },
													e.outcome,
												),
												' ',
												h('span', { style: styles.muted }, e.method),
												' ',
												h('span', { style: styles.muted }, new Date(e.createdAt).toLocaleString()),
											]),
										),
									),
							history.hasMore.value && !history.isLoading.value
								? h(
										'button',
										{
											type: 'button',
											style: { ...styles.button, marginTop: '8px' },
											onClick: () => void history.loadMore(),
										},
										'Load more',
									)
								: null,
						]
					: null,
			]);
		};
	},
});
