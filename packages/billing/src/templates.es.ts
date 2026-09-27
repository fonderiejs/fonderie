import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type BillingMessageKey } from './config';

// Spanish copy of every built-in billing email. Same keys and the same
// {{variables}} (and {{#sections}}) as the English (./templates.ts) — the
// `satisfies` makes a missing email a compile error, and the coverage test
// checks the variables match. Addressed with "tú". Amounts arrive already
// formatted (`*Display` fields), so no number formatting happens here.
export const ES_TEMPLATES = {
	[MESSAGE_KEYS.subscriptionCanceled]: {
		subject: 'Se canceló tu suscripción',
		html: `<h1>Se canceló tu suscripción</h1>
<p>Se canceló tu suscripción al plan <strong>{{plan}}</strong>.</p>
<p>Conservarás las funciones de pago hasta el final del período de facturación actual; después, tu cuenta pasará al plan gratuito. Tus datos se mantienen intactos.</p>
<p class="muted">¿Cambiaste de opinión? Puedes volver a suscribirte cuando quieras desde la configuración de facturación.</p>`,
		text: `Se canceló tu suscripción

Se canceló tu suscripción al plan {{plan}}.

Conservarás las funciones de pago hasta el final del período de facturación actual; después, tu cuenta pasará al plan gratuito. Tus datos se mantienen intactos.

¿Cambiaste de opinión? Puedes volver a suscribirte cuando quieras desde la configuración de facturación.`,
	},

	[MESSAGE_KEYS.paymentFailed]: {
		subject: 'No se pudo procesar tu pago',
		html: `<h1>No se pudo procesar tu pago</h1>
<p>No pudimos procesar tu pago más reciente. Normalmente significa que una tarjeta caducó o fue rechazada.</p>
<p>Para conservar las funciones de pago, actualiza tu método de pago en la configuración de facturación.</p>
<p class="muted">Lo volveremos a intentar automáticamente durante los próximos días. Si sigue fallando, tu cuenta pasará al plan gratuito &mdash; tus datos nunca se eliminan.</p>`,
		text: `No se pudo procesar tu pago

No pudimos procesar tu pago más reciente. Normalmente significa que una tarjeta caducó o fue rechazada.

Para conservar las funciones de pago, actualiza tu método de pago en la configuración de facturación.

Lo volveremos a intentar automáticamente durante los próximos días. Si sigue fallando, tu cuenta pasará al plan gratuito — tus datos nunca se eliminan.`,
	},

	[MESSAGE_KEYS.trialEnding]: {
		subject: 'Tu prueba termina pronto',
		html: `<h1>Tu prueba de {{plan}} termina pronto</h1>
<p>Tu prueba gratuita del plan <strong>{{plan}}</strong> termina pronto.</p>
<p>Para conservar tus funciones sin interrupciones, añade un método de pago en la configuración de facturación antes de que termine.</p>
<p class="muted">Si no haces nada, tu cuenta simplemente pasará al plan gratuito cuando termine la prueba. Sin cargos, y tus datos se quedan donde están.</p>`,
		text: `Tu prueba de {{plan}} termina pronto

Tu prueba gratuita del plan {{plan}} termina pronto.

Para conservar tus funciones sin interrupciones, añade un método de pago en la configuración de facturación antes de que termine.

Si no haces nada, tu cuenta simplemente pasará al plan gratuito cuando termine la prueba. Sin cargos, y tus datos se quedan donde están.`,
	},

	[MESSAGE_KEYS.renewalReceipt]: {
		subject: 'Se renovó tu suscripción',
		html: `<h1>Se renovó tu suscripción</h1>
<p>Gracias &mdash; tu suscripción se renovó por otro período de facturación.</p>
<p>Tu recibo detallado (factura <strong>{{invoiceId}}</strong>) está disponible en cualquier momento en la configuración de facturación.</p>
<p class="muted">No tienes que hacer nada; solo queríamos confirmarte que todo está en orden.</p>`,
		text: `Se renovó tu suscripción

Gracias — tu suscripción se renovó por otro período de facturación.

Tu recibo detallado (factura {{invoiceId}}) está disponible en cualquier momento en la configuración de facturación.

No tienes que hacer nada; solo queríamos confirmarte que todo está en orden.`,
	},

	[MESSAGE_KEYS.limitWarning]: {
		subject: 'Te acercas a tu límite: {{key}}',
		html: `<h1>Te acercas a tu límite: {{key}}</h1>
<p>Has usado <strong>{{used}} de {{limit}}</strong> ({{key}}) en tu plan <strong>{{plan}}</strong>.</p>
<p>Te acercas al límite de este período de facturación. Cambiar de plan lleva un minuto y desbloquea límites más altos.</p>`,
		text: `Te acercas a tu límite: {{key}}

Has usado {{used}} de {{limit}} ({{key}}) en tu plan {{plan}}.

Te acercas al límite de este período de facturación. Cambiar de plan lleva un minuto y desbloquea límites más altos.`,
	},

	[MESSAGE_KEYS.limitReached]: {
		subject: 'Alcanzaste tu límite: {{key}}',
		html: `<h1>Alcanzaste tu límite: {{key}}</h1>
<p>Alcanzaste tu límite de {{key}} (<strong>{{used}} de {{limit}}</strong>) en el plan <strong>{{plan}}</strong> para este período de facturación.</p>
<p>El uso adicional queda bloqueado hasta que se reinicie el período o pases a un plan superior.</p>`,
		text: `Alcanzaste tu límite: {{key}}

Alcanzaste tu límite de {{key}} ({{used}} de {{limit}}) en el plan {{plan}} para este período de facturación.

El uso adicional queda bloqueado hasta que se reinicie el período o pases a un plan superior.`,
	},

	[MESSAGE_KEYS.creditsLow]: {
		subject: 'Tu saldo se está agotando',
		html: `<h1>Tu saldo se está agotando</h1>
<p>Tu saldo es de <strong>{{balanceDisplay}}</strong>, igual o inferior a tu umbral de {{thresholdDisplay}}.</p>
<p>Recarga en la configuración de facturación para evitar interrupciones.</p>`,
		text: `Tu saldo se está agotando

Tu saldo es de {{balanceDisplay}}, igual o inferior a tu umbral de {{thresholdDisplay}}.

Recarga en la configuración de facturación para evitar interrupciones.`,
	},

	[MESSAGE_KEYS.paymentReceipt]: {
		subject: 'Tu recibo',
		html: `<h1>Recibo</h1>
<p style="font-size:28px;font-weight:700;margin:0 0 4px 0;">{{amountPaidDisplay}}</p>
<p class="muted" style="margin:0 0 20px 0;">Pagado con tarjeta</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;font-size:15px;">
	<tr><td style="padding:6px 0;">{{packName}}</td><td align="right" style="padding:6px 0;">{{amountPaidDisplay}}</td></tr>
	<tr><td style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">Total pagado</td><td align="right" style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">{{amountPaidDisplay}}</td></tr>
</table>
<p>Tu saldo ahora es de <strong>{{balanceAfterDisplay}}</strong>.</p>
{{#invoiceNumber}}<p class="muted">Factura {{invoiceNumber}}</p>{{/invoiceNumber}}
{{#invoicePdf}}<p><a href="{{invoicePdf}}" target="_blank" rel="noopener noreferrer">Descargar factura (PDF)</a></p>{{/invoicePdf}}
<p class="muted">Tu historial de facturación completo está disponible en cualquier momento en la configuración de facturación.</p>`,
		text: `Recibo

{{amountPaidDisplay}} pagado

{{packName}} ....... {{amountPaidDisplay}}
Total pagado ....... {{amountPaidDisplay}}

Tu saldo ahora es de {{balanceAfterDisplay}}.

{{#invoiceNumber}}Factura {{invoiceNumber}}{{/invoiceNumber}}
{{#invoicePdf}}Descargar factura (PDF): {{invoicePdf}}{{/invoicePdf}}

Tu historial de facturación completo está disponible en cualquier momento en la configuración de facturación.`,
	},

	[MESSAGE_KEYS.refundProcessed]: {
		subject: 'Se procesó tu reembolso',
		html: `<h1>Se procesó tu reembolso</h1>
<p>Se procesó un reembolso. Se descontaron <strong>{{creditsDisplay}}</strong> de tu saldo &mdash; tu saldo ahora es de <strong>{{balanceAfterDisplay}}</strong>.</p>
<p class="muted">El reembolso a tu método de pago original puede tardar unos días hábiles en aparecer.</p>`,
		text: `Se procesó tu reembolso

Se procesó un reembolso. Se descontaron {{creditsDisplay}} de tu saldo — tu saldo ahora es de {{balanceAfterDisplay}}.

El reembolso a tu método de pago original puede tardar unos días hábiles en aparecer.`,
	},

	[MESSAGE_KEYS.autoRechargeFailed]: {
		subject: 'No se pudo completar la recarga automática',
		html: `<h1>No se pudo completar la recarga automática</h1>
<p>Intentamos recargar tu saldo automáticamente, pero no se pudo completar el pago &mdash; normalmente por una tarjeta caducada, rechazada o que necesita confirmación.</p>
<p>Actualiza tu método de pago en la configuración de facturación para mantener activas las recargas automáticas.</p>`,
		text: `No se pudo completar la recarga automática

Intentamos recargar tu saldo automáticamente, pero no se pudo completar el pago — normalmente por una tarjeta caducada, rechazada o que necesita confirmación.

Actualiza tu método de pago en la configuración de facturación para mantener activas las recargas automáticas.`,
	},
} satisfies Record<BillingMessageKey, IDefaultTemplateCopy>;
