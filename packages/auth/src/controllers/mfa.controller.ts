import QRCode from 'qrcode';

import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IAuthConfig }                                     from '../config';
import { issueTokenPair, refreshTokenExpiry }                    from '../services/jwt';
import { generateTotpSecret, generateTotpUri, verifyTotpToken,
         generateBackupCodes }                                   from '../services/mfa';
import { hashPassword, verifyPassword }                         from '../services/password';
import { toUserDTO }                                            from '../dtos/user';
import { UserModel }                                            from '../models/user.model';
import { SessionModel }                                         from '../models/session.model';
import { BackupCodeModel }                                      from '../models/backup-code.model';

export function mfaController(store: IStoreAdapter, config: IAuthConfig, issuer: string) {
	const users       = new UserModel(store);
	const sessions    = new SessionModel(store);
	const backupCodes = new BackupCodeModel(store);

	return {
		// ── 1. Setup ───────────────────────────────────────────────
		setup: async (ctx: IFonderieContext): Promise<Response> => {
			const secret     = generateTotpSecret();
			const uri        = generateTotpUri(ctx.user!.email ?? ctx.user!.id, secret, issuer);
			const plainCodes = generateBackupCodes();
			const codeHashes = await Promise.all(plainCodes.map(c => hashPassword(c)));

			const qr = await QRCode.toDataURL(uri);

			await Promise.all([
				users.saveMfaPendingSecret(ctx.user!.id, secret),
				backupCodes.replace(ctx.user!.id, codeHashes),
			]);

			return setApiResponse(HTTP.OK, 'MFA_SETUP_INITIATED', 'Scan the QR code with your authenticator app.', {
				qr,
				// uri — expose when adding a "manual entry" flow in the UI (otpauth:// URI lets
				// users add the credential by typing the secret instead of scanning the QR code)
				backupCodes: plainCodes,
			});
		},

		// ── 2. Verify (setup confirm · TOTP login · backup code login) ──
		verify: async (ctx: IFonderieContext): Promise<Response> => {
			const body  = ctx.meta['body'] as Record<string, unknown> | undefined;
			const token = body?.['token'];

			if (typeof token !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'token is required');
			}

			const pendingSecret = await users.getMfaPendingSecret(ctx.user!.id);

			if (pendingSecret) {
				// ── Setup confirmation (TOTP only — backup codes cannot confirm setup) ──
				if (!verifyTotpToken(token, pendingSecret)) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid MFA token');
				}
				await users.confirmMfaSecret(ctx.user!.id);
				return setApiResponse(HTTP.OK, 'MFA_VERIFIED', 'MFA verified successfully.', { mfaEnabled: true });

			} else if (/^[A-Z0-9]{8}$/i.test(token)) {
				// ── Backup code consumption ────────────────────────────────────────────
				if (!ctx.user!.mfaPending) {
					return setApiResponse(HTTP.FORBIDDEN, 'MFA_NOT_PENDING', 'Use the mfaToken from the login response');
				}
				if (!ctx.user!.mfaEnabled) {
					return setApiResponse(HTTP.BAD_REQUEST, 'MFA_NOT_CONFIGURED', 'MFA not configured');
				}

				const unused = await backupCodes.findUnused(ctx.user!.id);
				const checks = await Promise.all(
					unused.map(async row => ({
						id:    row.id,
						match: await verifyPassword(token.toUpperCase(), row.codeHash),
					}))
				);
				const matched = checks.find(r => r.match);

				if (!matched) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid backup code');
				}

				await backupCodes.consume(matched.id);

			} else {
				// ── TOTP login verification ───────────────────────────────────────────
				if (!ctx.user!.mfaPending) {
					return setApiResponse(HTTP.FORBIDDEN, 'MFA_NOT_PENDING', 'Use the mfaToken from the login response');
				}
				const secret = await users.getMfaSecret(ctx.user!.id);
				if (!secret) {
					return setApiResponse(HTTP.BAD_REQUEST, 'MFA_NOT_CONFIGURED', 'MFA not configured');
				}
				if (!verifyTotpToken(token, secret)) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid MFA token');
				}
				if (!ctx.user!.mfaEnabled) {
					await users.enableMfa(ctx.user!.id);
				}
			}

			const { accessToken, refreshToken } = issueTokenPair(ctx.user!.id, config, { loginMethod: ctx.user!.loginMethod });
			await sessions.create(ctx.user!.id, refreshToken, refreshTokenExpiry(refreshToken));

			const fullUser = await users.findById(ctx.user!.id);
			if (!fullUser) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'User not found after MFA verify');
			}

			return Response.json(
				{
					reason:      'MFA_VERIFIED',
					explanation: 'MFA verified successfully.',
					result: {
						tokens: { access: accessToken, refresh: refreshToken },
						user:   toUserDTO(fullUser),
					},
				},
				{
					status: 200,
					headers: {
						'Set-Cookie': [
							`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/`,
							`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh`,
						].join(', '),
					},
				},
			);
		},

		// ── 3. Regenerate backup codes ────────────────────────────
		regenerateBackupCodes: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const token = body?.['token'];

			if (typeof token !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'TOTP token is required');
			}

			if (!ctx.user!.mfaEnabled) {
				return setApiResponse(HTTP.BAD_REQUEST, 'MFA_NOT_ENABLED', 'MFA is not enabled');
			}

			const secret = await users.getMfaSecret(ctx.user!.id);
			if (!secret || !verifyTotpToken(token, secret)) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid TOTP code');
			}

			const plainCodes = generateBackupCodes();
			const codeHashes = await Promise.all(plainCodes.map(c => hashPassword(c)));
			await backupCodes.replace(ctx.user!.id, codeHashes);

			return setApiResponse(HTTP.OK, 'BACKUP_CODES_REGENERATED', 'Backup codes regenerated.', {
				backupCodes: plainCodes,
			});
		},

		// ── 4. Disable ─────────────────────────────────────────────
		disable: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const code = body?.['code'];

			if (typeof code !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'TOTP code is required');
			}

			const user = await users.findById(ctx.user!.id);
			if (!user || !user.mfaEnabled) {
				return setApiResponse(HTTP.BAD_REQUEST, 'MFA_NOT_ENABLED', 'MFA is not enabled');
			}

			const secret = (user as unknown as { mfaSecret: string | null }).mfaSecret;
			if (!secret || !verifyTotpToken(code, secret)) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid TOTP code');
			}

			await Promise.all([
				users.disableMfa(ctx.user!.id),
				backupCodes.deleteByUser(ctx.user!.id),
			]);

			return setApiResponse(HTTP.OK, 'MFA_DISABLED', 'MFA disabled successfully.');
		},
	};
}
