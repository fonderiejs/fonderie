import type en from '../en/environment';

const environment: typeof en = {
	title: 'Entorno',
	lead: 'Si cada módulo está configurado y si cada variable que lee la aplicación está definida. Los valores nunca se muestran.',
	missingCount: 'faltan {n}',
	allSet: 'todas definidas',
	variables: 'Variables',
	noVariables: 'No hay variables declaradas: pasa `env` a AdminModule.',
	moduleReadiness: 'Estado de los módulos',
	problemOne: '1 problema',
	problemMany: '{n} problemas',
};
export default environment;
