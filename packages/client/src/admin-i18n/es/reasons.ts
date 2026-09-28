import type en from '../en/reasons';

const reasons: typeof en = {
	admin: {
		CHECK_TIMED_OUT: 'Tiempo agotado tras {ms} ms.',
		CHECK_THREW: 'La comprobación falló de forma inesperada: {detail}',
		CHECK_FAILED: 'La comprobación falló sin indicar el motivo.',
		MIGRATIONS_PENDING: '{module}: {count} migración(es) sin aplicar — {files}',
		OPERATOR_KEY_INVALID:
			'operatorKey debe tener 64 caracteres hexadecimales (openssl rand -hex 32).',
	},
	auth: {
		JWT_SECRET_TOO_SHORT: 'jwtSecret debe tener al menos {min} caracteres (tiene {got}).',
		JWT_SECRET_PLACEHOLDER: 'jwtSecret parece un valor de ejemplo o de desarrollo.',
		INSECURE_COOKIES:
			'secureCookies está desactivado — las cookies de inicio de sesión pueden viajar por HTTP sin cifrar en producción.',
		GOOGLE_INCOMPLETE:
			'El inicio de sesión con Google está configurado, pero falta el ID de cliente, el secreto de cliente o la URI de redirección.',
		GOOGLE_SECRET_PLACEHOLDER:
			'El secreto de cliente de Google parece un valor de ejemplo o de desarrollo.',
		APPLE_INCOMPLETE:
			'Iniciar sesión con Apple está configurado, pero falta el ID de cliente, el ID de equipo, el ID de clave, la clave privada o la URI de redirección.',
		APPLE_KEY_NOT_PEM:
			'La clave privada de Apple no es una clave PEM .p8 (se esperaba -----BEGIN PRIVATE KEY-----).',
		APPLE_NATIVE_IDS_INVALID:
			'Los ID de cliente nativos de Apple deben ser identificadores de bundle exactos — una entrada vacía o comodín aceptaría tokens emitidos para otras apps.',
		MFA_KEY_MISSING:
			'La verificación en dos pasos está activa sin mfaSecretKey — los secretos del autenticador se guardan sin cifrar. Define una clave de 32 bytes (openssl rand -hex 32).',
		MFA_KEY_INVALID: 'mfaSecretKey debe tener 64 caracteres hexadecimales (openssl rand -hex 32).',
	},
	billing: {
		PRICE_CHECK_FAILED: 'No se pudo ejecutar la comprobación de precios: {detail}',
		PRICE_NOT_FOUND: '{ref}: el precio {price} no existe en el proveedor de pagos.',
		PRICE_INACTIVE: '{ref}: el precio {price} está inactivo en el proveedor de pagos.',
		PRICE_MISMATCH:
			'{ref}: el catálogo indica {declared}, el proveedor cobra {actual}. Las compras con tarjeta guardada y la recarga automática usan el catálogo; el pago alojado usa el proveedor.',
		WEBHOOK_CHECK_FAILED: 'No se pudo ejecutar la comprobación de webhooks: {detail}',
		WEBHOOK_NOT_REGISTERED:
			'{url} no está registrado — ninguno de los eventos que se procesan ahí llegará nunca.',
		WEBHOOK_DISABLED: '{url} está desactivado en el proveedor — no envía nada.',
		WEBHOOK_EVENTS_MISSING:
			'{url} no está suscrito a {events} — esos procesos nunca podrán ejecutarse.',
		WEBHOOK_API_VERSION:
			'{url} envía los datos en la versión {endpointVersion}; esta app lee la {clientVersion}. Las facturas se leen de forma tolerante, así que no se pierde nada, pero conviene cerrar la diferencia: vuelve a crear el endpoint en {clientVersion} (nuevo secreto de firma).',
		DRIFT_CHECK_FAILED: 'No se pudo ejecutar la comprobación de suscripciones: {detail}',
		SUBSCRIPTION_MISSING_AT_PROVIDER:
			'{subscriber} ({subscription}): marcada como {status} aquí, pero el proveedor no tiene esa suscripción — {impact}.',
		SUBSCRIPTION_FIELDS_DIFFER:
			'{subscriber} ({subscription}): {fields} no coinciden — aquí {ours}, en el proveedor {theirs} — {impact}.',
		DRIFT_TRUNCATED: 'Solo se comparó una parte de las suscripciones: {note}',
		NOTIFICATIONS_UNWIRED:
			'Los pagos están activos, pero no se puede avisar a los clientes — pasa un bus de eventos y resolveRecipient a BillingModule para enviar recibos, reembolsos y avisos de pago fallido.',
		AUTO_RECHARGE_UNSUPPORTED:
			'El plan {plan} activa la recarga automática, pero el proveedor {provider} no puede cobrar una tarjeta guardada — nunca ocurrirá.',
		AUTO_RECHARGE_UNKNOWN_PACK:
			'El plan {plan} recarga con el paquete de créditos {pack}, que no existe — añádelo al catálogo.',
		ALLOWANCE_WITHOUT_WALLET:
			'El plan {plan} concede un saldo, pero el monedero está desactivado — ese saldo no tiene efecto.',
		NEGATIVE_ROLLOVER_CAP:
			'El plan {plan} tiene un tope de acumulación negativo ({cap}) — usa 0 o más, none o full.',
		PROVIDER_CANNOT_BE_ASKED: 'El proveedor de pagos no puede responder a esta comprobación.',
		PUBLIC_URL_NOT_SET:
			'La URL pública de la API no está definida, así que no se pueden comprobar los endpoints de webhook.',
	},
	config: {
		NO_SECRET_ENCRYPTOR:
			'No hay clave de cifrado de secretos — la página de secretos rechaza todas las peticiones en lugar de guardarlos sin cifrar. Define CONFIG_SECRET_KEY.',
	},
	core: {
		ADMIN_TOKEN_TOO_SHORT:
			'El token de administración debe tener al menos {min} caracteres (tiene {got}).',
		ADMIN_TOKEN_PLACEHOLDER:
			'El token de administración parece un valor de ejemplo o de desarrollo.',
	},
	courier: {
		CHANNEL_WITHOUT_PROVIDER:
			'{count} tipo(s) de mensaje se envían por {channel}, pero no hay un proveedor de {channel} configurado — se pierden sin aviso: {types}.',
		TEMPLATES_UNROUTED:
			'{count} tipo(s) de mensaje tienen plantilla pero ningún canal, así que nunca se envían: {types}.',
		SENDER_DNS_CHECK_FAILED: 'No se pudo ejecutar la comprobación DNS del remitente: {detail}',
		SPF_MULTIPLE:
			'{count} registros SPF en {domain} — los destinatarios lo tratan como si no hubiera SPF.',
		DMARC_MISSING:
			'No hay registro DMARC para {domain} — los destinatarios juzgan tus correos según sus propias reglas.',
		DMARC_MONITORING_ONLY:
			'El DMARC de {domain} solo observa (p=none), así que los correos suplantados se siguen entregando. Pasa a quarantine o reject cuando los informes estén limpios.',
		DKIM_KEY_MISSING:
			'No hay clave DKIM en {host} — los correos firmados con el selector {selector} no se pueden verificar.',
		SPF_ABSENT_DKIM_ALIGNS:
			'No hay registro SPF en {domain}, lo normal cuando tu proveedor gestiona la dirección de retorno; DMARC se cumple gracias a DKIM.',
		SPF_AND_DKIM_MISSING:
			'No hay registro SPF en {domain} ni clave DKIM — DMARC no puede cumplirse: tus correos no están autenticados.',
		SPF_ABSENT_DKIM_UNKNOWN:
			'No hay registro SPF en {domain}. Es normal si tu proveedor gestiona la dirección de retorno y publica DKIM — indica los selectores DKIM para confirmarlo.',
	},
	events: {
		NO_INTEGRITY_KEY:
			'No hay clave de integridad — el registro de eventos no está protegido contra manipulaciones.',
		TRANSPORT_NOT_STARTED: 'El transporte de eventos aún no se ha iniciado.',
		EVENT_TAMPERED: 'El evento {event} ya no coincide con su firma — fue modificado.',
		EVENTS_UNSIGNED: '{count} evento(s) anteriores a la firma no se pueden verificar.',
		EVENT_DEAD: '{type} ({consumer}) falló en todos los reintentos y nunca se entregará: {error}',
		BACKLOG_STALE: '{consumer}: {waiting} en espera, el más antiguo desde hace {minutes} min.',
	},
	values: {
		impact: {
			UNDER_GRANTING: 'el cliente no tiene acceso a lo que pagó',
			OVER_GRANTING: 'se da acceso sin pago',
			METADATA: 'solo detalles, sin efecto en el acceso',
		},
	},
};
export default reasons;
