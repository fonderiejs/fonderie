import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type AuthMessageKey } from './config';

// Spanish copy of every built-in auth email. Same keys and the same
// {{variables}} as the English (./templates.ts) — the `satisfies` makes a
// missing email a compile error, and the coverage test checks the variables
// match. Addressed with "tú", as product email in Spanish usually is.
export const ES_TEMPLATES = {
	[MESSAGE_KEYS.emailRegistration]: {
		subject: 'Confirma tu cuenta',
		html: `<h1>Te damos la bienvenida</h1>
<p>Hola {{firstName}}:</p>
<p>Gracias por registrarte. Confirma tu cuenta con este código:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Este código caduca en 24 horas. Si no creaste una cuenta, puedes ignorar este correo.</p>`,
		text: `Te damos la bienvenida

Hola {{firstName}}:

Gracias por registrarte. Confirma tu cuenta con este código: {{pin}}

Este código caduca en 24 horas. Si no creaste una cuenta, puedes ignorar este correo.`,
	},

	[MESSAGE_KEYS.emailVerification]: {
		subject: 'Tu código de verificación',
		html: `<h1>Verifica tu correo electrónico</h1>
<p>Hola {{firstName}}:</p>
<p>Usa este código para terminar de configurar tu cuenta:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Este código caduca en 24 horas. Si no creaste una cuenta, puedes ignorar este correo.</p>`,
		text: `Verifica tu correo electrónico

Hola {{firstName}}:

Usa este código para terminar de configurar tu cuenta: {{pin}}

Este código caduca en 24 horas. Si no creaste una cuenta, puedes ignorar este correo.`,
	},

	[MESSAGE_KEYS.passwordReset]: {
		subject: 'Restablece tu contraseña',
		html: `<h1>Restablece tu contraseña</h1>
<p>Recibimos una solicitud para restablecer tu contraseña. Usa este código para continuar:</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Este código caduca pronto. Si no lo solicitaste, no tienes que hacer nada &mdash; tu contraseña sigue siendo la misma.</p>`,
		text: `Restablece tu contraseña

Recibimos una solicitud para restablecer tu contraseña. Usa este código para continuar: {{pin}}

Este código caduca pronto. Si no lo solicitaste, no tienes que hacer nada — tu contraseña sigue siendo la misma.`,
	},

	// SMS — text only.
	[MESSAGE_KEYS.phoneOtp]: {
		text: '{{otp}} es tu código de verificación. Caduca en 10 minutos.',
	},

	[MESSAGE_KEYS.mfaEnabled]: {
		subject: 'La verificación en dos pasos está activada',
		html: `<h1>Verificación en dos pasos activada</h1>
<p>Se acaba de activar la verificación en dos pasos en tu cuenta. A partir de ahora, introducirás un código de tu aplicación de autenticación al iniciar sesión.</p>
<p class="muted">Si no fuiste tú, contacta con soporte de inmediato &mdash; alguien podría tener acceso a tu cuenta.</p>`,
		text: `Verificación en dos pasos activada

Se acaba de activar la verificación en dos pasos en tu cuenta. A partir de ahora, introducirás un código de tu aplicación de autenticación al iniciar sesión.

Si no fuiste tú, contacta con soporte de inmediato — alguien podría tener acceso a tu cuenta.`,
	},

	[MESSAGE_KEYS.mfaDisabled]: {
		subject: 'La verificación en dos pasos está desactivada',
		html: `<h1>Verificación en dos pasos desactivada</h1>
<p>Se acaba de desactivar la verificación en dos pasos en tu cuenta. Ahora tu cuenta está protegida solo por tu contraseña.</p>
<p class="muted">Si no fuiste tú, contacta con soporte de inmediato y vuelve a activar la verificación en dos pasos &mdash; alguien podría tener acceso a tu cuenta.</p>`,
		text: `Verificación en dos pasos desactivada

Se acaba de desactivar la verificación en dos pasos en tu cuenta. Ahora tu cuenta está protegida solo por tu contraseña.

Si no fuiste tú, contacta con soporte de inmediato y vuelve a activar la verificación en dos pasos — alguien podría tener acceso a tu cuenta.`,
	},

	[MESSAGE_KEYS.mfaBackupCodesRegenerated]: {
		subject: 'Se regeneraron tus códigos de respaldo',
		html: `<h1>Nuevos códigos de respaldo generados</h1>
<p>Se acaba de generar un nuevo conjunto de códigos de respaldo de verificación en dos pasos para tu cuenta. Tus códigos anteriores ya no funcionan.</p>
<p class="muted">Si no fuiste tú, contacta con soporte de inmediato &mdash; alguien podría tener acceso a tu cuenta.</p>`,
		text: `Nuevos códigos de respaldo generados

Se acaba de generar un nuevo conjunto de códigos de respaldo de verificación en dos pasos para tu cuenta. Tus códigos anteriores ya no funcionan.

Si no fuiste tú, contacta con soporte de inmediato — alguien podría tener acceso a tu cuenta.`,
	},

	[MESSAGE_KEYS.emailChanged]: {
		subject: 'Se cambió tu dirección de correo electrónico',
		html: `<h1>Se cambió tu correo electrónico</h1>
<p>La dirección de correo electrónico de tu cuenta se acaba de cambiar a <strong>{{newEmail}}</strong>.</p>
<p class="muted">Si hiciste este cambio, todo está en orden. Si no, contacta con soporte de inmediato &mdash; alguien podría tener acceso a tu cuenta.</p>`,
		text: `Se cambió tu correo electrónico

La dirección de correo electrónico de tu cuenta se acaba de cambiar a {{newEmail}}.

Si hiciste este cambio, todo está en orden. Si no, contacta con soporte de inmediato — alguien podría tener acceso a tu cuenta.`,
	},

	[MESSAGE_KEYS.phoneChanged]: {
		subject: 'Se cambió tu número de teléfono',
		html: `<h1>Se cambió tu número de teléfono</h1>
<p>El número de teléfono de tu cuenta se acaba de actualizar.</p>
<p class="muted">Si hiciste este cambio, todo está en orden. Si no, contacta con soporte de inmediato &mdash; alguien podría tener acceso a tu cuenta.</p>`,
		text: `Se cambió tu número de teléfono

El número de teléfono de tu cuenta se acaba de actualizar.

Si hiciste este cambio, todo está en orden. Si no, contacta con soporte de inmediato — alguien podría tener acceso a tu cuenta.`,
	},

	[MESSAGE_KEYS.passwordRevoked]: {
		subject: 'Se eliminó la contraseña de tu cuenta',
		html: `<h1>Se eliminó tu contraseña</h1>
<p>Acabas de iniciar sesión con <strong>{{provider}}</strong>. Esta cuenta tenía una contraseña, pero esta dirección de correo nunca se había confirmado &mdash; así que no podíamos saber quién la estableció, y se ha eliminado.</p>
<p>Iniciar sesión con {{provider}} funciona como antes. Si también quieres una contraseña, puedes crearla en la configuración de tu cuenta.</p>
<p class="muted">Si nunca estableciste una contraseña aquí, es posible que alguien intentara registrarse con tu dirección. No tienes que hacer nada más &mdash; la cuenta es tuya.</p>`,
		text: `Se eliminó tu contraseña

Acabas de iniciar sesión con {{provider}}. Esta cuenta tenía una contraseña, pero
esta dirección de correo nunca se había confirmado — así que no podíamos saber
quién la estableció, y se ha eliminado.

Iniciar sesión con {{provider}} funciona como antes. Si también quieres una
contraseña, puedes crearla en la configuración de tu cuenta.

Si nunca estableciste una contraseña aquí, es posible que alguien intentara
registrarse con tu dirección. No tienes que hacer nada más — la cuenta es tuya.`,
	},

	[MESSAGE_KEYS.oauthRegistration]: {
		subject: 'Te damos la bienvenida a {{appName}}',
		html: `<h1>Te damos la bienvenida a {{appName}}</h1>
<p>Tu cuenta se creó con <strong>{{provider}}</strong>. Inicia sesión cuando quieras con la misma cuenta de {{provider}} &mdash; no hay ninguna contraseña que recordar.</p>
<p class="muted">Si no creaste esta cuenta, contacta con soporte.</p>`,
		text: `Te damos la bienvenida

Tu cuenta se creó con {{provider}}. Inicia sesión cuando quieras con la misma
cuenta de {{provider}} — no hay ninguna contraseña que recordar.

Si no creaste esta cuenta, contacta con soporte.`,
	},

	[MESSAGE_KEYS.oauthLinked]: {
		subject: 'Se añadió un nuevo método de inicio de sesión a tu cuenta',
		html: `<h1>Se añadió el inicio de sesión con {{provider}}</h1>
<p>Ahora también puedes iniciar sesión en tu cuenta con <strong>{{provider}}</strong>.</p>
<p class="muted">Si fuiste tú, no tienes que hacer nada más. Si no, contacta con soporte de inmediato y cambia tu contraseña &mdash; otra persona podría iniciar sesión como tú.</p>`,
		text: `Se añadió el inicio de sesión con {{provider}}

Ahora también puedes iniciar sesión en tu cuenta con {{provider}}.

Si fuiste tú, no tienes que hacer nada más. Si no, contacta con soporte de
inmediato y cambia tu contraseña — otra persona podría iniciar sesión como tú.`,
	},

	[MESSAGE_KEYS.oauthUnlinked]: {
		subject: 'Se eliminó un método de inicio de sesión de tu cuenta',
		html: `<h1>Se eliminó el inicio de sesión con {{provider}}</h1>
<p><strong>{{provider}}</strong> ya no se puede usar para iniciar sesión. Tu correo electrónico y tu contraseña siguen funcionando.</p>
<p class="muted">Si fuiste tú, todo está en orden. Si no, contacta con soporte de inmediato.</p>`,
		text: `Se eliminó el inicio de sesión con {{provider}}

{{provider}} ya no se puede usar para iniciar sesión. Tu correo electrónico y tu contraseña siguen funcionando.

Si fuiste tú, todo está en orden. Si no, contacta con soporte de inmediato.`,
	},
} satisfies Record<AuthMessageKey, IDefaultTemplateCopy>;
