// Shared, composable email layout — a branded shell that wraps every template
// body. Templates stored in the DB or on disk are **body fragments**; the
// resolver injects them into `{{content}}` here, then interpolates `{{vars}}`
// over the whole. One shell, many bodies — so DB and FS sources render an
// identical, production-grade frame for free.
//
// Cross-client hardening (Outlook/Gmail/Apple Mail) follows the well-worn
// "hybrid responsive" pattern popularised by Cerberus (MIT): a max-width table
// container, inline styles on the critical structure, and a `<style>` block in
// `<head>` for the friendly classes and small-screen media query. Founders can
// override the whole shell by storing a `_layout` template (DB row or
// `_layout.html` file) in their own source.
//
// The theme tokens mirror the product design system (organization/ui/base.css):
// near-black primary, a mint brand accent, Inter, and the `#fafafa` canvas —
// retune `EMAIL_THEME` to rebrand every email at once.

// A single small token set — retune these to match your brand.
export const EMAIL_THEME = {
	brand: 'Fonderie',
	accent: '#171717', // primary action (button) background — the product's primary
	accentText: '#ffffff', // text on the accent
	brandAccent: '#171717', // brand highlight (top rule) — monochrome near-black
	link: '#009767', // links — the accessible (darkened) brand teal
	ink: '#171717', // body copy
	muted: '#5c5c5c', // secondary copy
	line: '#e0e0e0', // hairline borders
	canvas: '#fafafa', // page background behind the card
	card: '#ffffff', // the card itself
} as const;

// The product font stack (Inter first, with system fallbacks for clients that
// lack it). Shared by every text element so the frame stays consistent.
const FONT_SANS =
	"Inter, 'Inter Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

// The `{{content}}` marker is replaced with the body fragment BEFORE variable
// interpolation, so a body's own `{{firstName}}` etc. still resolve.
export const LAYOUT_CONTENT_SLOT = '{{content}}';

export const DEFAULT_EMAIL_LAYOUT = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="color-scheme" content="light dark">
	<meta name="supported-color-schemes" content="light dark">
	<title>{{subject}}</title>
	<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
	<style>
		body { margin: 0; padding: 0; width: 100% !important; background: ${EMAIL_THEME.canvas}; }
		.email-body { background: ${EMAIL_THEME.canvas}; }
		.email-container { width: 100%; max-width: 560px; margin: 0 auto; }
		.email-card {
			background: ${EMAIL_THEME.card};
			border: 1px solid ${EMAIL_THEME.line};
			border-radius: 8px;
			overflow: hidden;
		}
		.email-accent { height: 3px; background: ${EMAIL_THEME.brandAccent}; font-size: 0; line-height: 0; }
		.email-header { padding: 28px 32px 0 32px; }
		.email-brand { font: 800 19px/1 ${FONT_SANS}; color: ${EMAIL_THEME.ink}; letter-spacing: -0.03em; }
		.email-content {
			padding: 20px 32px 8px 32px;
			font: 400 16px/1.7 ${FONT_SANS};
			color: ${EMAIL_THEME.ink};
			letter-spacing: -0.01em;
		}
		.email-content h1 { margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; font-weight: 700; letter-spacing: -0.03em; }
		.email-content p { margin: 0 0 16px 0; }
		.email-content a { color: ${EMAIL_THEME.link}; }
		.email-footer {
			padding: 16px 32px 28px 32px;
			font: 400 13px/1.6 ${FONT_SANS};
			color: ${EMAIL_THEME.muted};
			letter-spacing: -0.01em;
		}
		.btn {
			display: inline-block;
			background: ${EMAIL_THEME.accent};
			color: ${EMAIL_THEME.accentText} !important;
			text-decoration: none;
			font: 600 16px/1 ${FONT_SANS};
			letter-spacing: -0.01em;
			padding: 13px 26px;
			border-radius: 6px;
		}
		.pin-code {
			display: inline-block;
			font: 700 30px/1 ${FONT_MONO};
			letter-spacing: 0.28em;
			color: ${EMAIL_THEME.ink};
			background: ${EMAIL_THEME.canvas};
			border: 1px solid ${EMAIL_THEME.line};
			border-radius: 6px;
			padding: 14px 22px 14px 30px;
		}
		.muted { color: ${EMAIL_THEME.muted}; }
		@media only screen and (max-width: 599px) {
			.email-header, .email-content, .email-footer { padding-left: 22px !important; padding-right: 22px !important; }
			.pin-code { font-size: 26px !important; letter-spacing: 0.2em !important; }
		}
	</style>
</head>
<body class="email-body">
	<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preheader}}</div>
	<table role="presentation" class="email-body" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_THEME.canvas};">
		<tr>
			<td align="center" style="padding: 32px 16px;">
				<table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
					<tr>
						<td class="email-card" style="background:${EMAIL_THEME.card};border:1px solid ${EMAIL_THEME.line};border-radius:8px;">
							<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
								<tr><td class="email-accent" style="height:3px;background:${EMAIL_THEME.brandAccent};font-size:0;line-height:0;">&nbsp;</td></tr>
								<tr><td class="email-header" style="padding:28px 32px 0 32px;">
									<span class="email-brand" style="font-weight:800;font-size:19px;color:${EMAIL_THEME.ink};letter-spacing:-0.03em;">${EMAIL_THEME.brand}</span>
								</td></tr>
								<tr><td class="email-content" style="padding:20px 32px 8px 32px;color:${EMAIL_THEME.ink};">
${LAYOUT_CONTENT_SLOT}
								</td></tr>
								<tr><td class="email-footer" style="padding:16px 32px 28px 32px;color:${EMAIL_THEME.muted};font-size:13px;">
									You're receiving this because someone used this address at ${EMAIL_THEME.brand}. If that wasn't you, you can ignore it.
								</td></tr>
							</table>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;

// Inject a body fragment into a layout shell. If the body is already a full
// HTML document (a founder chose to store a complete template), it is returned
// untouched — never double-wrapped.
export function wrapLayout(bodyHtml: string, layoutHtml: string = DEFAULT_EMAIL_LAYOUT): string {
	const trimmed = bodyHtml.trimStart().toLowerCase();
	if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
		return bodyHtml;
	}
	return layoutHtml.replace(LAYOUT_CONTENT_SLOT, bodyHtml);
}
