import type en from '../en/log';

const log: typeof en = {
	title: "Journal d'administration",
	lead: 'Chaque requête passée par cette console, de la plus récente à la plus ancienne — y compris les requêtes refusées.',
	off: "Le journal d'administration est désactivé — fournissez un store à AdminModule.",
	empty: 'Aucune requête pour le moment',
	colWhen: 'Date',
	colActor: 'Auteur',
	colRequest: 'Requête',
	colStatus: 'Statut',
	colModule: 'Module',
};
export default log;
