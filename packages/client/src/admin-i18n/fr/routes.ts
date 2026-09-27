import type en from '../en/routes';

const routes: typeof en = {
	title: 'Routes',
	lead: 'Chaque route exposée, avec sa protection.',
	leadCount: '{n} routes exposées par ce déploiement, avec la protection placée devant chacune.',
	filterPlaceholder: 'Filtrer par chemin, méthode, module…',
	filterLabel: 'Filtrer les routes',
	colMethod: 'Méthode',
	colPath: 'Chemin',
	colGuard: 'Protection',
	colModule: 'Module',
	application: 'application',
	noMatch: 'Aucune route ne correspond à « {q} ».',
};
export default routes;
