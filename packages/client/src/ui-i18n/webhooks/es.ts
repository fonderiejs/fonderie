import type en from './en';

// Addressed with « tú », neutral Latin-American Spanish.
const webhooks: typeof en = {
	loading: 'Cargando…',
	enabled: 'Activado',
	disabled: 'Desactivado',
	status: {
		pending: 'pendiente',
		delivered: 'entregado',
		failed: 'fallido',
	},
	list: {
		title: 'Webhooks',
		newSecret: 'Nuevo secreto del endpoint (se muestra una sola vez):',
		urlPlaceholder: 'https://example.com/webhook',
		eventsPlaceholder: 'event.type, event.other (opcional)',
		add: 'Agregar endpoint',
		test: 'Probar',
		delete: 'Eliminar',
		testOk: '{endpoint}: OK',
		testFailed: '{endpoint}: falló ({reason})',
		a11y: {
			url: 'Campo de URL del endpoint',
			urlHint: 'La URL que recibirá los eventos',
			events: 'Campo de tipos de evento',
			eventsHint:
				'Tipos de evento separados por comas; déjalo vacío para recibir todos los eventos',
			add: 'Botón Agregar endpoint',
			open: 'Abrir el endpoint {url}',
			test: 'Enviar un evento de prueba a {url}',
			delete: 'Eliminar el endpoint {url}',
		},
	},
	detail: {
		title: 'Endpoint de Webhook',
		url: 'URL',
		events: 'Eventos (separados por comas)',
		save: 'Guardar',
		deliveries: 'Entregas',
		attemptsOne: '{count} intento',
		attemptsOther: '{count} intentos',
		back: 'Volver a webhooks',
		a11y: {
			url: 'Campo de URL del endpoint',
			events: 'Campo de tipos de evento',
			enabled: 'Endpoint activado',
			save: 'Botón Guardar',
		},
	},
};

export default webhooks;
