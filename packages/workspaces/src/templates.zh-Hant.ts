import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type WorkspacesMessageKey } from './config';

// Traditional Chinese copy of the built-in workspaces email — same keys and
// {{variables}} as the English (./templates.ts); the coverage test checks they match.
export const ZH_HANT_TEMPLATES = {
	[MESSAGE_KEYS.workspaceInvitation]: {
		subject: '您已獲邀加入 {{workspaceName}}',
		html: `<h1>您已獲邀加入團隊</h1>
<p>您已獲邀加入 <strong>{{workspaceName}}</strong>{{#inviterName}}（邀請人：{{inviterName}}）{{/inviterName}}。</p>
{{#acceptUrl}}<p><a href="{{acceptUrl}}" target="_blank" rel="noopener noreferrer">接受邀請</a></p>{{/acceptUrl}}
<p>您的邀請碼：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">在邀請頁面輸入此邀請碼即可加入團隊。</p>`,
		text: `您已獲邀加入團隊

您已獲邀加入 {{workspaceName}}{{#inviterName}}（邀請人：{{inviterName}}）{{/inviterName}}。
{{#acceptUrl}}
接受邀請：{{acceptUrl}}
{{/acceptUrl}}
您的邀請碼：{{pin}}

在邀請頁面輸入此邀請碼即可加入團隊。`,
	},
	[MESSAGE_KEYS.memberRemoved]: {
		subject: '你已被移出 {{workspaceName}}',
		html: `<h1>你已被移出團隊</h1>
<p>你已不再是 <strong>{{workspaceName}}</strong> 的成員{{#actorName}}：{{actorName}} 將你移出{{/actorName}}。</p>
<p class="muted">如果這不在你的預期之內，請聯絡團隊擁有者。</p>`,
		text: `你已被移出團隊

你已不再是 {{workspaceName}} 的成員{{#actorName}}：{{actorName}} 將你移出{{/actorName}}。

如果這不在你的預期之內，請聯絡團隊擁有者。`,
	},
	[MESSAGE_KEYS.memberRemovedAlert]: {
		subject: '{{actorName}} 已將 {{memberName}} 移出 {{workspaceName}}',
		html: `<h1>有成員被移出</h1>
<p><strong>{{actorName}}</strong> 已將 <strong>{{memberName}}</strong> 移出 <strong>{{workspaceName}}</strong>。</p>
<p class="muted">因為你是團隊擁有者，所以通知你。如果這不在預期之內，你可以重新邀請對方，並檢查誰在管理團隊。</p>`,
		text: `有成員被移出

{{actorName}} 已將 {{memberName}} 移出 {{workspaceName}}。

因為你是團隊擁有者，所以通知你。如果這不在預期之內，你可以重新邀請對方，並檢查誰在管理團隊。`,
	},
	[MESSAGE_KEYS.managerRemoved]: {
		subject: '你已不再是 {{workspaceName}} 的管理員',
		html: `<h1>你的管理權限已被移除</h1>
<p>你仍是 <strong>{{workspaceName}}</strong> 的成員，但已無法再管理團隊。</p>
<p class="muted">如果這不在你的預期之內，請聯絡團隊擁有者。</p>`,
		text: `你的管理權限已被移除

你仍是 {{workspaceName}} 的成員，但已無法再管理團隊。

如果這不在你的預期之內，請聯絡團隊擁有者。`,
	},
	[MESSAGE_KEYS.ownershipOffered]: {
		subject: '{{ownerName}} 想讓你成為 {{workspaceName}} 的擁有者',
		html: `<h1>有人向你轉讓團隊</h1>
<p><strong>{{ownerName}}</strong> 想讓你成為 <strong>{{workspaceName}}</strong> 的擁有者。</p>
<p class="muted">開啟應用程式以接受或拒絕。此邀請將在 7 天後失效。成為擁有者後，你將決定誰來管理團隊。</p>`,
		text: `有人向你轉讓團隊

{{ownerName}} 想讓你成為 {{workspaceName}} 的擁有者。

開啟應用程式以接受或拒絕。此邀請將在 7 天後失效。成為擁有者後，你將決定誰來管理團隊。`,
	},
	[MESSAGE_KEYS.ownershipAccepted]: {
		subject: '{{newOwnerName}} 現在是 {{workspaceName}} 的擁有者',
		html: `<h1>你的團隊有了新擁有者</h1>
<p><strong>{{newOwnerName}}</strong> 已接受，現在是 <strong>{{workspaceName}}</strong> 的擁有者。你仍然可以管理團隊。</p>
<p class="muted">如果你沒有發出此邀請，請立即聯絡對方和你的支援團隊。</p>`,
		text: `你的團隊有了新擁有者

{{newOwnerName}} 已接受，現在是 {{workspaceName}} 的擁有者。你仍然可以管理團隊。

如果你沒有發出此邀請，請立即聯絡對方和你的支援團隊。`,
	},
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
