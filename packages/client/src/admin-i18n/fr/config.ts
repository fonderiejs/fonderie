import type en from '../en/config';

const config: typeof en = {
	environment: 'Environnement',
	reveal: 'Afficher',
	type: {
		text: 'texte',
		number: 'nombre',
		onOff: 'oui/non',
		json: 'json',
	},
	shape: {
		text: 'Texte',
		number: 'Nombre',
		onOff: 'Oui/non',
		list: 'Liste',
		object: 'Objet',
		empty: 'Vide',
	},
	list: {
		title: 'Configuration',
		newEntry: 'Nouvelle entrée',
		hint: "Drapeaux de fonctionnalité et réglages d'exécution — texte, nombres, oui/non ou JSON. Lus par l'application sans redéploiement.",
		empty: 'Aucune entrée de configuration pour le moment.',
		emptyCta: 'Créez-en une pour activer une fonctionnalité ou ajuster un réglage sans redéployer.',
		emptyInEnv: 'Aucune configuration dans {env}. Les entrées de « all » s’y appliquent toujours.',
		publicBadge: 'public',
		publicTitle: 'Servi aux frontends par GET /config/public',
		publicSummary: 'Ce que reçoivent les frontends ({n} clés publiques)',
		publicSummaryOne: 'Ce que reçoivent les frontends (1 clé publique)',
		publicHint:
			"Exactement le corps de {route} — sans authentification, donc lisible par tous. Seules les clés que l'application déclare publiques y figurent.",
		secretsTitle: 'Secrets',
		newSecret: 'Nouveau secret',
		secretsHint: 'Chiffrés au repos ; les valeurs restent masquées jusqu’à leur affichage.',
		secretsEmpty: 'Aucun secret pour le moment.',
		secretsEmptyInEnv: 'Aucun secret dans {env}.',
	},
	editor: {
		newEntry: 'Nouvelle entrée de configuration',
		newSecret: 'Nouveau secret',
		environmentLabel: 'Environnement :',
		key: 'Clé',
		environmentHint:
			'« all » est partagé par tous les environnements ; un environnement nommé (production, staging…) le remplace.',
		value: 'Valeur',
		newValue: 'Nouvelle valeur',
		valuePlaceholder: 'true · 42 · Maintenance prévue ce soir · {"ids": ["m1", "m2"]}',
		detected: 'Détecté :',
		saveAsText: 'Enregistrer plutôt comme texte',
		on: 'Oui (true)',
		off: 'Non (false)',
		type: 'Type :',
		changeType: 'Changer de type…',
		changeTypeWarning:
			'Changer le type modifie ce que reçoit chaque écran qui lit cette clé. Vérifiez d’abord le code qui la lit.',
		description: 'Description',
		conflict:
			'Quelqu’un a modifié cette entrée depuis son ouverture. Rechargez pour voir sa modification, puis modifiez à nouveau.',
		confirmDelete: 'Supprimer « {key} » ? Tout ce qui la lit revient à sa valeur par défaut.',
		confirmDeleteIn:
			'Supprimer « {key} » de {env} ? Tout ce qui la lit revient à sa valeur par défaut.',
		history: 'Historique',
		unknownActor: 'inconnu',
		rollBack: 'Restaurer',
	},
	errors: {
		keyRequired: 'Saisissez une clé.',
		keyPattern:
			'Commencez par une lettre ; utilisez des lettres, des chiffres, « . », « _ » ou « - » (128 max).',
		exists: '« {key} » existe déjà dans {env} — ouvrez-la depuis la liste pour la modifier.',
		number: 'Saisissez un nombre.',
		boolean: 'Utilisez true ou false.',
		json: 'JSON non valide : {detail}',
	},
};
export default config;
