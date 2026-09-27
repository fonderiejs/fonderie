import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type BillingMessageKey } from './config';

// French copy of every built-in billing email. Same keys and the same
// {{variables}} (and {{#sections}}) as the English (./templates.ts) — the
// `satisfies` makes a missing email a compile error, and the coverage test
// checks the variables match. Addressed with "vous". Amounts arrive already
// formatted (`*Display` fields), so no number formatting happens here.
export const FR_TEMPLATES = {
	[MESSAGE_KEYS.subscriptionCanceled]: {
		subject: 'Votre abonnement a été résilié',
		html: `<h1>Votre abonnement a été résilié</h1>
<p>Votre abonnement à la formule <strong>{{plan}}</strong> a été résilié.</p>
<p>Vous conservez vos fonctionnalités payantes jusqu&rsquo;à la fin de la période de facturation en cours ; votre compte passera ensuite à la formule gratuite. Vos données restent intactes.</p>
<p class="muted">Vous avez changé d&rsquo;avis ? Vous pouvez vous réabonner à tout moment depuis vos paramètres de facturation.</p>`,
		text: `Votre abonnement a été résilié

Votre abonnement à la formule {{plan}} a été résilié.

Vous conservez vos fonctionnalités payantes jusqu'à la fin de la période de facturation en cours ; votre compte passera ensuite à la formule gratuite. Vos données restent intactes.

Vous avez changé d'avis ? Vous pouvez vous réabonner à tout moment depuis vos paramètres de facturation.`,
	},

	[MESSAGE_KEYS.paymentFailed]: {
		subject: 'Votre paiement n’a pas abouti',
		html: `<h1>Votre paiement n&rsquo;a pas abouti</h1>
<p>Nous n&rsquo;avons pas pu traiter votre dernier paiement. Cela signifie généralement qu&rsquo;une carte a expiré ou a été refusée.</p>
<p>Pour conserver vos fonctionnalités payantes, mettez à jour votre moyen de paiement dans vos paramètres de facturation.</p>
<p class="muted">Nous réessaierons automatiquement au cours des prochains jours. Si le paiement échoue encore, votre compte passera à la formule gratuite &mdash; vos données ne sont jamais supprimées.</p>`,
		text: `Votre paiement n'a pas abouti

Nous n'avons pas pu traiter votre dernier paiement. Cela signifie généralement qu'une carte a expiré ou a été refusée.

Pour conserver vos fonctionnalités payantes, mettez à jour votre moyen de paiement dans vos paramètres de facturation.

Nous réessaierons automatiquement au cours des prochains jours. Si le paiement échoue encore, votre compte passera à la formule gratuite — vos données ne sont jamais supprimées.`,
	},

	[MESSAGE_KEYS.trialEnding]: {
		subject: 'Votre essai se termine bientôt',
		html: `<h1>Votre essai {{plan}} se termine bientôt</h1>
<p>Votre essai gratuit de la formule <strong>{{plan}}</strong> se termine bientôt.</p>
<p>Pour conserver vos fonctionnalités sans interruption, ajoutez un moyen de paiement dans vos paramètres de facturation avant la fin de l&rsquo;essai.</p>
<p class="muted">Si vous ne faites rien, votre compte passera simplement à la formule gratuite à la fin de l&rsquo;essai. Aucun prélèvement, et vos données restent en place.</p>`,
		text: `Votre essai {{plan}} se termine bientôt

Votre essai gratuit de la formule {{plan}} se termine bientôt.

Pour conserver vos fonctionnalités sans interruption, ajoutez un moyen de paiement dans vos paramètres de facturation avant la fin de l'essai.

Si vous ne faites rien, votre compte passera simplement à la formule gratuite à la fin de l'essai. Aucun prélèvement, et vos données restent en place.`,
	},

	[MESSAGE_KEYS.renewalReceipt]: {
		subject: 'Votre abonnement a été renouvelé',
		html: `<h1>Votre abonnement a été renouvelé</h1>
<p>Merci &mdash; votre abonnement a été renouvelé pour une nouvelle période de facturation.</p>
<p>Votre reçu détaillé (facture <strong>{{invoiceId}}</strong>) est disponible à tout moment dans vos paramètres de facturation.</p>
<p class="muted">Vous n&rsquo;avez rien à faire ; nous voulions simplement vous confirmer que tout est en ordre.</p>`,
		text: `Votre abonnement a été renouvelé

Merci — votre abonnement a été renouvelé pour une nouvelle période de facturation.

Votre reçu détaillé (facture {{invoiceId}}) est disponible à tout moment dans vos paramètres de facturation.

Vous n'avez rien à faire ; nous voulions simplement vous confirmer que tout est en ordre.`,
	},

	[MESSAGE_KEYS.limitWarning]: {
		subject: 'Vous approchez de votre limite : {{key}}',
		html: `<h1>Vous approchez de votre limite : {{key}}</h1>
<p>Vous avez utilisé <strong>{{used}} sur {{limit}}</strong> ({{key}}) avec votre formule <strong>{{plan}}</strong>.</p>
<p>Vous approchez de la limite pour cette période de facturation. Changer de formule ne prend qu&rsquo;une minute et débloque des limites plus élevées.</p>`,
		text: `Vous approchez de votre limite : {{key}}

Vous avez utilisé {{used}} sur {{limit}} ({{key}}) avec votre formule {{plan}}.

Vous approchez de la limite pour cette période de facturation. Changer de formule ne prend qu'une minute et débloque des limites plus élevées.`,
	},

	[MESSAGE_KEYS.limitReached]: {
		subject: 'Vous avez atteint votre limite : {{key}}',
		html: `<h1>Vous avez atteint votre limite : {{key}}</h1>
<p>Vous avez atteint votre limite {{key}} (<strong>{{used}} sur {{limit}}</strong>) avec la formule <strong>{{plan}}</strong> pour cette période de facturation.</p>
<p>Toute utilisation supplémentaire est bloquée jusqu&rsquo;au renouvellement de la période ou jusqu&rsquo;à votre passage à une formule supérieure.</p>`,
		text: `Vous avez atteint votre limite : {{key}}

Vous avez atteint votre limite {{key}} ({{used}} sur {{limit}}) avec la formule {{plan}} pour cette période de facturation.

Toute utilisation supplémentaire est bloquée jusqu'au renouvellement de la période ou jusqu'à votre passage à une formule supérieure.`,
	},

	[MESSAGE_KEYS.creditsLow]: {
		subject: 'Votre solde est bas',
		html: `<h1>Votre solde est bas</h1>
<p>Votre solde est de <strong>{{balanceDisplay}}</strong>, soit au niveau de votre seuil de {{thresholdDisplay}} ou en dessous.</p>
<p>Rechargez-le dans vos paramètres de facturation pour éviter toute interruption.</p>`,
		text: `Votre solde est bas

Votre solde est de {{balanceDisplay}}, soit au niveau de votre seuil de {{thresholdDisplay}} ou en dessous.

Rechargez-le dans vos paramètres de facturation pour éviter toute interruption.`,
	},

	[MESSAGE_KEYS.paymentReceipt]: {
		subject: 'Votre reçu',
		html: `<h1>Reçu</h1>
<p style="font-size:28px;font-weight:700;margin:0 0 4px 0;">{{amountPaidDisplay}}</p>
<p class="muted" style="margin:0 0 20px 0;">Payé par carte</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;font-size:15px;">
	<tr><td style="padding:6px 0;">{{packName}}</td><td align="right" style="padding:6px 0;">{{amountPaidDisplay}}</td></tr>
	<tr><td style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">Total payé</td><td align="right" style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">{{amountPaidDisplay}}</td></tr>
</table>
<p>Votre solde est maintenant de <strong>{{balanceAfterDisplay}}</strong>.</p>
{{#invoiceNumber}}<p class="muted">Facture {{invoiceNumber}}</p>{{/invoiceNumber}}
{{#invoicePdf}}<p><a href="{{invoicePdf}}" target="_blank" rel="noopener noreferrer">Télécharger la facture (PDF)</a></p>{{/invoicePdf}}
<p class="muted">Votre historique de facturation complet est disponible à tout moment dans vos paramètres de facturation.</p>`,
		text: `Reçu

{{amountPaidDisplay}} payé

{{packName}} ....... {{amountPaidDisplay}}
Total payé ....... {{amountPaidDisplay}}

Votre solde est maintenant de {{balanceAfterDisplay}}.

{{#invoiceNumber}}Facture {{invoiceNumber}}{{/invoiceNumber}}
{{#invoicePdf}}Télécharger la facture (PDF) : {{invoicePdf}}{{/invoicePdf}}

Votre historique de facturation complet est disponible à tout moment dans vos paramètres de facturation.`,
	},

	[MESSAGE_KEYS.refundProcessed]: {
		subject: 'Votre remboursement a été traité',
		html: `<h1>Votre remboursement a été traité</h1>
<p>Un remboursement a été traité. <strong>{{creditsDisplay}}</strong> a été déduit de votre solde &mdash; votre solde est maintenant de <strong>{{balanceAfterDisplay}}</strong>.</p>
<p class="muted">Le remboursement sur votre moyen de paiement d&rsquo;origine peut prendre quelques jours ouvrés avant d&rsquo;apparaître.</p>`,
		text: `Votre remboursement a été traité

Un remboursement a été traité. {{creditsDisplay}} a été déduit de votre solde — votre solde est maintenant de {{balanceAfterDisplay}}.

Le remboursement sur votre moyen de paiement d'origine peut prendre quelques jours ouvrés avant d'apparaître.`,
	},

	[MESSAGE_KEYS.autoRechargeFailed]: {
		subject: 'La recharge automatique n’a pas pu être effectuée',
		html: `<h1>La recharge automatique n&rsquo;a pas pu être effectuée</h1>
<p>Nous avons tenté de recharger votre solde automatiquement, mais le paiement n&rsquo;a pas pu aboutir &mdash; généralement une carte expirée, refusée ou qui nécessite une confirmation.</p>
<p>Mettez à jour votre moyen de paiement dans vos paramètres de facturation pour garder les recharges automatiques actives.</p>`,
		text: `La recharge automatique n'a pas pu être effectuée

Nous avons tenté de recharger votre solde automatiquement, mais le paiement n'a pas pu aboutir — généralement une carte expirée, refusée ou qui nécessite une confirmation.

Mettez à jour votre moyen de paiement dans vos paramètres de facturation pour garder les recharges automatiques actives.`,
	},
} satisfies Record<BillingMessageKey, IDefaultTemplateCopy>;
