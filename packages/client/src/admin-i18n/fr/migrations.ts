import type en from '../en/migrations';

const migrations: typeof en = {
	title: 'Migrations',
	lead: 'Les changements de schéma livrés par chaque module, et si cette base de données les contient.',
	needsWrite: "L'application des migrations nécessite un jeton avec le droit d'écriture.",
	firstInstall:
		"Cette base de données n'a jamais été migrée — elle est traitée comme une première installation, rien n'est donc retenu.",
	upToDate: 'Tous les modules sont à jour',
	noPending: 'Aucune migration en attente.',
	pendingCount: '{n} en attente',
	destructive: 'destructive',
	additive: 'additive',
	blockedBy: "Appliquez d'abord « {module} » — il s'exécute avant celui-ci et est en retard.",
	destructiveBlocked:
		'Contient une migration qui supprime des données. Aucune migration inverse ne les restaure — appliquez-la via la CI ou `npm run migrate`.',
	confirmApply:
		'Appliquer {n} migration(s) à « {module} » ? Cela modifie le schéma de la base de données.',
	applyOne: 'Appliquer 1 migration',
	applyMany: 'Appliquer {n} migrations',
};
export default migrations;
