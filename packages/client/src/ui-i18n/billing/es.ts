import type en from './en';

const billing: typeof en = {
	pricing: {
		loading: 'Cargando planes…',
		monthly: 'Mensual',
		yearly: 'Anual',
		perMonth: '/mes',
		perYear: '/año',
		choose: 'Elegir {plan}',
		redirecting: 'Redirigiendo…',
	},
	subscription: {
		loading: 'Cargando suscripción…',
		none: 'No tienes una suscripción activa.',
		viewPlans: 'Ver planes',
		title: 'Tu suscripción',
		statusLine: 'Estado: {status}',
		statusLineCanceling: 'Estado: {status} (se cancela al final del período)',
		renews: 'Se renueva el {date}',
		ends: 'Termina el {date}',
		manage: 'Administrar facturación',
		opening: 'Abriendo…',
	},
	paymentMethod: {
		title: 'Método de pago',
		loading: 'Cargando método de pago…',
		link: 'Link',
		linkWithEmail: 'Link · {email}',
		card: '{brand} •••• {last4} · vence {month}/{year}',
		none: 'No hay ninguna tarjeta registrada.',
		add: 'Agregar tarjeta',
		update: 'Cambiar tarjeta',
		remove: 'Eliminar',
		removing: 'Eliminando…',
	},
	status: {
		active: 'activa',
		trialing: 'en período de prueba',
		past_due: 'pago vencido',
		unpaid: 'sin pagar',
		canceled: 'cancelada',
		incomplete: 'incompleta',
		incomplete_expired: 'incompleta (vencida)',
		paused: 'en pausa',
	},
};

export default billing;
