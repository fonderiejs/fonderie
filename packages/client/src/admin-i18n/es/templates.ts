import type en from '../en/templates';

const templates: typeof en = {
	defaultLocale: 'idioma predeterminado',
	defaultChip: 'predeterminado',
	builtInBadge: 'integrado',
	subject: 'Asunto',
	htmlBody: 'Cuerpo HTML',
	textBody: 'Cuerpo en texto plano',
	list: {
		title: 'Plantillas',
		newTemplate: 'Nueva plantilla',
		hint: 'Cada correo que envía la aplicación. Abre uno para editar su contenido y ver la vista previa en directo.',
		loading: 'Cargando plantillas…',
		openLocale: 'Abrir la versión {locale} de {type}',
	},
	editor: {
		loading: 'Cargando plantilla…',
		locales: 'Idiomas',
		discardChanges: 'Este idioma tiene cambios sin guardar. ¿Descartarlos y cambiar de idioma?',
		addLocale: '+ Añadir idioma',
		builtInNote: 'correo integrado: se puede editar o restaurar, no eliminar',
		active: 'Activa',
		conflict:
			'Alguien cambió esta plantilla desde que la abriste. Recarga para ver su cambio y vuelve a editarla.',
		noChanges: 'No hay cambios que guardar',
		sampleData: 'Datos de ejemplo',
		sampleNotObject: 'Los datos de ejemplo deben ser un objeto JSON.',
		sampleInvalid: 'Los datos de ejemplo no son un JSON válido.',
		preview: 'Vista previa',
		previewTitle: 'Vista previa de la plantilla',
		rendering: 'Generando…',
		live: 'En directo',
		nothingRendered: 'Todavía no se ha generado nada.',
		history: 'Historial',
		unknownActor: 'desconocido',
		rollBack: 'Restaurar',
		confirmDelete: '¿Eliminar "{type}"?',
		confirmDeleteLocale:
			'¿Eliminar la versión {locale} de "{type}"? Las personas de ese idioma recibirán la versión predeterminada.',
	},
	create: {
		titleNew: 'Nueva plantilla',
		titleLocale: 'Añadir un idioma a {type}',
		hintNew:
			'Para un correo que envía tu aplicación y que aún no tiene contenido guardado. El tipo debe coincidir con lo que envía la aplicación.',
		hintLocale:
			'Parte del contenido predeterminado. Las personas cuyo idioma coincide reciben esta versión; los demás conservan la predeterminada.',
		type: 'Tipo',
		locale: 'Idioma',
		localeOptional: 'Idioma (opcional — vacío es el predeterminado)',
		creating: 'Creando…',
		submitNew: 'Crear plantilla',
		submitLocale: 'Añadir idioma',
		errorType: 'Tipo: letras minúsculas, dígitos, - y _ (p. ej. weekly-digest).',
		errorLocaleRequired: 'Elige el idioma que quieres añadir, p. ej. fr o fr-CA.',
		errorLocale: 'Idioma: una etiqueta de idioma como fr, es o fr-CA.',
		errorText: 'El cuerpo en texto plano es obligatorio — es lo que puede mostrar cualquier cliente de correo.',
		exists: '"{type}" ya existe — ábrela desde la lista para editarla.',
		existsLocale: '"{type}" ({locale}) ya existe — ábrela desde la lista para editarla.',
		untranslated: 'Todavía en la versión predeterminada: {fields}. Tradúcelos antes de añadir este idioma.',
	},
};
export default templates;
