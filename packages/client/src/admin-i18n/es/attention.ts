import type en from '../en/attention';

const attention: typeof en = {
	title: 'Atención',
	lead: 'Lo que necesita tu atención en este despliegue',
	leadChecked: 'Lo que necesita tu atención en este despliegue · comprobado a las {time}',
	needsAction: 'Requiere acción',
	needsActionHint: 'errores por corregir',
	advice: 'Consejos',
	adviceHint: 'vale la pena revisarlos',
	modulesReady: 'Módulos listos',
	modulesReadyHint: 'admin {version}',
	routes: 'Rutas',
	running: 'Ejecutando las comprobaciones…',
	emptyTitle: 'Nada requiere tu atención',
	emptyBody: 'Todas las comprobaciones pasan. Comprobado el {time}.',
};
export default attention;
