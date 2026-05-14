import type { IEventMeta, IEventHandler } from '../types'

export interface IEventTransport {
	publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>
	subscribe(type: string, handler: IEventHandler): void
	start(): Promise<void>
	stop():  Promise<void>
}
