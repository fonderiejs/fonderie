import type en from '../en/operators';

const operators: typeof en = {
	title: 'Opérateurs',
	lead: "Les personnes qui peuvent se connecter à cette console. Chacune utilise un mot de passe et une application d'authentification ; il n'y a pas d'inscription.",
	level: {
		read: 'Lecture seule',
		editor: 'Éditeur',
		owner: 'Propriétaire',
	},
	levelHint: {
		read: 'consulter, sans rien modifier',
		editor: 'modifier la configuration, les modèles et les utilisateurs',
		owner: 'aussi les secrets, les jetons et les opérateurs',
	},
	needsOwner: 'La gestion des opérateurs nécessite le niveau Propriétaire.',
	mintedTitle: "Envoyez ce lien à {email}. Il n'est affiché qu'une fois.",
	mintedBody: "Il ne fonctionne qu'une fois et expire le {date}.",
	invite: 'Inviter',
	invitePlaceholder: 'collegue@entreprise.com',
	inviteLabel: 'E-mail à inviter',
	accessLevelLabel: "Niveau d'accès",
	accessLevelFor: "Niveau d'accès de {email}",
	createInvite: "Créer un lien d'invitation",
	emptyTitle: 'Aucun opérateur pour le moment',
	col: {
		operator: 'Opérateur',
		access: 'Accès',
		status: 'Statut',
		lastSignIn: 'Dernière connexion',
	},
	settingUp: 'configuration en cours',
	backupCodesLeftOne: '{n} code de secours restant',
	backupCodesLeftMany: '{n} codes de secours restants',
	recoveryLink: 'Lien de récupération',
	recoveryConfirm:
		"Créer un lien de récupération pour {email} ? Cela le déconnecte partout ; le lien permet de définir un nouveau mot de passe et une nouvelle application d'authentification.",
	disable: 'Désactiver',
	enable: 'Activer',
	disableConfirm: 'Désactiver {email} ? Il est déconnecté immédiatement.',
	pendingLinks: 'Liens en attente',
	linkKind: {
		invite: 'invitation',
		recovery: 'récupération',
	},
	expiresOn: 'expire le {date}',
	revoke: 'Révoquer',
};
export default operators;
