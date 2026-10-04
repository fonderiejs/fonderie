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
} satisfies Record<WorkspacesMessageKey, IDefaultTemplateCopy>;
