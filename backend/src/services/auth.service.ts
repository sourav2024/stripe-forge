import type { Merchant } from '@prisma/client';
import { merchantRepository } from '../repositories/merchant.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { generateToken, sha256, generateApiKeyPair } from '../utils/crypto';
import { recordAudit } from '../utils/audit';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '../utils/AppError';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface AuthContext {
  ipAddress?: string;
}

async function issueTokens(merchant: Merchant): Promise<TokenPair> {
  const accessToken = signAccessToken({
    sub: merchant.id,
    email: merchant.email,
    role: merchant.role,
  });
  const { token: refreshToken, expiresAt } = signRefreshToken();
  // Persist only the hash so a DB leak cannot yield usable refresh tokens.
  await merchantRepository.createRefreshToken(merchant.id, sha256(refreshToken), expiresAt);
  return { accessToken, refreshToken };
}

export const authService = {
  /**
   * Register a new merchant. Returns the created merchant, its token pair, the
   * one-time API secret, and the email-verification token (returned rather than
   * emailed — this platform has no mailer).
   */
  async signup(
    input: SignupInput,
    ctx: AuthContext = {},
  ): Promise<{
    merchant: Merchant;
    tokens: TokenPair;
    apiKeySecret: string;
    emailVerifyToken: string;
  }> {
    const existing = await merchantRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const apiKeys = generateApiKeyPair();
    const emailVerifyToken = generateToken(24);

    const merchant = await merchantRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
      apiKeyPublic: apiKeys.public,
      apiKeySecret: apiKeys.secret,
      emailVerifyToken,
    });

    const tokens = await issueTokens(merchant);

    await recordAudit({
      merchantId: merchant.id,
      action: 'merchant.signup',
      entityType: 'Merchant',
      entityId: merchant.id,
      ipAddress: ctx.ipAddress,
    });

    return { merchant, tokens, apiKeySecret: apiKeys.secret, emailVerifyToken };
  },

  async login(
    email: string,
    password: string,
    ctx: AuthContext = {},
  ): Promise<{ merchant: Merchant; tokens: TokenPair }> {
    const merchant = await merchantRepository.findByEmail(email);
    // Same error whether the email is unknown or the password is wrong, so an
    // attacker cannot enumerate registered accounts.
    if (!merchant) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const valid = await comparePassword(password, merchant.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = await issueTokens(merchant);

    await recordAudit({
      merchantId: merchant.id,
      action: 'merchant.login',
      entityType: 'Merchant',
      entityId: merchant.id,
      ipAddress: ctx.ipAddress,
    });

    return { merchant, tokens };
  },

  /**
   * Rotate the refresh token: verify the presented token is valid, revoke it,
   * and issue a fresh pair. Rotation limits the blast radius of a stolen token.
   */
  async refresh(refreshToken: string): Promise<{ merchant: Merchant; tokens: TokenPair }> {
    // Look up WITHOUT the revoked filter so we can detect reuse of a token that
    // was already rotated away (an active leak signal), not just miss on it.
    const tokenRow = await merchantRepository.findRefreshTokenByHash(sha256(refreshToken));
    if (!tokenRow) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // A presented-but-already-revoked token means the token was rotated and is
    // now being replayed — a strong theft signal. Nuke the whole family so a
    // stolen-then-rotated token can't keep the thief in a valid session.
    if (tokenRow.revokedAt !== null) {
      await merchantRepository.revokeAllForMerchant(tokenRow.merchantId);
      throw new UnauthorizedError('refresh_token_reused');
    }

    if (tokenRow.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const merchant = await merchantRepository.findById(tokenRow.merchantId);
    if (!merchant) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Rotation IS the claim: only the caller that flips revokedAt null->now may
    // issue a new pair. Two concurrent refreshes with the same token race here;
    // the loser gets count===0 and is rejected, so one token can't mint two
    // fresh sessions.
    const claimed = await merchantRepository.revokeRefreshTokenIfActive(tokenRow.id);
    if (claimed === 0) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokens = await issueTokens(merchant);
    return { merchant, tokens };
  },

  /** Revoke a single refresh token. Idempotent: unknown tokens succeed silently. */
  async logout(refreshToken: string): Promise<void> {
    const tokenRow = await merchantRepository.findValidRefreshTokenByHash(sha256(refreshToken));
    if (tokenRow) {
      await merchantRepository.revokeRefreshToken(tokenRow.id);
    }
  },

  /**
   * Begin a password reset. Always resolves successfully — never revealing
   * whether the email is registered. Returns the reset token (would be emailed
   * in production) only when a matching account exists.
   */
  async requestPasswordReset(
    email: string,
    ctx: AuthContext = {},
  ): Promise<{ resetToken?: string }> {
    const merchant = await merchantRepository.findByEmail(email);
    if (!merchant) {
      return {};
    }

    const resetToken = generateToken(24);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await merchantRepository.updateById(merchant.id, {
      passwordResetToken: resetToken,
      passwordResetExpiresAt: expiresAt,
    });

    await recordAudit({
      merchantId: merchant.id,
      action: 'merchant.password_reset_requested',
      entityType: 'Merchant',
      entityId: merchant.id,
      ipAddress: ctx.ipAddress,
    });

    return { resetToken };
  },

  /**
   * Complete a password reset: validate token + expiry, set the new hash, clear
   * the token, and revoke all refresh tokens so existing sessions are killed.
   */
  async resetPassword(token: string, newPassword: string, ctx: AuthContext = {}): Promise<void> {
    const merchant = await merchantRepository.findByPasswordResetToken(token);
    if (
      !merchant ||
      !merchant.passwordResetExpiresAt ||
      merchant.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await merchantRepository.updateById(merchant.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });
    await merchantRepository.revokeAllForMerchant(merchant.id);

    await recordAudit({
      merchantId: merchant.id,
      action: 'merchant.password_reset',
      entityType: 'Merchant',
      entityId: merchant.id,
      ipAddress: ctx.ipAddress,
    });
  },

  /** Consume the email-verification token, marking the merchant verified. */
  async verifyEmail(token: string): Promise<Merchant> {
    const merchant = await merchantRepository.findByEmailVerifyToken(token);
    if (!merchant) {
      throw new NotFoundError('Invalid email verification token');
    }
    return merchantRepository.updateById(merchant.id, {
      emailVerified: true,
      emailVerifyToken: null,
    });
  },
};
