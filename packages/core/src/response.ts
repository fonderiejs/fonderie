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
	reason:      string,
	explanation: string,
	result?:     T,
	status = 200,
): Response {
	const body: Record<string, unknown> = { reason, explanation };
	if (result !== undefined) body['result'] = result;
	return Response.json(body, { status });
}

export function setErrorResponse(
	reason:      string,
	explanation: string,
	status = 400,
	details?: unknown,
): Response {
	const body: Record<string, unknown> = { reason, explanation };
	if (details !== undefined) body['details'] = details;
	return Response.json(body, { status });
}
