import type en from '../en/routes';

const routes: typeof en = {
	title: 'Rutas',
	lead: 'Cada ruta expuesta, con su protección.',
	leadCount: '{n} rutas expuestas por este despliegue, con la protección que tiene cada una.',
	filterPlaceholder: 'Filtrar por ruta, método, módulo…',
	filterLabel: 'Filtrar rutas',
	colMethod: 'Método',
	colPath: 'Ruta',
	colGuard: 'Protección',
	colModule: 'Módulo',
	application: 'aplicación',
	noMatch: 'Ninguna ruta coincide con «{q}».',
};
export default routes;
