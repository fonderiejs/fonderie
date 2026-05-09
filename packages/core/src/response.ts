export const HTTP = {
	OK:                  200,
	CREATED:             201,
	ACCEPTED:            202,
	NO_CONTENT:          204,
	BAD_REQUEST:         400,
	UNAUTHORIZED:        401,
	PAYMENT_REQUIRED:    402,
	FORBIDDEN:           403,
	NOT_FOUND:           404,
	CONFLICT:            409,
	GONE:                410,
	UNPROCESSABLE:       422,
	TOO_MANY_REQUESTS:   429,
	SERVER_ERROR:        500,
	NOT_IMPLEMENTED:     501,
	BAD_GATEWAY:         502,
	SERVICE_UNAVAILABLE: 503,
} as const

export type HttpStatus = typeof HTTP[keyof typeof HTTP]

export interface IApiEnvelope {
	reason:      string
	explanation: string
	result?:     unknown
}

export interface IApiError {
	reason:      string
	explanation: string
	details?:    unknown
}

export function setApiResponse<T>(
	status:      number,
	reason:      string,
	explanation: string,
	payload?:    T,
): Response {
	const body: Record<string, unknown> = { reason, explanation };
	if (payload !== undefined) {
		body[status < 400 ? 'result' : 'details'] = payload;
	}
	return Response.json(body, { status });
}

/** @deprecated Use setApiResponse with HTTP constants instead */
export function setSuccessResponse<T>(
	status:      number,
	reason:      string,
	explanation: string,
	result?:     T,
): Response {
	return setApiResponse(status, reason, explanation, result);
}

/** @deprecated Use setApiResponse with HTTP constants instead */
export function setErrorResponse(
	status:      number,
	reason:      string,
	explanation: string,
	details?:    unknown,
): Response {
	return setApiResponse(status, reason, explanation, details);
}
