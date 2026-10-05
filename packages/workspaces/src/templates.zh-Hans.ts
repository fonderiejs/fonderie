import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';

// Simplified Chinese copy of the built-in workspaces email — same keys and
// {{variables}} as the English (./templates.ts); the coverage test checks they match.
export const ZH_HANS_TEMPLATES = {
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: '您已受邀加入 {{workspaceName}}',
		html: `<h1>您已受邀加入团队</h1>
<p>您已受邀加入 <strong>{{workspaceName}}</strong>{{#inviterName}}（邀请人：{{inviterName}}）{{/inviterName}}。</p>
{{#acceptUrl}}<p><a href="{{acceptUrl}}" target="_blank" rel="noopener noreferrer">接受邀请</a></p>{{/acceptUrl}}
<p>您的邀请码：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">在邀请页面输入此邀请码即可加入团队。</p>`,
		text: `您已受邀加入团队

您已受邀加入 {{workspaceName}}{{#inviterName}}（邀请人：{{inviterName}}）{{/inviterName}}。
{{#acceptUrl}}
接受邀请：{{acceptUrl}}
{{/acceptUrl}}
您的邀请码：{{pin}}

在邀请页面输入此邀请码即可加入团队。`,
	},
	[MESSAGE_KEYS.memberRemoved]: {
		subject: '你已被移出 {{workspaceName}}',
		html: `<h1>你已被移出团队</h1>
<p>你已不再是 <strong>{{workspaceName}}</strong> 的成员{{#actorName}}：{{actorName}} 将你移出{{/actorName}}。</p>
<p class="muted">如果这不在你的预期之内，请联系团队所有者。</p>`,
		text: `你已被移出团队

你已不再是 {{workspaceName}} 的成员{{#actorName}}：{{actorName}} 将你移出{{/actorName}}。

如果这不在你的预期之内，请联系团队所有者。`,
	},
	[MESSAGE_KEYS.memberRemovedAlert]: {
		subject: '{{actorName}} 已将 {{memberName}} 移出 {{workspaceName}}',
		html: `<h1>有成员被移出</h1>
<p><strong>{{actorName}}</strong> 已将 <strong>{{memberName}}</strong> 移出 <strong>{{workspaceName}}</strong>。</p>
<p class="muted">因为你是团队所有者，所以通知你。如果这不在预期之内，你可以重新邀请对方，并检查谁在管理团队。</p>`,
		text: `有成员被移出

{{actorName}} 已将 {{memberName}} 移出 {{workspaceName}}。

因为你是团队所有者，所以通知你。如果这不在预期之内，你可以重新邀请对方，并检查谁在管理团队。`,
	},
	[MESSAGE_KEYS.managerRemoved]: {
		subject: '你已不再是 {{workspaceName}} 的管理员',
		html: `<h1>你的管理权限已被移除</h1>
<p>你仍是 <strong>{{workspaceName}}</strong> 的成员，但已无法再管理团队。</p>
<p class="muted">如果这不在你的预期之内，请联系团队所有者。</p>`,
		text: `你的管理权限已被移除

你仍是 {{workspaceName}} 的成员，但已无法再管理团队。

如果这不在你的预期之内，请联系团队所有者。`,
	},
	[MESSAGE_KEYS.ownershipReceived]: {
		subject: '你现在是 {{workspaceName}} 的所有者',
		html: `<h1>你现在拥有一个团队</h1>
<p>你现在是 <strong>{{workspaceName}}</strong> 的所有者。</p>
{{#previousOwnerName}}<p>{{previousOwnerName}} 已将其转交给你。</p>{{/previousOwnerName}}
<p class="muted">作为所有者，你决定谁来管理团队，也只有你可以再次转让它。</p>`,
		text: `你现在拥有一个团队

你现在是 {{workspaceName}} 的所有者。
{{#previousOwnerName}}{{previousOwnerName}} 已将其转交给你。{{/previousOwnerName}}

作为所有者，你决定谁来管理团队，也只有你可以再次转让它。`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
