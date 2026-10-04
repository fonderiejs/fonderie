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
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
