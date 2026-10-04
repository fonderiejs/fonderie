import type en from '../en/reasons';

const reasons: typeof en = {
	admin: {
		CHECK_TIMED_OUT: '{ms} 毫秒后超时。',
		CHECK_THREW: '检查崩溃：{detail}',
		CHECK_FAILED: '检查失败，未说明原因。',
		MIGRATIONS_PENDING: '{module}：{count} 个迁移未应用——{files}',
		OPERATOR_KEY_INVALID: 'operatorKey 必须是 64 个十六进制字符（openssl rand -hex 32）。',
	},
	auth: {
		JWT_SECRET_TOO_SHORT: 'jwtSecret 至少需要 {min} 个字符（当前为 {got} 个）。',
		JWT_SECRET_PLACEHOLDER: 'jwtSecret 看起来像占位符或开发环境的值。',
		JWT_PREVIOUS_SECRET_WEAK: 'jwtPreviousSecrets[{index}] 太短或是占位符——它仍在用于验证令牌。',
		INSECURE_COOKIES: 'secureCookies 已关闭——在生产环境中，登录 Cookie 可能通过明文 HTTP 传输。',
		GOOGLE_INCOMPLETE:
			'Google 登录已配置但不完整：请设置客户端 ID，以及客户端密钥和重定向 URI（网页登录）和/或原生客户端 ID（应用登录）。',
		GOOGLE_SECRET_PLACEHOLDER: 'Google 客户端密钥看起来像占位符或开发环境的值。',
		APPLE_INCOMPLETE:
			'已配置“通过 Apple 登录”，但缺少客户端 ID、团队 ID、密钥 ID、私钥或重定向 URI。',
		APPLE_KEY_NOT_PEM: 'Apple 私钥不是 PEM 格式的 .p8 密钥（应以 -----BEGIN PRIVATE KEY----- 开头）。',
		GOOGLE_NATIVE_IDS_INVALID:
			'Google 原生客户端 ID 必须是确切的客户端 ID——空值或通配符条目会接受签发给其他应用的令牌。',
		APPLE_NATIVE_IDS_INVALID:
			'Apple 原生客户端 ID 必须是确切的 Bundle ID——空值或通配符条目会接受签发给其他应用的令牌。',
		MFA_KEY_MISSING:
			'已启用双重验证登录，但未设置 mfaSecretKey——身份验证器密钥以未加密方式存储。请设置一个 32 字节的密钥（openssl rand -hex 32）。',
		MFA_KEY_INVALID: 'mfaSecretKey 必须是 64 个十六进制字符（openssl rand -hex 32）。',
	},
	billing: {
		PRICE_CHECK_FAILED: '无法运行价格检查：{detail}',
		PRICE_NOT_FOUND: '{ref}：价格 {price} 在支付服务商处不存在。',
		PRICE_INACTIVE: '{ref}：价格 {price} 在支付服务商处未启用。',
		PRICE_MISMATCH:
			'{ref}：商品目录标注为 {declared}，而支付服务商实际收取 {actual}。已保存银行卡和自动充值的购买使用商品目录价格；托管结账使用服务商价格。',
		WEBHOOK_CHECK_FAILED: '无法运行 Webhook 检查：{detail}',
		WEBHOOK_NOT_REGISTERED: '{url} 未注册——该地址处理的事件永远不会到达。',
		WEBHOOK_DISABLED: '{url} 在支付服务商处已禁用——它不会发送任何内容。',
		WEBHOOK_EVENTS_MISSING: '{url} 未订阅 {events}——这些处理程序永远不会运行。',
		WEBHOOK_API_VERSION:
			'{url} 以 {endpointVersion} 格式发送数据；此应用读取的是 {clientVersion}。发票数据采用宽容解析，因此不会丢失任何内容，但仍应消除此差异：请在 {clientVersion} 上重新创建该端点（会生成新的签名密钥）。',
		DRIFT_CHECK_FAILED: '无法运行订阅检查：{detail}',
		SUBSCRIPTION_MISSING_AT_PROVIDER:
			'{subscriber}（{subscription}）：此处标记为 {status}，但支付服务商处不存在该订阅——{impact}。',
		SUBSCRIPTION_FIELDS_DIFFER:
			'{subscriber}（{subscription}）：{fields} 不一致——此处为 {ours}，支付服务商处为 {theirs}——{impact}。',
		DRIFT_TRUNCATED: '仅比对了部分订阅：{note}',
		NOTIFICATIONS_UNWIRED:
			'已启用支付，但无法通知客户——请向 BillingModule 传入事件总线和 resolveRecipient，以便发送收据、退款和付款失败通知。',
		AUTO_RECHARGE_UNSUPPORTED:
			'套餐 {plan} 启用了自动充值，但支付服务商 {provider} 无法从已保存的银行卡扣款——自动充值永远不会发生。',
		AUTO_RECHARGE_UNKNOWN_PACK:
			'套餐 {plan} 使用额度包 {pack} 充值，但该额度包不存在——请将其添加到商品目录。',
		ALLOWANCE_WITHOUT_WALLET:
			'套餐 {plan} 提供余额配额，但钱包已关闭——该配额不起作用。',
		NEGATIVE_ROLLOVER_CAP:
			'套餐 {plan} 的结转上限为负数（{cap}）——请使用 0 或更大的值、none 或 full。',
		WEBHOOK_SECRET_MISSING:
			'未设置订阅 Webhook 密钥——Stripe 对 /billing/webhook 的调用会失败，续订和取消永远不会生效。',
		WALLET_WEBHOOK_SECRET_MISSING:
			'未设置钱包 Webhook 密钥——Stripe 对 /billing/webhook/payment 的调用会失败，额度包购买永远不会入账。',
		PROVIDER_CANNOT_BE_ASKED: '支付服务商无法响应此检查。',
		PUBLIC_URL_NOT_SET: '未设置公开 API URL，因此无法检查 Webhook 端点。',
	},
	config: {
		NO_SECRET_ENCRYPTOR:
			'没有密钥加密密钥——密钥页面会拒绝所有请求，而不是存储明文。请设置 CONFIG_SECRET_KEY。',
	},
	core: {
		ADMIN_TOKEN_TOO_SHORT: '管理令牌至少需要 {min} 个字符（当前为 {got} 个）。',
		ADMIN_TOKEN_PLACEHOLDER: '管理令牌看起来像占位符或开发环境的值。',
	},
	courier: {
		CHANNEL_WITHOUT_PROVIDER:
			'有 {count} 种消息类型通过 {channel} 发送，但未设置 {channel} 服务商——它们会被静默丢弃：{types}。',
		TEMPLATES_UNROUTED: '有 {count} 种消息类型有模板但没有渠道，因此永远不会被投递：{types}。',
		SENDER_DNS_CHECK_FAILED: '无法运行发件人 DNS 检查：{detail}',
		SPF_MULTIPLE: '{domain} 上有 {count} 条 SPF 记录——收件方会将其视为完全没有 SPF。',
		DMARC_MISSING: '{domain} 没有 DMARC 记录——收件方会自行判断如何处理您的邮件。',
		DMARC_MONITORING_ONLY:
			'{domain} 的 DMARC 仅处于监控模式（p=none），伪造的邮件仍会被投递。报告正常后，请改为 quarantine 或 reject。',
		DKIM_KEY_MISSING: '{host} 处没有 DKIM 密钥——使用选择器 {selector} 签名的邮件无法被验证。',
		SPF_ABSENT_DKIM_ALIGNS:
			'{domain} 上没有 SPF 记录，当您的服务商拥有退信路径时这是正常的；DMARC 通过 DKIM 验证。',
		SPF_AND_DKIM_MISSING:
			'{domain} 上没有 SPF 记录，也没有 DKIM 密钥——DMARC 无法通过，因此邮件未经身份验证。',
		SPF_ABSENT_DKIM_UNKNOWN:
			'{domain} 上没有 SPF 记录。如果您的服务商拥有退信路径并发布了 DKIM，则没有问题——请列出 DKIM 选择器以便确认。',
	},
	events: {
		NO_INTEGRITY_KEY: '没有完整性密钥——事件日志无法防篡改。',
		WEAK_INTEGRITY_KEY:
			'完整性密钥太短或看起来像占位符——事件签名可能被伪造。请使用 openssl rand -hex 32 生成一个。',
		TRANSPORT_NOT_STARTED: '事件传输尚未启动。',
		EVENT_TAMPERED: '事件 {event} 与其签名不再匹配——它已被篡改。',
		EVENTS_UNSIGNED: '有 {count} 个事件早于签名功能启用，无法验证。',
		EVENTS_RETIRED_KEY: '有 {count} 个事件在密钥轮换前使用已停用的密钥签名——它们是真实的。',
		EVENT_DEAD: '{type}（{consumer}）在所有重试中均失败，将永远不会被投递：{error}',
		BACKLOG_STALE: '{consumer}：{waiting} 个待处理，最早的已等待 {minutes} 分钟。',
	},
	values: {
		impact: {
			UNDER_GRANTING: '客户缺少其已付费的访问权限',
			OVER_GRANTING: '未付费即授予了访问权限',
			METADATA: '仅细节不同，不影响访问权限',
		},
	},
};
export default reasons;
