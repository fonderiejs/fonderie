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
	[MESSAGE_KEYS.managerPaused]: {
		subject: '{{memberName}} 在 {{workspaceName}} 中的删除权限已暂停',
		html: `<h1>删除已暂停</h1>
<p><strong>{{memberName}}</strong> 在 {{minutes}} 分钟内删除了 {{count}} 项 <strong>{{workspaceName}}</strong> 中的内容，因此在你核查之前无法再删除任何内容。</p>
<p class="muted">请查看活动记录和“最近删除”列表：所有删除的内容都可在 30 天内恢复。如果这是预期操作，请在“成员”页面解除暂停。</p>`,
		text: `删除已暂停

{{memberName}} 在 {{minutes}} 分钟内删除了 {{count}} 项 {{workspaceName}} 中的内容，因此在你核查之前无法再删除任何内容。

请查看活动记录和“最近删除”列表：所有删除的内容都可在 30 天内恢复。如果这是预期操作，请在“成员”页面解除暂停。`,
	},
	[MESSAGE_KEYS.ownershipOffered]: {
		subject: '{{ownerName}} 想让你成为 {{workspaceName}} 的所有者',
		html: `<h1>有人向你转让团队</h1>
<p><strong>{{ownerName}}</strong> 想让你成为 <strong>{{workspaceName}}</strong> 的所有者。</p>
<p class="muted">打开应用以接受或拒绝。此邀请将在 7 天后失效。成为所有者后，你将决定谁来管理团队。</p>`,
		text: `有人向你转让团队

{{ownerName}} 想让你成为 {{workspaceName}} 的所有者。

打开应用以接受或拒绝。此邀请将在 7 天后失效。成为所有者后，你将决定谁来管理团队。`,
	},
	[MESSAGE_KEYS.ownershipAccepted]: {
		subject: '{{newOwnerName}} 现在是 {{workspaceName}} 的所有者',
		html: `<h1>你的团队有了新所有者</h1>
<p><strong>{{newOwnerName}}</strong> 已接受，现在是 <strong>{{workspaceName}}</strong> 的所有者。你仍然可以管理团队。</p>
<p class="muted">如果你没有发出此邀请，请立即联系对方和你的支持团队。</p>`,
		text: `你的团队有了新所有者

{{newOwnerName}} 已接受，现在是 {{workspaceName}} 的所有者。你仍然可以管理团队。

如果你没有发出此邀请，请立即联系对方和你的支持团队。`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
