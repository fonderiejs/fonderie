import { stringOrEmpty, booleanOrFalse } from '@fonderie-js/core/parser';

import type {
	IWorkspace, IRole, IMember, IInvitation, IWorkspaceSettings,
} from '../types';

export interface IWorkspaceDTO {
	id:          string
	name:        string
	slug:        string
	type:        string
	description: string
	plan:        string
	ownerId:     string
	isArchived:  boolean
	archivedAt:  string
	createdAt:   string
	updatedAt:   string
}

export interface IRoleDTO {
	id:          string
	name:        string
	isSystem:    boolean
	active:      boolean
	description: string
	workspaceId: string
}

export interface IMemberDTO {
	userId:      string
	workspaceId: string
	roleId:      string
	roleName:    string
	confirmed:   boolean
	createdAt:   string
}

export interface IInvitationDTO {
	id:          string
	workspaceId: string
	email:       string
	roleId:      string
	token:       string
	status:      string
	expiresAt:   string
	createdAt:   string
}

export interface IWorkspaceSettingsDTO {
	locale:     string
	timezone:   string
	currency:   string
	dateFormat: string
	timeFormat: string
}

export function toWorkspaceDTO(ws: IWorkspace): IWorkspaceDTO {
	return {
		id:          stringOrEmpty(ws.id),
		name:        stringOrEmpty(ws.name),
		slug:        stringOrEmpty(ws.slug),
		type:        stringOrEmpty(ws.type),
		description: stringOrEmpty(ws.description),
		plan:        stringOrEmpty(ws.plan),
		ownerId:     stringOrEmpty(ws.ownerId),
		isArchived:  ws.archivedAt !== null,
		archivedAt:  stringOrEmpty(ws.archivedAt),
		createdAt:   stringOrEmpty(ws.createdAt),
		updatedAt:   stringOrEmpty(ws.updatedAt),
	}
}

export function toRoleDTO(role: IRole): IRoleDTO {
	return {
		id:          stringOrEmpty(role.id),
		name:        stringOrEmpty(role.name),
		isSystem:    booleanOrFalse(role.isSystem),
		active:      role.active !== false,
		description: stringOrEmpty(role.description),
		workspaceId: stringOrEmpty(role.workspaceId),
	}
}

export function toMemberDTO(m: IMember): IMemberDTO {
	return {
		userId:      stringOrEmpty(m.userId),
		workspaceId: stringOrEmpty(m.workspaceId),
		roleId:      stringOrEmpty(m.roleId),
		roleName:    stringOrEmpty(m.roleName),
		confirmed:   booleanOrFalse(m.confirmed),
		createdAt:   stringOrEmpty(m.createdAt),
	}
}

export function toInvitationDTO(inv: IInvitation): IInvitationDTO {
	return {
		id:          stringOrEmpty(inv.id),
		workspaceId: stringOrEmpty(inv.workspaceId),
		email:       stringOrEmpty(inv.email),
		roleId:      stringOrEmpty(inv.roleId),
		token:       stringOrEmpty(inv.token),
		status:      stringOrEmpty(inv.status),
		expiresAt:   stringOrEmpty(inv.expiresAt),
		createdAt:   stringOrEmpty(inv.createdAt),
	}
}

export function toSettingsDTO(s: IWorkspaceSettings): IWorkspaceSettingsDTO {
	return {
		locale:     stringOrEmpty(s.locale),
		timezone:   stringOrEmpty(s.timezone),
		currency:   stringOrEmpty(s.currency),
		dateFormat: stringOrEmpty(s.dateFormat),
		timeFormat: stringOrEmpty(s.timeFormat),
	}
}
