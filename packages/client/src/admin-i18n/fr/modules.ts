import type en from '../en/modules';

const modules: typeof en = {
	title: 'Modules',
	lead: 'Chaque module installé, sa version et son état de préparation.',
	leadSummary: "{env} · admin {version} · journal d'administration {log} · {routes} routes",
	logOn: 'activé',
	logOff: 'désactivé',
	colModule: 'Module',
	colVersion: 'Version',
	colReadiness: 'État',
	colAdmin: 'Admin',
	notReported: 'non communiquée',
	describesAdmin: "décrit l'admin",
};
export default modules;
