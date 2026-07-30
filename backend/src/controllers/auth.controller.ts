import type { Merchant } from '@prisma/client';
import { asyncHandler, ok } from '../utils/http';
import { serialize } from '../utils/serialize';
import { UnauthorizedError, NotFoundError } from '../utils/AppError';
import { authService } from '../services/auth.service';
import { merchantRepository } from '../repositories/merchant.repository';

/**
 * Shape a Merchant for API responses. Never leaks `passwordHash`,
 * `apiKeySecret`, or the raw verify/reset tokens. `apiKeyPublic` is safe to
 * return; the secret is surfaced separately, only once, on signup.
 */
function publicMerchant(m: Merchant) {
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    role: m.role,
    emailVerified: m.emailVerified,
    apiKeyPublic: m.apiKeyPublic,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export const authController = {
  signup: asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    const result = await authService.signup({ email, password, name }, { ipAddress: req.ip });
    // apiKeySecret is shown exactly once here, mirroring how Stripe reveals a
    // secret key only at creation time.
    ok(
      res,
      serialize({
        merchant: publicMerchant(result.merchant),
        tokens: result.tokens,
        apiKeySecret: result.apiKeySecret,
        emailVerifyToken: result.emailVerifyToken,
      }),
      201,
    );
  }),

  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password, { ipAddress: req.ip });
    ok(
      res,
      serialize({ merchant: publicMerchant(result.merchant), tokens: result.tokens }),
    );
  }),

  refresh: asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    ok(
      res,
      serialize({ merchant: publicMerchant(result.merchant), tokens: result.tokens }),
    );
  }),

  logout: asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    ok(res, { loggedOut: true });
  }),

  requestPasswordReset: asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email, { ipAddress: req.ip });
    // Always report success regardless of whether the email exists. `resetToken`
    // is included here only because this platform has no email delivery.
    ok(res, { requested: true, ...(result.resetToken ? { resetToken: result.resetToken } : {}) });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword, { ipAddress: req.ip });
    ok(res, { reset: true });
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const { token } = req.body;
    const merchant = await authService.verifyEmail(token);
    ok(res, serialize({ merchant: publicMerchant(merchant) }));
  }),

  me: asyncHandler(async (req, res) => {
    if (!req.merchant) {
      throw new UnauthorizedError('Authentication required');
    }
    const merchant = await merchantRepository.findById(req.merchant.id);
    if (!merchant) {
      throw new NotFoundError('Merchant not found');
    }
    ok(res, serialize({ merchant: publicMerchant(merchant) }));
  }),
};
