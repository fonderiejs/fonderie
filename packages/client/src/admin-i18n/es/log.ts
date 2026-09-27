import type en from '../en/log';

const log: typeof en = {
	title: 'Registro de administración',
	lead: 'Cada solicitud realizada a través de esta consola, de la más reciente a la más antigua, incluidas las rechazadas.',
	off: 'El registro de administración está desactivado: proporciona un store a AdminModule.',
	empty: 'Todavía no hay solicitudes',
	colWhen: 'Fecha',
	colActor: 'Autor',
	colRequest: 'Solicitud',
	colStatus: 'Estado',
	colModule: 'Módulo',
};
export default log;
