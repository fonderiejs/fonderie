import type {
	AdminLocale,
	AdminMessageKey,
	AdminMessageParams,
	CourierAdminClient,
	ITemplateEntry,
} from '@fonderie/client';
import { createAdminT, groupTemplatesByType } from '@fonderie/client';
import type { ITemplateGroup } from '@fonderie/client';
import { useTemplates } from '@fonderie/vue-courier-admin';
import type { CSSProperties, PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';

const builtIn: CSSProperties = {
	fontSize: '11px',
	fontWeight: 500,
	padding: '1px 7px',
	borderRadius: '999px',
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
};
// One per locale the email exists in. Monospace: they are language tags.
const chip: CSSProperties = {
	height: '24px',
	boxSizing: 'border-box',
	padding: '0 8px',
	borderRadius: '6px',
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	background: 'var(--fonderie-surface,#fff)',
	color: 'var(--fonderie-text,#171717)',
	fontSize: '12px',
	fontFamily:
		'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	cursor: 'pointer',
};
const chipInactive: CSSProperties = { ...chip, opacity: 0.5, textDecoration: 'line-through' };
const row: CSSProperties = {
	...styles.row,
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	paddingRight: '16px',
};
const rowButton: CSSProperties = { ...styles.rowButton, width: 'auto', flex: '1', minWidth: '0' };
const chips: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	justifyContent: 'flex-end',
	gap: '6px',
};
const newButton: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	height: '32px',
	boxSizing: 'border-box',
	borderRadius: '6px',
	padding: '0 12px',
	fontSize: '13px',
	fontWeight: 500,
	fontFamily: 'inherit',
	cursor: 'pointer',
	backgroundColor: 'var(--fonderie-text,#171717)',
	color: 'var(--fonderie-surface,#fff)',
	border: '1px solid var(--fonderie-text,#171717)',
};

export const TemplateListScreen = defineComponent({
	name: 'FonderieTemplateListScreen',
	props: {
		client: { type: Object as PropType<CourierAdminClient>, required: true },
		/** Shows a "New template" button (emits create-template). */
		allowCreate: { type: Boolean, default: false },
		/** The console language; defaults to English. */
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	emits: {
		/**
		 * The whole row — type AND locale, and whether it is built-in. One row
		 * per email: the row opens the default locale, a locale chip that locale.
		 */
		'select-template': (_template: ITemplateEntry) => true,
		/** Receives the locales in use, to suggest. */
		'create-template': (_context: { locales: string[] }) => true,
	},
	setup(props, { emit }) {
		const { templates, isLoading, error } = useTemplates(props.client);
		const t = (key: AdminMessageKey, params?: AdminMessageParams) =>
			createAdminT(props.locale)(key, params);

		function renderRow(group: ITemplateGroup) {
			const primary: ITemplateEntry = group.primary;
			return h('li', { key: group.type, style: row }, [
				h(
					'button',
					{
						type: 'button',
						style: rowButton,
						onClick: () => emit('select-template', primary),
					},
					[
						h('span', { style: styles.type }, group.type),
						group.system ? h('span', { style: builtIn }, t('templates.builtInBadge')) : null,
						h('span', { style: primary.active ? styles.active : styles.inactive }, [
							h('span', { style: styles.dot }),
							primary.active ? t('common.status.active') : t('common.status.inactive'),
						]),
					],
				),
				// Siblings of the row button, not inside it: a button cannot hold buttons.
				h(
					'span',
					{ style: chips },
					group.entries.map((entry) => {
						const name = entry.locale ?? t('templates.defaultChip');
						return h(
							'button',
							{
								key: entry.locale ?? '',
								type: 'button',
								style: entry.active ? chip : chipInactive,
								'aria-label': t('templates.list.openLocale', { type: group.type, locale: name }),
								title: entry.active ? undefined : t('common.status.inactive'),
								onClick: () => emit('select-template', entry),
							},
							name,
						);
					}),
				),
			]);
		}

		return () =>
			h('div', { style: styles.listContainer }, [
				h(
					'div',
					{
						style: {
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: '16px',
						},
					},
					[
						h('h1', { style: styles.listTitle }, t('templates.list.title')),
						props.allowCreate
							? h(
									'button',
									{
										type: 'button',
										style: newButton,
										onClick: () =>
											emit('create-template', {
												locales: [
													...new Set(
														templates.value
															.map((tpl) => tpl.locale)
															.filter((l): l is string => !!l),
													),
												],
											}),
									},
									t('templates.list.newTemplate'),
								)
							: null,
					],
				),
				h('p', { style: styles.hint }, t('templates.list.hint')),
				isLoading.value
					? h('p', { style: styles.status }, t('templates.list.loading'))
					: error.value
						? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
						: h('ul', { style: styles.list }, groupTemplatesByType(templates.value).map(renderRow)),
			]);
	},
});
