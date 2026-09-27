import type {
	AdminLocale,
	AdminMessageKey,
	AdminMessageParams,
	CourierAdminClient,
	ITemplateCatalogEntry,
	ITemplateLanguage,
} from '@fonderie/client';
import { createAdminT, templateLanguages } from '@fonderie/client';
import { useTemplateCatalog } from '@fonderie/vue-courier-admin';
import type { CSSProperties, PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';

/** Which version of which email to open. `locale` null is the default version. */
export interface ITemplateSelection {
	type: string;
	locale: string | null;
	/** A built-in email: its default version can be edited, never deleted. */
	system: boolean;
}

const MONO =
	'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)';

const builtIn: CSSProperties = {
	fontSize: '11px',
	fontWeight: 500,
	padding: '1px 7px',
	borderRadius: '999px',
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
	flexShrink: 0,
};
// One per language the email exists in. Monospace: they are language tags.
// Solid = a version the app saved; dashed = Fonderie's built-in copy, untouched.
const chip: CSSProperties = {
	height: '24px',
	boxSizing: 'border-box',
	padding: '0 8px',
	borderRadius: '6px',
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	background: 'var(--fonderie-surface,#fff)',
	color: 'var(--fonderie-text,#171717)',
	fontSize: '12px',
	fontFamily: MONO,
	cursor: 'pointer',
};
const chipBuiltIn: CSSProperties = {
	borderStyle: 'dashed',
	background: 'transparent',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
};
const chipOff: CSSProperties = { opacity: 0.5, textDecoration: 'line-through' };
// name + badge | languages | status — fixed tracks so every column aligns.
const row: CSSProperties = {
	...styles.row,
	display: 'grid',
	gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 280px) 88px',
	alignItems: 'center',
	gap: '16px',
	paddingRight: '16px',
};
const rowButton: CSSProperties = {
	...styles.rowButton,
	width: 'auto',
	minWidth: '0',
	justifyContent: 'flex-start',
	gap: '12px',
};
const typeName: CSSProperties = {
	...styles.type,
	flex: 'none',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
};
const chips: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px' };
const legend: CSSProperties = {
	fontSize: '12.5px',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
	margin: '10px 2px 0',
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
		 * One row per email — built-in ones included, even when nobody saved a
		 * copy. The row opens the default version; a language chip that language.
		 */
		'select-template': (_template: ITemplateSelection) => true,
		/** Receives the locales in use, to suggest. */
		'create-template': (_context: { locales: string[] }) => true,
	},
	setup(props, { emit }) {
		const { catalog, isLoading, error } = useTemplateCatalog(props.client);
		const t = (key: AdminMessageKey, params?: AdminMessageParams) =>
			createAdminT(props.locale)(key, params);
		const defaultLocale = () => catalog.value?.defaultLocale ?? 'en-US';

		function renderRow(email: ITemplateCatalogEntry) {
			const languages = templateLanguages(email, defaultLocale());
			const primary = languages.find((l) => l.locale === null) ?? languages[0];
			const open = (l: ITemplateLanguage | undefined) =>
				emit('select-template', {
					type: email.type,
					locale: l?.locale ?? null,
					system: email.system,
				});
			return h('li', { key: email.type, style: row }, [
				h('button', { type: 'button', style: rowButton, onClick: () => open(primary) }, [
					h('span', { style: typeName }, email.type),
					email.system ? h('span', { style: builtIn }, t('templates.builtInBadge')) : null,
				]),
				// Siblings of the row button: a button cannot hold buttons. Each chip
				// names its email and language for screen readers.
				h(
					'span',
					{ style: chips },
					languages.map((l) =>
						h(
							'button',
							{
								key: l.label,
								type: 'button',
								style: { ...chip, ...(l.saved ? {} : chipBuiltIn), ...(l.active ? {} : chipOff) },
								'aria-label': t('templates.list.openLocale', { type: email.type, locale: l.label }),
								title: l.active ? undefined : t('common.status.inactive'),
								onClick: () => open(l),
							},
							l.label,
						),
					),
				),
				h('span', { style: primary?.active === false ? styles.inactive : styles.active }, [
					h('span', { style: styles.dot }),
					primary?.active === false ? t('common.status.inactive') : t('common.status.active'),
				]),
			]);
		}

		return () => {
			const emails = catalog.value?.emails ?? [];
			return h('div', { style: styles.listContainer }, [
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
														emails.flatMap((e) =>
															templateLanguages(e, defaultLocale())
																.filter((l) => l.locale !== null)
																.map((l) => l.label),
														),
													),
												].sort(),
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
						: [
								h('ul', { style: styles.list }, emails.map(renderRow)),
								h('p', { style: legend }, t('templates.list.legend')),
							],
			]);
		};
	},
});
