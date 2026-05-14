export interface IAuditEvent {
	id:        string;
	type:      string;
	payload:   Record<string, unknown>;
	meta:      Record<string, unknown>;
	createdAt: Date;
}

export interface IAuditQuery {
	workspaceId: string;
	type?:       string;
	actorId?:    string;
	from?:       Date;
	to?:         Date;
	limit?:      number;
	cursor?:     string;  // opaque: base64(createdAt + ',' + id)
}
