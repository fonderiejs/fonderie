import type en from '../en/users';

const users: typeof en = {
	title: 'Utilisateurs',
	lead: 'Tous les inscrits. Ouvrez un compte pour voir ses sessions, ses connexions et les commandes de suspension et de déconnexion.',
	emailPlaceholder: 'adresse e-mail',
	emailLabel: 'E-mail',
	allUsers: 'Tous les utilisateurs',
	whichAccounts: 'Quels comptes',
	activeAccounts: 'Actifs',
	deletedAccounts: 'Supprimés',
	noUserWithEmail: 'Aucun utilisateur avec cette adresse e-mail.',
	missingIdPrefix: "Aucun compte avec l'id",
	missingIdBody:
		"Il a été supprimé, ou n'a jamais existé ici. Ses données de facturation sont conservées.",
	planCredits: 'Forfait et crédits',
	emptyTitle: 'Aucun utilisateur pour le moment',
	emptyBody: 'Les inscriptions apparaissent ici au fil de l’eau.',
	col: {
		email: 'E-mail',
		name: 'Nom',
		plan: 'Forfait',
		created: 'Créé le',
		status: 'Statut',
	},
	field: {
		id: 'id',
		email: 'e-mail',
		verified: 'vérifié',
		mfa: 'MFA',
		provider: 'fournisseur',
		lastLogin: 'dernière connexion',
		created: 'créé le',
	},
	passwordProvider: 'mot de passe',
	noPasswordSet: 'aucun mot de passe défini',
	deletedOn: 'Supprimé le {date}.',
	deletedBody:
		'Le compte ne peut plus se connecter et sera effacé lors de la purge de conservation. Ses données de facturation sont conservées.',
	suspend: 'Suspendre',
	unsuspend: 'Réactiver',
	signOutEverywhere: 'Déconnecter partout',
	liveSessions: 'Sessions actives',
	since: 'depuis le {date}',
	recentSignIns: 'Connexions récentes',
	noneRecorded: 'Aucune enregistrée.',
	outcome: {
		success: 'réussie',
		failure: 'échec',
	},
	proxyVpn: 'proxy/VPN',
	hosting: 'hébergeur',
};
export default users;
