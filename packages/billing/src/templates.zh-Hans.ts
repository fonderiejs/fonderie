import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type BillingMessageKey } from './config';

// Simplified Chinese copy of every built-in billing email. Same keys, parts,
// {{variables}} and {{#sections}} as the English (./templates.ts) — the
// coverage test checks they match. Amounts arrive already formatted
// (`*Display` fields), so no number formatting happens here.
export const ZH_HANS_TEMPLATES = {
	[MESSAGE_KEYS.subscriptionCanceled]: {
		subject: '您的订阅已取消',
		html: `<h1>您的订阅已取消</h1>
<p>您的 <strong>{{plan}}</strong> 方案订阅已取消。</p>
<p>在当前计费周期结束前，您仍可使用付费功能，之后您的账户将转为免费方案。您的数据将完整保留。</p>
<p class="muted">改变主意了？您可以随时在账单设置中重新订阅。</p>`,
		text: `您的订阅已取消

您的 {{plan}} 方案订阅已取消。

在当前计费周期结束前，您仍可使用付费功能，之后您的账户将转为免费方案。您的数据将完整保留。

改变主意了？您可以随时在账单设置中重新订阅。`,
	},

	[MESSAGE_KEYS.paymentFailed]: {
		subject: '您的付款未能成功',
		html: `<h1>您的付款未能成功</h1>
<p>我们无法处理您最近的一笔付款，通常是因为银行卡已过期或被拒绝。</p>
<p>如需继续使用付费功能，请在账单设置中更新您的付款方式。</p>
<p class="muted">我们会在接下来几天内自动重试。如果仍然失败，您的账户将转为免费方案，您的数据绝不会被删除。</p>`,
		text: `您的付款未能成功

我们无法处理您最近的一笔付款，通常是因为银行卡已过期或被拒绝。

如需继续使用付费功能，请在账单设置中更新您的付款方式。

我们会在接下来几天内自动重试。如果仍然失败，您的账户将转为免费方案，您的数据绝不会被删除。`,
	},

	[MESSAGE_KEYS.trialEnding]: {
		subject: '您的试用即将结束',
		html: `<h1>您的 {{plan}} 试用即将结束</h1>
<p>您的 <strong>{{plan}}</strong> 方案免费试用即将结束。</p>
<p>如需不间断地继续使用这些功能，请在试用结束前于账单设置中添加付款方式。</p>
<p class="muted">如果您不做任何操作，试用结束后您的账户将直接转为免费方案。不会产生任何费用，您的数据也将保留。</p>`,
		text: `您的 {{plan}} 试用即将结束

您的 {{plan}} 方案免费试用即将结束。

如需不间断地继续使用这些功能，请在试用结束前于账单设置中添加付款方式。

如果您不做任何操作，试用结束后您的账户将直接转为免费方案。不会产生任何费用，您的数据也将保留。`,
	},

	[MESSAGE_KEYS.renewalReceipt]: {
		subject: '您的订阅已续订',
		html: `<h1>您的订阅已续订</h1>
<p>感谢您的支持，您的订阅已续订一个新的计费周期。</p>
<p>您可以随时在账单设置中查看明细收据（发票 <strong>{{invoiceId}}</strong>）。</p>
<p class="muted">您无需任何操作，我们只是想确认一切已就绪。</p>`,
		text: `您的订阅已续订

感谢您的支持，您的订阅已续订一个新的计费周期。

您可以随时在账单设置中查看明细收据（发票 {{invoiceId}}）。

您无需任何操作，我们只是想确认一切已就绪。`,
	},

	[MESSAGE_KEYS.limitWarning]: {
		subject: '您的 {{key}} 用量即将达到上限',
		html: `<h1>您的 {{key}} 用量即将达到上限</h1>
<p>您在 <strong>{{plan}}</strong> 方案中已使用 <strong>{{used}} / {{limit}}</strong> {{key}}。</p>
<p>本计费周期的用量即将达到上限。升级只需一分钟，即可获得更高的额度。</p>`,
		text: `您的 {{key}} 用量即将达到上限

您在 {{plan}} 方案中已使用 {{used}} / {{limit}} {{key}}。

本计费周期的用量即将达到上限。升级只需一分钟，即可获得更高的额度。`,
	},

	[MESSAGE_KEYS.limitReached]: {
		subject: '您的 {{key}} 用量已达到上限',
		html: `<h1>您的 {{key}} 用量已达到上限</h1>
<p>本计费周期内，您在 <strong>{{plan}}</strong> 方案中的 {{key}} 用量已达到上限（<strong>{{used}} / {{limit}}</strong>）。</p>
<p>在周期重置或您升级到更高方案之前，将无法继续使用。</p>`,
		text: `您的 {{key}} 用量已达到上限

本计费周期内，您在 {{plan}} 方案中的 {{key}} 用量已达到上限（{{used}} / {{limit}}）。

在周期重置或您升级到更高方案之前，将无法继续使用。`,
	},

	[MESSAGE_KEYS.creditsLow]: {
		subject: '您的余额不足',
		html: `<h1>您的余额不足</h1>
<p>您的余额为 <strong>{{balanceDisplay}}</strong>，已达到或低于您设定的 {{thresholdDisplay}} 提醒额度。</p>
<p>请在账单设置中充值，以免服务中断。</p>`,
		text: `您的余额不足

您的余额为 {{balanceDisplay}}，已达到或低于您设定的 {{thresholdDisplay}} 提醒额度。

请在账单设置中充值，以免服务中断。`,
	},

	[MESSAGE_KEYS.paymentReceipt]: {
		subject: '您的收据',
		html: `<h1>收据</h1>
<p style="font-size:28px;font-weight:700;margin:0 0 4px 0;">{{amountPaidDisplay}}</p>
<p class="muted" style="margin:0 0 20px 0;">银行卡支付</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;font-size:15px;">
	<tr><td style="padding:6px 0;">{{packName}}</td><td align="right" style="padding:6px 0;">{{amountPaidDisplay}}</td></tr>
	<tr><td style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">实付总额</td><td align="right" style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">{{amountPaidDisplay}}</td></tr>
</table>
<p>您当前的余额为 <strong>{{balanceAfterDisplay}}</strong>。</p>
{{#invoiceNumber}}<p class="muted">发票 {{invoiceNumber}}</p>{{/invoiceNumber}}
{{#invoicePdf}}<p><a href="{{invoicePdf}}" target="_blank" rel="noopener noreferrer">下载发票（PDF）</a></p>{{/invoicePdf}}
<p class="muted">您可以随时在账单设置中查看完整的账单记录。</p>`,
		text: `收据

已支付 {{amountPaidDisplay}}

{{packName}} ....... {{amountPaidDisplay}}
实付总额 ....... {{amountPaidDisplay}}

您当前的余额为 {{balanceAfterDisplay}}。

{{#invoiceNumber}}发票 {{invoiceNumber}}{{/invoiceNumber}}
{{#invoicePdf}}下载发票（PDF）：{{invoicePdf}}{{/invoicePdf}}

您可以随时在账单设置中查看完整的账单记录。`,
	},

	[MESSAGE_KEYS.refundProcessed]: {
		subject: '您的退款已处理',
		html: `<h1>您的退款已处理</h1>
<p>一笔退款已处理完毕。已从您的余额中扣回 <strong>{{creditsDisplay}}</strong>，您当前的余额为 <strong>{{balanceAfterDisplay}}</strong>。</p>
<p class="muted">退回到原付款方式的款项可能需要几个工作日才会显示。</p>`,
		text: `您的退款已处理

一笔退款已处理完毕。已从您的余额中扣回 {{creditsDisplay}}，您当前的余额为 {{balanceAfterDisplay}}。

退回到原付款方式的款项可能需要几个工作日才会显示。`,
	},

	[MESSAGE_KEYS.autoRechargeFailed]: {
		subject: '自动充值未能完成',
		html: `<h1>自动充值未能完成</h1>
<p>我们尝试为您的余额自动充值，但付款未能完成，通常是因为银行卡已过期、被拒绝或需要确认。</p>
<p>请在账单设置中更新您的付款方式，以保持自动充值功能开启。</p>`,
		text: `自动充值未能完成

我们尝试为您的余额自动充值，但付款未能完成，通常是因为银行卡已过期、被拒绝或需要确认。

请在账单设置中更新您的付款方式，以保持自动充值功能开启。`,
	},
} satisfies Record<BillingMessageKey, IDefaultTemplateCopy>;
