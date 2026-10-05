import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type AuthMessageKey } from './config';

// French copy of every built-in auth email. Same keys and the same {{variables}}
// as the English (./templates.ts) — the `satisfies` makes a missing email a
// compile error, and the coverage test checks the variables match. Addressed
// with "vous", as product email in French usually is.
export const FR_TEMPLATES = {
	[MESSAGE_KEYS.emailRegistration]: {
		subject: 'Confirmez votre compte',
		html: `<h1>Bienvenue</h1>
<p>Bonjour {{firstName}},</p>
<p>Merci pour votre inscription. Confirmez votre compte avec ce code :</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Ce code expire dans 24 heures. Si vous n&rsquo;avez pas créé de compte, vous pouvez ignorer cet e-mail.</p>`,
		text: `Bienvenue

Bonjour {{firstName}},

Merci pour votre inscription. Confirmez votre compte avec ce code : {{pin}}

Ce code expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.`,
	},

	[MESSAGE_KEYS.emailVerification]: {
		subject: 'Votre code de vérification',
		html: `<h1>Vérifiez votre adresse e-mail</h1>
<p>Bonjour {{firstName}},</p>
<p>Utilisez ce code pour terminer la création de votre compte :</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Ce code expire dans 24 heures. Si vous n&rsquo;avez pas créé de compte, vous pouvez ignorer cet e-mail.</p>`,
		text: `Vérifiez votre adresse e-mail

Bonjour {{firstName}},

Utilisez ce code pour terminer la création de votre compte : {{pin}}

Ce code expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.`,
	},

	[MESSAGE_KEYS.passwordReset]: {
		subject: 'Réinitialisez votre mot de passe',
		html: `<h1>Réinitialisez votre mot de passe</h1>
<p>Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez ce code pour continuer :</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">Ce code expire bientôt. Si vous n&rsquo;avez rien demandé, aucune action n&rsquo;est nécessaire &mdash; votre mot de passe reste inchangé.</p>`,
		text: `Réinitialisez votre mot de passe

Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez ce code pour continuer : {{pin}}

Ce code expire bientôt. Si vous n'avez rien demandé, aucune action n'est nécessaire — votre mot de passe reste inchangé.`,
	},

	// SMS — text only.
	[MESSAGE_KEYS.phoneOtp]: {
		text: '{{otp}} est votre code de vérification. Il expire dans 10 minutes.',
	},

	[MESSAGE_KEYS.mfaEnabled]: {
		subject: 'La double authentification est activée',
		html: `<h1>Double authentification activée</h1>
<p>La double authentification vient d&rsquo;être activée sur votre compte. Désormais, vous saisirez un code de votre application d&rsquo;authentification à chaque connexion.</p>
<p class="muted">Si ce n&rsquo;est pas vous, contactez immédiatement le support &mdash; quelqu&rsquo;un pourrait avoir accès à votre compte.</p>`,
		text: `Double authentification activée

La double authentification vient d'être activée sur votre compte. Désormais, vous saisirez un code de votre application d'authentification à chaque connexion.

Si ce n'est pas vous, contactez immédiatement le support — quelqu'un pourrait avoir accès à votre compte.`,
	},

	[MESSAGE_KEYS.mfaDisabled]: {
		subject: 'La double authentification est désactivée',
		html: `<h1>Double authentification désactivée</h1>
<p>La double authentification vient d&rsquo;être désactivée sur votre compte. Votre compte n&rsquo;est désormais protégé que par votre mot de passe.</p>
<p class="muted">Si ce n&rsquo;est pas vous, contactez immédiatement le support et réactivez la double authentification &mdash; quelqu&rsquo;un pourrait avoir accès à votre compte.</p>`,
		text: `Double authentification désactivée

La double authentification vient d'être désactivée sur votre compte. Votre compte n'est désormais protégé que par votre mot de passe.

Si ce n'est pas vous, contactez immédiatement le support et réactivez la double authentification — quelqu'un pourrait avoir accès à votre compte.`,
	},

	[MESSAGE_KEYS.mfaBackupCodesRegenerated]: {
		subject: 'Vos codes de secours ont été régénérés',
		html: `<h1>Nouveaux codes de secours générés</h1>
<p>Une nouvelle série de codes de secours pour la double authentification vient d&rsquo;être générée pour votre compte. Vos anciens codes ne fonctionnent plus.</p>
<p class="muted">Si ce n&rsquo;est pas vous, contactez immédiatement le support &mdash; quelqu&rsquo;un pourrait avoir accès à votre compte.</p>`,
		text: `Nouveaux codes de secours générés

Une nouvelle série de codes de secours pour la double authentification vient d'être générée pour votre compte. Vos anciens codes ne fonctionnent plus.

Si ce n'est pas vous, contactez immédiatement le support — quelqu'un pourrait avoir accès à votre compte.`,
	},

	[MESSAGE_KEYS.emailChanged]: {
		subject: 'Votre adresse e-mail a été modifiée',
		html: `<h1>Votre adresse e-mail a été modifiée</h1>
<p>L&rsquo;adresse e-mail de votre compte vient d&rsquo;être remplacée par <strong>{{newEmail}}</strong>.</p>
<p class="muted">Si vous êtes à l&rsquo;origine de ce changement, tout est en ordre. Sinon, contactez immédiatement le support &mdash; quelqu&rsquo;un pourrait avoir accès à votre compte.</p>`,
		text: `Votre adresse e-mail a été modifiée

L'adresse e-mail de votre compte vient d'être remplacée par {{newEmail}}.

Si vous êtes à l'origine de ce changement, tout est en ordre. Sinon, contactez immédiatement le support — quelqu'un pourrait avoir accès à votre compte.`,
	},

	[MESSAGE_KEYS.phoneChanged]: {
		subject: 'Votre numéro de téléphone a été modifié',
		html: `<h1>Votre numéro de téléphone a été modifié</h1>
<p>Le numéro de téléphone de votre compte vient d&rsquo;être mis à jour.</p>
<p class="muted">Si vous êtes à l&rsquo;origine de ce changement, tout est en ordre. Sinon, contactez immédiatement le support &mdash; quelqu&rsquo;un pourrait avoir accès à votre compte.</p>`,
		text: `Votre numéro de téléphone a été modifié

Le numéro de téléphone de votre compte vient d'être mis à jour.

Si vous êtes à l'origine de ce changement, tout est en ordre. Sinon, contactez immédiatement le support — quelqu'un pourrait avoir accès à votre compte.`,
	},

	[MESSAGE_KEYS.passwordRevoked]: {
		subject: 'Le mot de passe de votre compte a été supprimé',
		html: `<h1>Votre mot de passe a été supprimé</h1>
<p>Vous venez de vous connecter avec <strong>{{provider}}</strong>. Un mot de passe avait été défini sur ce compte, mais cette adresse e-mail n&rsquo;avait jamais été confirmée &mdash; nous ne pouvions donc pas savoir qui l&rsquo;avait défini, et il a été supprimé.</p>
<p>La connexion avec {{provider}} fonctionne comme avant. Si vous souhaitez aussi un mot de passe, définissez-en un dans les paramètres de votre compte.</p>
<p class="muted">Si vous n&rsquo;avez jamais défini de mot de passe ici, quelqu&rsquo;un a peut-être tenté de s&rsquo;inscrire avec votre adresse. Vous n&rsquo;avez rien d&rsquo;autre à faire &mdash; le compte vous appartient.</p>`,
		text: `Votre mot de passe a été supprimé

Vous venez de vous connecter avec {{provider}}. Un mot de passe avait été défini
sur ce compte, mais cette adresse e-mail n'avait jamais été confirmée — nous ne
pouvions donc pas savoir qui l'avait défini, et il a été supprimé.

La connexion avec {{provider}} fonctionne comme avant. Si vous souhaitez aussi un
mot de passe, définissez-en un dans les paramètres de votre compte.

Si vous n'avez jamais défini de mot de passe ici, quelqu'un a peut-être tenté de
s'inscrire avec votre adresse. Vous n'avez rien d'autre à faire — le compte vous
appartient.`,
	},

	[MESSAGE_KEYS.oauthRegistration]: {
		subject: 'Bienvenue sur {{appName}}',
		html: `<h1>Bienvenue sur {{appName}}</h1>
<p>Votre compte a été créé avec <strong>{{provider}}</strong>. Connectez-vous à tout moment avec ce même compte {{provider}} &mdash; aucun mot de passe à retenir.</p>
<p class="muted">Si vous n&rsquo;avez pas créé ce compte, contactez le support.</p>`,
		text: `Bienvenue

Votre compte a été créé avec {{provider}}. Connectez-vous à tout moment avec ce
même compte {{provider}} — aucun mot de passe à retenir.

Si vous n'avez pas créé ce compte, contactez le support.`,
	},

	[MESSAGE_KEYS.oauthLinked]: {
		subject: 'Une nouvelle méthode de connexion a été ajoutée à votre compte',
		html: `<h1>Connexion avec {{provider}} ajoutée</h1>
<p>Vous pouvez désormais aussi vous connecter à votre compte avec <strong>{{provider}}</strong>.</p>
<p class="muted">Si c&rsquo;est bien vous, vous n&rsquo;avez rien d&rsquo;autre à faire. Sinon, contactez immédiatement le support et changez votre mot de passe &mdash; quelqu&rsquo;un d&rsquo;autre pourrait se connecter à votre place.</p>`,
		text: `Connexion avec {{provider}} ajoutée

Vous pouvez désormais aussi vous connecter à votre compte avec {{provider}}.

Si c'est bien vous, vous n'avez rien d'autre à faire. Sinon, contactez
immédiatement le support et changez votre mot de passe — quelqu'un d'autre
pourrait se connecter à votre place.`,
	},

	[MESSAGE_KEYS.oauthUnlinked]: {
		subject: 'Une méthode de connexion a été retirée de votre compte',
		html: `<h1>Connexion avec {{provider}} retirée</h1>
<p><strong>{{provider}}</strong> ne peut plus être utilisé pour vous connecter. Votre adresse e-mail et votre mot de passe fonctionnent toujours.</p>
<p class="muted">Si c&rsquo;est bien vous, tout est en ordre. Sinon, contactez immédiatement le support.</p>`,
		text: `Connexion avec {{provider}} retirée

{{provider}} ne peut plus être utilisé pour vous connecter. Votre adresse e-mail et votre mot de passe fonctionnent toujours.

Si c'est bien vous, tout est en ordre. Sinon, contactez immédiatement le support.`,
	},

	[MESSAGE_KEYS.accountDeletionCode]: {
		subject: `Confirmez la suppression de votre compte`,
		html: `<h1>Confirmer la suppression du compte</h1>
<p>Utilisez ce code pour confirmer que vous souhaitez supprimer votre compte :</p>
<p><span class="pin-code">{{code}}</span></p>
<p class="muted">Ce code expire dans 15 minutes. Si vous n&rsquo;avez pas demandé la suppression de votre compte, ignorez ce message et changez votre mot de passe &mdash; votre compte reste tel quel.</p>`,
		text: `Votre code pour confirmer la suppression de votre compte : {{code}}. Il expire dans 15 minutes. Ce n'est pas vous ? Ignorez ce message et changez votre mot de passe.`,
	},

	[MESSAGE_KEYS.accountDeletionScheduled]: {
		subject: `Votre compte sera supprimé le {{deleteOn}}`,
		html: `<h1>Votre compte sera supprimé</h1>
<p>Nous avons bien reçu votre demande. Votre compte est fermé et sera supprimé définitivement le <strong>{{deleteOn}}</strong>.</p>
<p>Vous avez changé d&rsquo;avis ? Connectez-vous avant cette date et choisissez <strong>Conserver mon compte</strong>.</p>
<p class="muted">Si vous n&rsquo;êtes pas à l&rsquo;origine de cette demande, connectez-vous maintenant pour conserver votre compte et changez votre mot de passe.</p>`,
		text: `Votre compte sera supprimé définitivement le {{deleteOn}}. Vous avez changé d'avis ? Connectez-vous avant cette date et choisissez Conserver mon compte.`,
	},

	[MESSAGE_KEYS.accountRestored]: {
		subject: `Votre compte a été rétabli`,
		html: `<h1>Bon retour</h1>
<p>La suppression de votre compte a été annulée et votre compte est de nouveau actif.</p>
<p class="muted">Si ce n&rsquo;est pas vous, changez votre mot de passe immédiatement.</p>`,
		text: `La suppression de votre compte a été annulée ; votre compte est de nouveau actif. Ce n'est pas vous ? Changez votre mot de passe maintenant.`,
	},
} satisfies Record<AuthMessageKey, IDefaultTemplateCopy>;
