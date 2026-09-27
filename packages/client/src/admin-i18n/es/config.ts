import type en from '../en/config';

const config: typeof en = {
	environment: 'Entorno',
	reveal: 'Mostrar',
	type: {
		text: 'texto',
		number: 'número',
		onOff: 'sí/no',
		json: 'json',
	},
	shape: {
		text: 'Texto',
		number: 'Número',
		onOff: 'Sí/no',
		list: 'Lista',
		object: 'Objeto',
		empty: 'Vacío',
	},
	list: {
		title: 'Configuración',
		newEntry: 'Nueva entrada',
		hint: 'Indicadores de funciones y ajustes de ejecución — texto, números, sí/no o JSON. La aplicación los lee sin desplegar.',
		empty: 'Todavía no hay entradas de configuración.',
		emptyCta: 'Crea una para activar una función o ajustar un parámetro sin volver a desplegar.',
		emptyInEnv: 'No hay configuración en {env}. Las entradas de "all" siguen aplicándose allí.',
		publicBadge: 'público',
		publicTitle: 'Servido a los frontends por GET /config/public',
		publicSummary: 'Lo que reciben los frontends ({n} claves públicas)',
		publicSummaryOne: 'Lo que reciben los frontends (1 clave pública)',
		publicHint:
			'Exactamente el cuerpo de {route} — sin autenticación, así que cualquiera puede leerlo. Solo aparecen las claves que la aplicación declara públicas.',
		secretsTitle: 'Secretos',
		newSecret: 'Nuevo secreto',
		secretsHint: 'Cifrados en reposo; los valores permanecen ocultos hasta que se muestran.',
		secretsEmpty: 'Todavía no hay secretos.',
		secretsEmptyInEnv: 'No hay secretos en {env}.',
	},
	editor: {
		newEntry: 'Nueva entrada de configuración',
		newSecret: 'Nuevo secreto',
		environmentLabel: 'Entorno:',
		key: 'Clave',
		environmentHint:
			'"all" lo comparten todos los entornos; uno con nombre (production, staging…) lo reemplaza allí.',
		value: 'Valor',
		newValue: 'Nuevo valor',
		valuePlaceholder: 'true · 42 · Mantenimiento programado esta noche · {"ids": ["m1", "m2"]}',
		detected: 'Detectado:',
		saveAsText: 'Guardar como texto',
		on: 'Sí (true)',
		off: 'No (false)',
		type: 'Tipo:',
		changeType: 'Cambiar tipo…',
		changeTypeWarning:
			'Cambiar el tipo cambia lo que recibe cada pantalla que lee esta clave. Revisa primero el código que la lee.',
		description: 'Descripción',
		conflict:
			'Alguien cambió esta entrada desde que la abriste. Recarga para ver su cambio y vuelve a editarla.',
		confirmDelete: '¿Eliminar "{key}"? Todo lo que la lee vuelve a su valor predeterminado.',
		confirmDeleteIn:
			'¿Eliminar "{key}" de {env}? Todo lo que la lee vuelve a su valor predeterminado.',
		history: 'Historial',
		unknownActor: 'desconocido',
		rollBack: 'Restaurar',
	},
	errors: {
		keyRequired: 'Introduce una clave.',
		keyPattern: 'Empieza por una letra; usa letras, dígitos, ".", "_" o "-" (máx. 128).',
		exists: '"{key}" ya existe en {env} — ábrela desde la lista para editarla.',
		number: 'Introduce un número.',
		boolean: 'Usa true o false.',
		json: 'JSON no válido: {detail}',
	},
};
export default config;
