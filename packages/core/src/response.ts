export interface IApiError {
	code:     string
	message:  string
	details?: unknown
}

export function setApiResponse<T>(data: T, status = 200): Response {
	return Response.json(data, { status });
}

export function setErrorResponse(
	code:     string,
	message:  string,
	status  = 400,
	details?: unknown,
): Response {
	const body: IApiError = details !== undefined
		? { code, message, details }
		: { code, message };
	return Response.json(body, { status });
}
