import type en from '../en/environment';

const environment: typeof en = {
	title: 'Environnement',
	lead: "Si chaque module est configuré et si chaque variable lue par l'application est définie. Les valeurs ne sont jamais affichées.",
	missingCount: '{n} manquantes',
	allSet: 'toutes définies',
	variables: 'Variables',
	noVariables: 'Aucune variable déclarée — passez `env` à AdminModule.',
	moduleReadiness: 'État des modules',
	problemOne: '1 problème',
	problemMany: '{n} problèmes',
};
export default environment;
