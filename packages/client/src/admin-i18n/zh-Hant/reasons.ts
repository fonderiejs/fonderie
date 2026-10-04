import type en from '../en/reasons';

const reasons: typeof en = {
	admin: {
		CHECK_TIMED_OUT: '已在 {ms} 毫秒後逾時。',
		CHECK_THREW: '檢查程序當機：{detail}',
		CHECK_FAILED: '檢查失敗，但未說明原因。',
		MIGRATIONS_PENDING: '{module}：有 {count} 個遷移尚未套用：{files}',
		OPERATOR_KEY_INVALID: 'operatorKey 必須為 64 個十六進位字元（openssl rand -hex 32）。',
	},
	auth: {
		JWT_SECRET_TOO_SHORT: 'jwtSecret 至少須為 {min} 個字元（目前為 {got} 個）。',
		JWT_SECRET_PLACEHOLDER: 'jwtSecret 看起來是預留位置或開發用的值。',
		JWT_PREVIOUS_SECRET_WEAK: 'jwtPreviousSecrets[{index}] 太短或是預留位置，但仍會用於驗證權杖。',
		INSECURE_COOKIES:
			'secureCookies 已關閉：在正式環境中，登入 Cookie 可能透過未加密的 HTTP 傳輸。',
		GOOGLE_INCOMPLETE:
			'已設定 Google 登入但不完整：請設定用戶端 ID，以及用戶端密鑰與重新導向 URI（網頁登入）和／或原生用戶端 ID（App 登入）。',
		GOOGLE_SECRET_PLACEHOLDER:
			'Google 用戶端密鑰看起來是預留位置或開發用的值。',
		APPLE_INCOMPLETE:
			'已設定「使用 Apple 登入」，但缺少用戶端 ID、團隊 ID、金鑰 ID、私密金鑰或重新導向 URI。',
		APPLE_KEY_NOT_PEM:
			'Apple 私密金鑰不是 PEM 格式的 .p8 金鑰（應以 -----BEGIN PRIVATE KEY----- 開頭）。',
		GOOGLE_NATIVE_IDS_INVALID:
			'Google 原生用戶端 ID 必須是確切的用戶端 ID：空白或萬用字元項目會接受發給其他 App 的權杖。',
		APPLE_NATIVE_IDS_INVALID:
			'Apple 原生用戶端 ID 必須是確切的 Bundle ID：空白或萬用字元項目會接受發給其他 App 的權杖。',
		MFA_KEY_MISSING:
			'已啟用兩步驟登入但未設定 mfaSecretKey：驗證器密鑰以未加密方式儲存。請設定 32 位元組的金鑰（openssl rand -hex 32）。',
		MFA_KEY_INVALID: 'mfaSecretKey 必須為 64 個十六進位字元（openssl rand -hex 32）。',
	},
	billing: {
		PRICE_CHECK_FAILED: '無法執行價格檢查：{detail}',
		PRICE_NOT_FOUND: '{ref}：價格 {price} 在金流服務商端不存在。',
		PRICE_INACTIVE: '{ref}：價格 {price} 在金流服務商端未啟用。',
		PRICE_MISMATCH:
			'{ref}：目錄標示為 {declared}，但服務商收取 {actual}。已儲存卡片與自動儲值的購買依目錄計價；代管結帳則依服務商計價。',
		WEBHOOK_CHECK_FAILED: '無法執行 Webhook 檢查：{detail}',
		WEBHOOK_NOT_REGISTERED:
			'{url} 尚未註冊：該處處理的事件永遠不會送達。',
		WEBHOOK_DISABLED: '{url} 已在服務商端停用：不會傳送任何內容。',
		WEBHOOK_EVENTS_MISSING: '{url} 未訂閱 {events}：這些處理常式永遠不會執行。',
		WEBHOOK_API_VERSION:
			'{url} 以 {endpointVersion} 傳送內容；此應用程式讀取 {clientVersion}。發票內容會以寬鬆方式讀取，因此不會遺失資料，但仍應消除此差異：請以 {clientVersion} 重新建立端點（會產生新的簽署密鑰）。',
		DRIFT_CHECK_FAILED: '無法執行訂閱檢查：{detail}',
		SUBSCRIPTION_MISSING_AT_PROVIDER:
			'{subscriber}（{subscription}）：此處標示為 {status}，但服務商端沒有此訂閱：{impact}。',
		SUBSCRIPTION_FIELDS_DIFFER:
			'{subscriber}（{subscription}）：{fields} 不一致，此處為 {ours}，服務商端為 {theirs}：{impact}。',
		DRIFT_TRUNCATED: '僅比對了部分訂閱：{note}',
		NOTIFICATIONS_UNWIRED:
			'已啟用付款但無法通知顧客：請將事件匯流排與 resolveRecipient 傳給 BillingModule，以寄送收據、退款與付款失敗通知。',
		AUTO_RECHARGE_UNSUPPORTED:
			'方案 {plan} 啟用了自動儲值，但服務商 {provider} 無法向已儲存的卡片扣款，因此永遠不會發生。',
		AUTO_RECHARGE_UNKNOWN_PACK:
			'方案 {plan} 以點數包 {pack} 儲值，但該點數包不存在，請將其加入目錄。',
		ALLOWANCE_WITHOUT_WALLET:
			'方案 {plan} 提供餘額額度，但錢包已關閉，因此額度不會生效。',
		NEGATIVE_ROLLOVER_CAP:
			'方案 {plan} 的結轉上限為負值（{cap}），請使用 0 以上的數值、none 或 full。',
		WEBHOOK_SECRET_MISSING:
			'未設定訂閱 Webhook 密鑰：Stripe 對 /billing/webhook 的呼叫會失敗，續訂與取消永遠不會套用。',
		WALLET_WEBHOOK_SECRET_MISSING:
			'未設定錢包 Webhook 密鑰：Stripe 對 /billing/webhook/payment 的呼叫會失敗，購買的點數包永遠不會入帳。',
		PROVIDER_CANNOT_BE_ASKED: '金流服務商無法回應此檢查。',
		PUBLIC_URL_NOT_SET: '未設定公開 API URL，因此無法檢查 Webhook 端點。',
	},
	config: {
		NO_SECRET_ENCRYPTOR:
			'沒有機密加密金鑰：機密頁面會拒絕所有請求，而非以明文儲存。請設定 CONFIG_SECRET_KEY。',
	},
	core: {
		ADMIN_TOKEN_TOO_SHORT: '管理權杖至少須為 {min} 個字元（目前為 {got} 個）。',
		ADMIN_TOKEN_PLACEHOLDER: '管理權杖看起來是預留位置或開發用的值。',
	},
	courier: {
		CHANNEL_WITHOUT_PROVIDER:
			'有 {count} 種訊息類型透過 {channel} 傳送，但未設定任何 {channel} 服務商，因此會被靜默丟棄：{types}。',
		TEMPLATES_UNROUTED:
			'有 {count} 種訊息類型有範本但沒有管道，因此永遠不會送出：{types}。',
		SENDER_DNS_CHECK_FAILED: '無法執行寄件者 DNS 檢查：{detail}',
		SPF_MULTIPLE: '{domain} 上有 {count} 筆 SPF 記錄，收件端會視為完全沒有 SPF。',
		DMARC_MISSING:
			'{domain} 沒有 DMARC 記錄，收件端會自行判斷如何處理您的郵件。',
		DMARC_MONITORING_ONLY:
			'{domain} 的 DMARC 僅為監控模式（p=none），偽造的郵件仍會被投遞。待報告確認無誤後，請改為 quarantine 或 reject。',
		DKIM_KEY_MISSING:
			'{host} 沒有 DKIM 金鑰，以選擇器 {selector} 簽署的郵件無法驗證。',
		SPF_ABSENT_DKIM_ALIGNS:
			'{domain} 沒有 SPF 記錄；當您的服務商擁有退信路徑時，這是正常的，DMARC 會透過 DKIM 通過。',
		SPF_AND_DKIM_MISSING:
			'{domain} 沒有 SPF 記錄也沒有 DKIM 金鑰：DMARC 無法通過，因此郵件未經驗證。',
		SPF_ABSENT_DKIM_UNKNOWN:
			'{domain} 沒有 SPF 記錄。若您的服務商擁有退信路徑並發佈 DKIM 則無妨，請列出 DKIM 選擇器以便確認。',
	},
	events: {
		NO_INTEGRITY_KEY: '沒有完整性金鑰：事件記錄無法偵測竄改。',
		WEAK_INTEGRITY_KEY:
			'完整性金鑰太短或看起來是預留位置，事件簽章可能遭偽造。請以 openssl rand -hex 32 產生金鑰。',
		TRANSPORT_NOT_STARTED: '事件傳輸尚未啟動。',
		EVENT_TAMPERED: '事件 {event} 已與其簽章不符，表示已遭變更。',
		EVENTS_UNSIGNED: '有 {count} 個事件早於簽署機制，無法驗證。',
		EVENTS_RETIRED_KEY: '有 {count} 個事件在金鑰輪替前以已停用的金鑰簽署，確認為真實。',
		EVENT_DEAD: '{type}（{consumer}）所有重試皆失敗，將永遠不會送達：{error}',
		BACKLOG_STALE: '{consumer}：{waiting} 個等待中，最久的已等待 {minutes} 分鐘。',
	},
	values: {
		impact: {
			UNDER_GRANTING: '顧客缺少已付費的存取權限',
			OVER_GRANTING: '未付款卻已授予存取權限',
			METADATA: '僅細節不同，不影響存取權限',
		},
	},
};
export default reasons;
