import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type AuthMessageKey } from './config';

// Simplified Chinese copy of the built-in auth emails — same keys, parts and
// {{variables}} as the English (./templates.ts); the coverage test checks they match.
export const ZH_HANS_TEMPLATES = {
	[MESSAGE_KEYS.emailRegistration]: {
		subject: '确认您的账户',
		html: `<h1>欢迎加入</h1>
<p>{{firstName}}，您好：</p>
<p>感谢您的注册。请使用以下验证码确认您的账户：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">此验证码将在 24 小时后失效。如果您没有创建账户，请忽略此邮件。</p>`,
		text: `欢迎加入

{{firstName}}，您好：

感谢您的注册。请使用以下验证码确认您的账户：{{pin}}

此验证码将在 24 小时后失效。如果您没有创建账户，请忽略此邮件。`,
	},

	[MESSAGE_KEYS.emailVerification]: {
		subject: '您的验证码',
		html: `<h1>验证您的电子邮箱</h1>
<p>{{firstName}}，您好：</p>
<p>请使用以下验证码完成账户设置：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">此验证码将在 24 小时后失效。如果您没有创建账户，请忽略此邮件。</p>`,
		text: `验证您的电子邮箱

{{firstName}}，您好：

请使用以下验证码完成账户设置：{{pin}}

此验证码将在 24 小时后失效。如果您没有创建账户，请忽略此邮件。`,
	},

	[MESSAGE_KEYS.passwordReset]: {
		subject: '重置您的密码',
		html: `<h1>重置您的密码</h1>
<p>我们收到了重置您密码的请求。请使用以下验证码继续：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">此验证码很快就会失效。如果您没有申请重置，无需任何操作，您的密码保持不变。</p>`,
		text: `重置您的密码

我们收到了重置您密码的请求。请使用以下验证码继续：{{pin}}

此验证码很快就会失效。如果您没有申请重置，无需任何操作，您的密码保持不变。`,
	},

	[MESSAGE_KEYS.phoneOtp]: {
		text: '您的验证码是 {{otp}}，10 分钟内有效。',
	},

	[MESSAGE_KEYS.mfaEnabled]: {
		subject: '双重验证已开启',
		html: `<h1>双重验证已开启</h1>
<p>您的账户刚刚开启了双重验证。今后登录时，您需要输入身份验证器应用中的验证码。</p>
<p class="muted">如果这不是您本人的操作，请立即联系客服，可能有人已经能够访问您的账户。</p>`,
		text: `双重验证已开启

您的账户刚刚开启了双重验证。今后登录时，您需要输入身份验证器应用中的验证码。

如果这不是您本人的操作，请立即联系客服，可能有人已经能够访问您的账户。`,
	},

	[MESSAGE_KEYS.mfaDisabled]: {
		subject: '双重验证已关闭',
		html: `<h1>双重验证已关闭</h1>
<p>您的账户刚刚关闭了双重验证。现在您的账户仅由密码保护。</p>
<p class="muted">如果这不是您本人的操作，请立即联系客服并重新开启双重验证，可能有人已经能够访问您的账户。</p>`,
		text: `双重验证已关闭

您的账户刚刚关闭了双重验证。现在您的账户仅由密码保护。

如果这不是您本人的操作，请立即联系客服并重新开启双重验证，可能有人已经能够访问您的账户。`,
	},

	[MESSAGE_KEYS.mfaBackupCodesRegenerated]: {
		subject: '您的备用验证码已重新生成',
		html: `<h1>已生成新的备用验证码</h1>
<p>您的账户刚刚生成了一组新的双重验证备用码。之前的备用码已全部失效。</p>
<p class="muted">如果这不是您本人的操作，请立即联系客服，可能有人已经能够访问您的账户。</p>`,
		text: `已生成新的备用验证码

您的账户刚刚生成了一组新的双重验证备用码。之前的备用码已全部失效。

如果这不是您本人的操作，请立即联系客服，可能有人已经能够访问您的账户。`,
	},

	[MESSAGE_KEYS.emailChanged]: {
		subject: '您的电子邮箱地址已更改',
		html: `<h1>您的电子邮箱已更改</h1>
<p>您账户的电子邮箱地址刚刚更改为 <strong>{{newEmail}}</strong>。</p>
<p class="muted">如果是您本人更改的，无需任何操作。如果不是，请立即联系客服，可能有人已经能够访问您的账户。</p>`,
		text: `您的电子邮箱已更改

您账户的电子邮箱地址刚刚更改为 {{newEmail}}。

如果是您本人更改的，无需任何操作。如果不是，请立即联系客服，可能有人已经能够访问您的账户。`,
	},

	[MESSAGE_KEYS.phoneChanged]: {
		subject: '您的手机号码已更改',
		html: `<h1>您的手机号码已更改</h1>
<p>您账户的手机号码刚刚完成更新。</p>
<p class="muted">如果是您本人更改的，无需任何操作。如果不是，请立即联系客服，可能有人已经能够访问您的账户。</p>`,
		text: `您的手机号码已更改

您账户的手机号码刚刚完成更新。

如果是您本人更改的，无需任何操作。如果不是，请立即联系客服，可能有人已经能够访问您的账户。`,
	},

	[MESSAGE_KEYS.passwordRevoked]: {
		subject: '您账户的密码已被移除',
		html: `<h1>您的密码已被移除</h1>
<p>您刚刚使用 <strong>{{provider}}</strong> 登录。此账户之前设置过密码，但该电子邮箱地址从未经过确认，因此我们无法确定密码是谁设置的，已将其移除。</p>
<p>使用 {{provider}} 登录不受影响。如果您还想设置密码，可以在账户设置中进行设置。</p>
<p class="muted">如果您从未在此设置过密码，可能有其他人曾试图用您的地址注册。您无需任何操作，此账户属于您。</p>`,
		text: `您的密码已被移除

您刚刚使用 {{provider}} 登录。此账户之前设置过密码，但该电子邮箱地址从未经过确认，
因此我们无法确定密码是谁设置的，已将其移除。

使用 {{provider}} 登录不受影响。如果您还想设置密码，可以在账户设置中进行设置。

如果您从未在此设置过密码，可能有其他人曾试图用您的地址注册。您无需任何操作，此账户属于您。`,
	},

	[MESSAGE_KEYS.oauthRegistration]: {
		subject: '欢迎使用 {{appName}}',
		html: `<h1>欢迎使用 {{appName}}</h1>
<p>您的账户已通过 <strong>{{provider}}</strong> 创建。今后随时可以使用同一个 {{provider}} 账户登录，无需记住密码。</p>
<p class="muted">如果您没有创建此账户，请联系客服。</p>`,
		text: `欢迎

您的账户已通过 {{provider}} 创建。今后随时可以使用同一个
{{provider}} 账户登录，无需记住密码。

如果您没有创建此账户，请联系客服。`,
	},

	[MESSAGE_KEYS.oauthLinked]: {
		subject: '您的账户新增了一种登录方式',
		html: `<h1>已添加 {{provider}} 登录</h1>
<p>现在也可以使用 <strong>{{provider}}</strong> 登录您的账户。</p>
<p class="muted">如果是您本人添加的，无需任何操作。如果不是，请立即联系客服并更改密码，可能有其他人能够以您的身份登录。</p>`,
		text: `已添加 {{provider}} 登录

现在也可以使用 {{provider}} 登录您的账户。

如果是您本人添加的，无需任何操作。如果不是，请立即联系客服并更改密码，
可能有其他人能够以您的身份登录。`,
	},

	[MESSAGE_KEYS.oauthUnlinked]: {
		subject: '您的账户移除了一种登录方式',
		html: `<h1>已移除 {{provider}} 登录</h1>
<p>已无法再使用 <strong>{{provider}}</strong> 登录。您的电子邮箱和密码仍然可用。</p>
<p class="muted">如果是您本人移除的，无需任何操作。如果不是，请立即联系客服。</p>`,
		text: `已移除 {{provider}} 登录

已无法再使用 {{provider}} 登录。您的电子邮箱和密码仍然可用。

如果是您本人移除的，无需任何操作。如果不是，请立即联系客服。`,
	},
} satisfies Record<AuthMessageKey, IDefaultTemplateCopy>;
