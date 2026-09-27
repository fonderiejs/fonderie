import type en from '../en/catalog';

const catalog: typeof en = {
	title: 'Catalogue',
	lead: 'Ce que vous vendez : les forfaits tels que configurés dans le code, et tels qu’enregistrés dans la base de données, côte à côte.',
	configured: 'Configurés (code)',
	stored: 'Enregistrés (base de données)',
	emptyTitle: 'Aucun forfait enregistré',
	emptyBody:
		"Les forfaits sont configurés dans le code ; rien n'a été écrit dans la base de données.",
	col: {
		plan: 'Forfait',
		tier: 'Niveau',
		seats: 'Places',
		monthly: 'Mensuel',
		yearly: 'Annuel',
		trial: 'Essai',
	},
	trialDays: '{n} j',
	deleteConfirm: 'Supprimer le forfait enregistré « {name} » ?',
};
export default catalog;
