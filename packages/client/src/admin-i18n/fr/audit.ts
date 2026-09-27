import type en from '../en/audit';

const audit: typeof en = {
	title: 'Audit',
	lead: "Ce qui s'est passé, dans tous les espaces de travail sauf si vous en nommez un. Le verdict d'intégrité de la chaîne se trouve sur la page Diagnostic.",
	workspacePlaceholder: "id d'espace de travail (tous si vide)",
	typePlaceholder: "type d'événement",
	actorPlaceholder: "id de l'acteur",
	fromLabel: 'Date de début',
	fromTitle: 'Du (inclus)',
	toLabel: 'Date de fin',
	toTitle: 'Au (inclus)',
	empty: 'Rien d’enregistré pour ce filtre',
	col: {
		when: 'Date',
		type: 'Type',
		workspace: 'Espace de travail',
		actor: 'Acteur',
		request: 'Requête',
	},
};
export default audit;
