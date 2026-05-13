import { randomUUID }          from 'node:crypto'
import type { Middleware }      from '@fonderie-js/core'
import type { Logger }          from '../logger'

export function requestLogger(logger: Logger): Middleware {
	return async (ctx, next) => {
		const requestId = randomUUID()
		const start     = Date.now()
		const method    = ctx.request.method
		const pathname  = new URL(ctx.request.url).pathname

		ctx.meta['requestId'] = requestId
		ctx.meta['logger']    = logger.child({ requestId })

		logger.info(`→ ${method} ${pathname}`, { requestId })

		const response = await next()

		const duration = Date.now() - start
		const status   = response.status
		const level    = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

		logger[level](`← ${status} ${method} ${pathname}`, {
			requestId,
			status,
			duration,
			...(ctx.user      ? { userId:      ctx.user.id }      : {}),
			...(ctx.workspace ? { workspaceId: ctx.workspace.id } : {}),
		})

		return response
	}
}
