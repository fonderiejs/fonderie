import type en from '../en/attention';

const attention: typeof en = {
	title: 'À traiter',
	lead: 'Ce qui demande votre attention sur ce déploiement',
	leadChecked: 'Ce qui demande votre attention sur ce déploiement · vérifié à {time}',
	needsAction: 'Action requise',
	needsActionHint: 'erreurs à corriger',
	advice: 'Conseils',
	adviceHint: 'à examiner',
	modulesReady: 'Modules prêts',
	modulesReadyHint: 'admin {version}',
	routes: 'Routes',
	running: 'Vérifications en cours…',
	emptyTitle: 'Rien à traiter',
	emptyBody: 'Toutes les vérifications réussissent. Vérifié le {time}.',
};
export default attention;
