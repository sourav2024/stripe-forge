import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

// Repository layer: only Prisma calls, returns Prisma models. No business logic.

export const merchantRepository = {
  findByEmail(email: string) {
    return prisma.merchant.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.merchant.findUnique({ where: { id } });
  },

  create(data: Prisma.MerchantCreateInput) {
    return prisma.merchant.create({ data });
  },

  updateById(id: string, data: Prisma.MerchantUpdateInput) {
    return prisma.merchant.update({ where: { id }, data });
  },

  findByEmailVerifyToken(token: string) {
    return prisma.merchant.findUnique({ where: { emailVerifyToken: token } });
  },

  findByPasswordResetToken(token: string) {
    return prisma.merchant.findUnique({ where: { passwordResetToken: token } });
  },

  // --- Refresh token operations ---

  createRefreshToken(merchantId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: { merchantId, tokenHash, expiresAt },
    });
  },

  /** Returns the token row only if it exists, is unrevoked, and not expired. */
  findValidRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  /**
   * Returns the token row by hash REGARDLESS of revoked/expired state, so the
   * caller can distinguish "never existed" (401) from "already revoked" (reuse
   * of a rotated token → revoke the whole family).
   */
  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({ where: { tokenHash } });
  },

  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  /**
   * Atomic revoke claim: only the caller that transitions revokedAt null->now
   * gets count===1. Concurrent refreshes with the same token race here, and all
   * but one see count===0 — that loser is treated as token reuse/contention.
   */
  async revokeRefreshTokenIfActive(id: string): Promise<number> {
    const { count } = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  },

  /** Revoke every active refresh token for a merchant (e.g. after password reset). */
  revokeAllForMerchant(merchantId: string) {
    return prisma.refreshToken.updateMany({
      where: { merchantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
