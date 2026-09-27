import type en from '../en/tokens';

const tokens: typeof en = {
	title: 'Jetons',
	lead: 'Les identifiants des machines : la robustesse du jeton racine, les jetons à portée limitée pour la CLI et la CI, et les éventuels jetons hérités par module. Les personnes se connectent en tant qu’opérateurs.',
	needsRoot:
		'Émettre et révoquer nécessitent le jeton racine (celui de la configuration de votre déploiement).',
	rootToken: 'Jeton racine',
	strong: 'robuste',
	weak: 'faible',
	issuedTokens: 'Jetons émis',
	issuingOff:
		"L'émission est désactivée — fournissez un store à AdminModule et exécutez ses migrations.",
	copyNow: 'Copiez-le maintenant — il ne sera plus jamais affiché.',
	namePlaceholder: 'nom',
	nameLabel: 'Nom',
	scope: {
		read: 'lecture',
		write: 'écriture',
		secrets: 'secrets',
	},
	daysPlaceholder: 'jours (facultatif)',
	daysLabel: 'Jours',
	issue: 'Émettre un jeton',
	col: {
		name: 'Nom',
		scopes: 'Portées',
		created: 'Créé le',
		expires: 'Expire le',
		lastUsed: 'Dernière utilisation',
	},
	revoked: 'révoqué',
	revoke: 'Révoquer',
	revokeConfirm: 'Révoquer « {name} » ? Tout ce qui l’utilise cesse de fonctionner immédiatement.',
	emptyTitle: 'Aucun jeton à portée limitée pour le moment',
	emptyBody:
		'Émettez un jeton en lecture seule pour un tableau de bord ou un collègue au lieu de partager le jeton racine.',
	legacyTitle: 'Jetons hérités par brique',
	legacyNone: "Aucun — la surface d'administration de chaque brique passe par ce jeton.",
	legacyRow: 'enregistre encore ses routes autonomes avec son propre jeton (obsolète)',
};
export default tokens;
