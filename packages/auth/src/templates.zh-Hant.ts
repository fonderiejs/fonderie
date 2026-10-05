import type { IDefaultTemplateCopy } from '@fonderie/core';

import { MESSAGE_KEYS, type AuthMessageKey } from './config';

// Traditional Chinese copy of the built-in auth emails — same keys, parts and
// {{variables}} as the English (./templates.ts); the coverage test checks they
// match. Written for Traditional readers (帳戶, 電子郵件, 驗證器), not converted
// character by character from the Simplified copy.
export const ZH_HANT_TEMPLATES = {
	[MESSAGE_KEYS.emailRegistration]: {
		subject: '確認您的帳戶',
		html: `<h1>歡迎加入</h1>
<p>{{firstName}}，您好：</p>
<p>感謝您的註冊。請使用以下驗證碼確認您的帳戶：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">此驗證碼將於 24 小時後失效。如果您沒有建立帳戶，請略過這封郵件。</p>`,
		text: `歡迎加入

{{firstName}}，您好：

感謝您的註冊。請使用以下驗證碼確認您的帳戶：{{pin}}

此驗證碼將於 24 小時後失效。如果您沒有建立帳戶，請略過這封郵件。`,
	},

	[MESSAGE_KEYS.emailVerification]: {
		subject: '您的驗證碼',
		html: `<h1>驗證您的電子郵件</h1>
<p>{{firstName}}，您好：</p>
<p>請使用以下驗證碼完成帳戶設定：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">此驗證碼將於 24 小時後失效。如果您沒有建立帳戶，請略過這封郵件。</p>`,
		text: `驗證您的電子郵件

{{firstName}}，您好：

請使用以下驗證碼完成帳戶設定：{{pin}}

此驗證碼將於 24 小時後失效。如果您沒有建立帳戶，請略過這封郵件。`,
	},

	[MESSAGE_KEYS.passwordReset]: {
		subject: '重設您的密碼',
		html: `<h1>重設您的密碼</h1>
<p>我們收到重設您密碼的要求。請使用以下驗證碼繼續：</p>
<p><span class="pin-code">{{pin}}</span></p>
<p class="muted">此驗證碼即將失效。如果您沒有提出重設要求，無須採取任何行動，您的密碼維持不變。</p>`,
		text: `重設您的密碼

我們收到重設您密碼的要求。請使用以下驗證碼繼續：{{pin}}

此驗證碼即將失效。如果您沒有提出重設要求，無須採取任何行動，您的密碼維持不變。`,
	},

	[MESSAGE_KEYS.phoneOtp]: {
		text: '您的驗證碼是 {{otp}}，10 分鐘內有效。',
	},

	[MESSAGE_KEYS.mfaEnabled]: {
		subject: '雙重驗證已啟用',
		html: `<h1>雙重驗證已啟用</h1>
<p>您的帳戶剛剛啟用了雙重驗證。往後登入時，您需要輸入驗證器應用程式中的驗證碼。</p>
<p class="muted">如果這不是您本人的操作，請立即聯絡客服，可能有人已能存取您的帳戶。</p>`,
		text: `雙重驗證已啟用

您的帳戶剛剛啟用了雙重驗證。往後登入時，您需要輸入驗證器應用程式中的驗證碼。

如果這不是您本人的操作，請立即聯絡客服，可能有人已能存取您的帳戶。`,
	},

	[MESSAGE_KEYS.mfaDisabled]: {
		subject: '雙重驗證已停用',
		html: `<h1>雙重驗證已停用</h1>
<p>您的帳戶剛剛停用了雙重驗證。現在您的帳戶僅受密碼保護。</p>
<p class="muted">如果這不是您本人的操作，請立即聯絡客服並重新啟用雙重驗證，可能有人已能存取您的帳戶。</p>`,
		text: `雙重驗證已停用

您的帳戶剛剛停用了雙重驗證。現在您的帳戶僅受密碼保護。

如果這不是您本人的操作，請立即聯絡客服並重新啟用雙重驗證，可能有人已能存取您的帳戶。`,
	},

	[MESSAGE_KEYS.mfaBackupCodesRegenerated]: {
		subject: '您的備用驗證碼已重新產生',
		html: `<h1>已產生新的備用驗證碼</h1>
<p>您的帳戶剛剛產生了一組新的雙重驗證備用碼。先前的備用碼已全部失效。</p>
<p class="muted">如果這不是您本人的操作，請立即聯絡客服，可能有人已能存取您的帳戶。</p>`,
		text: `已產生新的備用驗證碼

您的帳戶剛剛產生了一組新的雙重驗證備用碼。先前的備用碼已全部失效。

如果這不是您本人的操作，請立即聯絡客服，可能有人已能存取您的帳戶。`,
	},

	[MESSAGE_KEYS.emailChanged]: {
		subject: '您的電子郵件地址已變更',
		html: `<h1>您的電子郵件已變更</h1>
<p>您帳戶的電子郵件地址剛剛變更為 <strong>{{newEmail}}</strong>。</p>
<p class="muted">如果是您本人變更的，無須採取任何行動。如果不是，請立即聯絡客服，可能有人已能存取您的帳戶。</p>`,
		text: `您的電子郵件已變更

您帳戶的電子郵件地址剛剛變更為 {{newEmail}}。

如果是您本人變更的，無須採取任何行動。如果不是，請立即聯絡客服，可能有人已能存取您的帳戶。`,
	},

	[MESSAGE_KEYS.phoneChanged]: {
		subject: '您的電話號碼已變更',
		html: `<h1>您的電話號碼已變更</h1>
<p>您帳戶的電話號碼剛剛完成更新。</p>
<p class="muted">如果是您本人變更的，無須採取任何行動。如果不是，請立即聯絡客服，可能有人已能存取您的帳戶。</p>`,
		text: `您的電話號碼已變更

您帳戶的電話號碼剛剛完成更新。

如果是您本人變更的，無須採取任何行動。如果不是，請立即聯絡客服，可能有人已能存取您的帳戶。`,
	},

	[MESSAGE_KEYS.passwordRevoked]: {
		subject: '您帳戶的密碼已被移除',
		html: `<h1>您的密碼已被移除</h1>
<p>您剛剛使用 <strong>{{provider}}</strong> 登入。此帳戶先前設定過密碼，但這個電子郵件地址從未經過確認，因此我們無法判斷密碼是誰設定的，已將其移除。</p>
<p>使用 {{provider}} 登入不受影響。如果您也想設定密碼，可以在帳戶設定中進行設定。</p>
<p class="muted">如果您從未在此設定過密碼，可能有其他人曾試圖用您的地址註冊。您無須採取任何行動，此帳戶屬於您。</p>`,
		text: `您的密碼已被移除

您剛剛使用 {{provider}} 登入。此帳戶先前設定過密碼，但這個電子郵件地址從未經過確認，
因此我們無法判斷密碼是誰設定的，已將其移除。

使用 {{provider}} 登入不受影響。如果您也想設定密碼，可以在帳戶設定中進行設定。

如果您從未在此設定過密碼，可能有其他人曾試圖用您的地址註冊。您無須採取任何行動，此帳戶屬於您。`,
	},

	[MESSAGE_KEYS.oauthRegistration]: {
		subject: '歡迎使用 {{appName}}',
		html: `<h1>歡迎使用 {{appName}}</h1>
<p>您的帳戶已透過 <strong>{{provider}}</strong> 建立。往後隨時都能使用同一個 {{provider}} 帳戶登入，不必記住密碼。</p>
<p class="muted">如果您沒有建立此帳戶，請聯絡客服。</p>`,
		text: `歡迎

您的帳戶已透過 {{provider}} 建立。往後隨時都能使用同一個
{{provider}} 帳戶登入，不必記住密碼。

如果您沒有建立此帳戶，請聯絡客服。`,
	},

	[MESSAGE_KEYS.oauthLinked]: {
		subject: '您的帳戶新增了一種登入方式',
		html: `<h1>已新增 {{provider}} 登入</h1>
<p>現在也可以使用 <strong>{{provider}}</strong> 登入您的帳戶。</p>
<p class="muted">如果是您本人新增的，無須採取任何行動。如果不是，請立即聯絡客服並變更密碼，可能有其他人能以您的身分登入。</p>`,
		text: `已新增 {{provider}} 登入

現在也可以使用 {{provider}} 登入您的帳戶。

如果是您本人新增的，無須採取任何行動。如果不是，請立即聯絡客服並變更密碼，
可能有其他人能以您的身分登入。`,
	},

	[MESSAGE_KEYS.oauthUnlinked]: {
		subject: '您的帳戶移除了一種登入方式',
		html: `<h1>已移除 {{provider}} 登入</h1>
<p>已無法再使用 <strong>{{provider}}</strong> 登入。您的電子郵件和密碼仍可使用。</p>
<p class="muted">如果是您本人移除的，無須採取任何行動。如果不是，請立即聯絡客服。</p>`,
		text: `已移除 {{provider}} 登入

已無法再使用 {{provider}} 登入。您的電子郵件和密碼仍可使用。

如果是您本人移除的，無須採取任何行動。如果不是，請立即聯絡客服。`,
	},

	[MESSAGE_KEYS.accountDeletionCode]: {
		subject: `確認刪除您的帳戶`,
		html: `<h1>確認刪除帳戶</h1>
<p>請使用此驗證碼確認您要刪除帳戶：</p>
<p><span class="pin-code">{{code}}</span></p>
<p class="muted">此驗證碼將在 15 分鐘後失效。如果您沒有申請刪除帳戶，請忽略此訊息並更改密碼，您的帳戶將保持不變。</p>`,
		text: `確認刪除帳戶的驗證碼：{{code}}，15 分鐘內有效。不是您本人操作？請忽略並更改密碼。`,
	},

	[MESSAGE_KEYS.accountDeletionScheduled]: {
		subject: `您的帳戶將於 {{deleteOn}} 刪除`,
		html: `<h1>您的帳戶已排定刪除</h1>
<p>我們已收到您的申請。您的帳戶已關閉，並將於 <strong>{{deleteOn}}</strong> 永久刪除。</p>
<p>改變主意了？請在該日期前登入並選擇<strong>保留我的帳戶</strong>。</p>
<p class="muted">如果這不是您本人的申請，請立即登入以保留帳戶並更改密碼。</p>`,
		text: `您的帳戶將於 {{deleteOn}} 永久刪除。改變主意了？請在此前登入並選擇「保留我的帳戶」。`,
	},

	[MESSAGE_KEYS.accountRestored]: {
		subject: `您的帳戶已恢復`,
		html: `<h1>歡迎回來</h1>
<p>您的帳戶刪除已取消，帳戶已重新啟用。</p>
<p class="muted">如果不是您本人操作，請立即更改密碼。</p>`,
		text: `您的帳戶刪除已取消，帳戶已重新啟用。不是您本人操作？請立即更改密碼。`,
	},

	[MESSAGE_KEYS.accountDeletionReminder]: {
		subject: `您的帳戶將於 {{deleteOn}} 刪除`,
		html: `<h1>您的帳戶即將被刪除</h1>
<p>依照您的申請，您的帳戶已關閉，並將於 <strong>{{deleteOn}}</strong> 永久刪除。此後將無法復原。</p>
<p>改變主意了？請在此前登入並選擇<strong>保留我的帳戶</strong>。</p>
<p class="muted">如果您仍希望刪除，無需任何操作。</p>`,
		text: `提醒：您的帳戶將於 {{deleteOn}} 永久刪除。改變主意了？請在此前登入並選擇「保留我的帳戶」。`,
	},
} satisfies Record<AuthMessageKey, IDefaultTemplateCopy>;
