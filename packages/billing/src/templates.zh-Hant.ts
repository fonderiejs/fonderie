import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type BillingMessageKey } from './config';

// Traditional Chinese copy of every built-in billing email. Same keys, parts,
// {{variables}} and {{#sections}} as the English (./templates.ts) — the
// coverage test checks they match. Written for Traditional readers (帳單,
// 信用卡, 儲值), not converted character by character from the Simplified copy.
// Amounts arrive already formatted (`*Display` fields).
export const ZH_HANT_TEMPLATES = {
	[MESSAGE_KEYS.subscriptionCanceled]: {
		subject: '您的訂閱已取消',
		html: `<h1>您的訂閱已取消</h1>
<p>您的 <strong>{{plan}}</strong> 方案訂閱已取消。</p>
<p>在目前的計費週期結束前，您仍可使用付費功能，之後您的帳戶將轉為免費方案。您的資料將完整保留。</p>
<p class="muted">改變主意了嗎？您隨時可以在帳單設定中重新訂閱。</p>`,
		text: `您的訂閱已取消

您的 {{plan}} 方案訂閱已取消。

在目前的計費週期結束前，您仍可使用付費功能，之後您的帳戶將轉為免費方案。您的資料將完整保留。

改變主意了嗎？您隨時可以在帳單設定中重新訂閱。`,
	},

	[MESSAGE_KEYS.paymentFailed]: {
		subject: '您的付款未能完成',
		html: `<h1>您的付款未能完成</h1>
<p>我們無法處理您最近的一筆付款，通常是因為信用卡已過期或遭到拒絕。</p>
<p>如需繼續使用付費功能，請在帳單設定中更新您的付款方式。</p>
<p class="muted">我們會在接下來幾天自動重試。如果仍然失敗，您的帳戶將轉為免費方案，您的資料絕不會被刪除。</p>`,
		text: `您的付款未能完成

我們無法處理您最近的一筆付款，通常是因為信用卡已過期或遭到拒絕。

如需繼續使用付費功能，請在帳單設定中更新您的付款方式。

我們會在接下來幾天自動重試。如果仍然失敗，您的帳戶將轉為免費方案，您的資料絕不會被刪除。`,
	},

	[MESSAGE_KEYS.trialEnding]: {
		subject: '您的試用即將結束',
		html: `<h1>您的 {{plan}} 試用即將結束</h1>
<p>您的 <strong>{{plan}}</strong> 方案免費試用即將結束。</p>
<p>如要不中斷地繼續使用這些功能，請在試用結束前於帳單設定中新增付款方式。</p>
<p class="muted">如果您不做任何操作，試用結束後您的帳戶會直接轉為免費方案。不會收取任何費用，您的資料也會保留。</p>`,
		text: `您的 {{plan}} 試用即將結束

您的 {{plan}} 方案免費試用即將結束。

如要不中斷地繼續使用這些功能，請在試用結束前於帳單設定中新增付款方式。

如果您不做任何操作，試用結束後您的帳戶會直接轉為免費方案。不會收取任何費用，您的資料也會保留。`,
	},

	[MESSAGE_KEYS.renewalReceipt]: {
		subject: '您的訂閱已續訂',
		html: `<h1>您的訂閱已續訂</h1>
<p>感謝您的支持，您的訂閱已續訂一個新的計費週期。</p>
<p>您隨時可以在帳單設定中查看明細收據（發票 <strong>{{invoiceId}}</strong>）。</p>
<p class="muted">您無須採取任何行動，我們只是想確認一切都已就緒。</p>`,
		text: `您的訂閱已續訂

感謝您的支持，您的訂閱已續訂一個新的計費週期。

您隨時可以在帳單設定中查看明細收據（發票 {{invoiceId}}）。

您無須採取任何行動，我們只是想確認一切都已就緒。`,
	},

	[MESSAGE_KEYS.limitWarning]: {
		subject: '您的 {{key}} 用量即將達到上限',
		html: `<h1>您的 {{key}} 用量即將達到上限</h1>
<p>您在 <strong>{{plan}}</strong> 方案中已使用 <strong>{{used}} / {{limit}}</strong> {{key}}。</p>
<p>本計費週期的用量即將達到上限。升級只需一分鐘，即可獲得更高的額度。</p>`,
		text: `您的 {{key}} 用量即將達到上限

您在 {{plan}} 方案中已使用 {{used}} / {{limit}} {{key}}。

本計費週期的用量即將達到上限。升級只需一分鐘，即可獲得更高的額度。`,
	},

	[MESSAGE_KEYS.limitReached]: {
		subject: '您的 {{key}} 用量已達到上限',
		html: `<h1>您的 {{key}} 用量已達到上限</h1>
<p>本計費週期內，您在 <strong>{{plan}}</strong> 方案中的 {{key}} 用量已達到上限（<strong>{{used}} / {{limit}}</strong>）。</p>
<p>在週期重設或您升級到更高方案之前，將無法繼續使用。</p>`,
		text: `您的 {{key}} 用量已達到上限

本計費週期內，您在 {{plan}} 方案中的 {{key}} 用量已達到上限（{{used}} / {{limit}}）。

在週期重設或您升級到更高方案之前，將無法繼續使用。`,
	},

	[MESSAGE_KEYS.creditsLow]: {
		subject: '您的餘額不足',
		html: `<h1>您的餘額不足</h1>
<p>您的餘額為 <strong>{{balanceDisplay}}</strong>，已達到或低於您設定的 {{thresholdDisplay}} 提醒額度。</p>
<p>請在帳單設定中儲值，以免服務中斷。</p>`,
		text: `您的餘額不足

您的餘額為 {{balanceDisplay}}，已達到或低於您設定的 {{thresholdDisplay}} 提醒額度。

請在帳單設定中儲值，以免服務中斷。`,
	},

	[MESSAGE_KEYS.paymentReceipt]: {
		subject: '您的收據',
		html: `<h1>收據</h1>
<p style="font-size:28px;font-weight:700;margin:0 0 4px 0;">{{amountPaidDisplay}}</p>
<p class="muted" style="margin:0 0 20px 0;">信用卡付款</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;font-size:15px;">
	<tr><td style="padding:6px 0;">{{packName}}</td><td align="right" style="padding:6px 0;">{{amountPaidDisplay}}</td></tr>
	<tr><td style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">實付總額</td><td align="right" style="padding:10px 0 6px 0;border-top:1px solid #e0e0e0;font-weight:600;">{{amountPaidDisplay}}</td></tr>
</table>
<p>您目前的餘額為 <strong>{{balanceAfterDisplay}}</strong>。</p>
{{#invoiceNumber}}<p class="muted">發票 {{invoiceNumber}}</p>{{/invoiceNumber}}
{{#invoicePdf}}<p><a href="{{invoicePdf}}" target="_blank" rel="noopener noreferrer">下載發票（PDF）</a></p>{{/invoicePdf}}
<p class="muted">您隨時可以在帳單設定中查看完整的帳單紀錄。</p>`,
		text: `收據

已付款 {{amountPaidDisplay}}

{{packName}} ....... {{amountPaidDisplay}}
實付總額 ....... {{amountPaidDisplay}}

您目前的餘額為 {{balanceAfterDisplay}}。

{{#invoiceNumber}}發票 {{invoiceNumber}}{{/invoiceNumber}}
{{#invoicePdf}}下載發票（PDF）：{{invoicePdf}}{{/invoicePdf}}

您隨時可以在帳單設定中查看完整的帳單紀錄。`,
	},

	[MESSAGE_KEYS.refundProcessed]: {
		subject: '您的退款已處理',
		html: `<h1>您的退款已處理</h1>
<p>一筆退款已處理完成。已從您的餘額扣回 <strong>{{creditsDisplay}}</strong>，您目前的餘額為 <strong>{{balanceAfterDisplay}}</strong>。</p>
<p class="muted">退回原付款方式的款項可能需要幾個工作天才會顯示。</p>`,
		text: `您的退款已處理

一筆退款已處理完成。已從您的餘額扣回 {{creditsDisplay}}，您目前的餘額為 {{balanceAfterDisplay}}。

退回原付款方式的款項可能需要幾個工作天才會顯示。`,
	},

	[MESSAGE_KEYS.autoRechargeFailed]: {
		subject: '自動儲值未能完成',
		html: `<h1>自動儲值未能完成</h1>
<p>我們嘗試為您的餘額自動儲值，但付款未能完成，通常是因為信用卡已過期、遭到拒絕或需要確認。</p>
<p>請在帳單設定中更新您的付款方式，以維持自動儲值功能。</p>`,
		text: `自動儲值未能完成

我們嘗試為您的餘額自動儲值，但付款未能完成，通常是因為信用卡已過期、遭到拒絕或需要確認。

請在帳單設定中更新您的付款方式，以維持自動儲值功能。`,
	},
} satisfies Record<BillingMessageKey, IDefaultTemplateCopy>;
