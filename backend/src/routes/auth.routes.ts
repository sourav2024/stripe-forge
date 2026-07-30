import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
import { env } from '../config/env';
import { makeStore } from '../config/rateLimitStore';
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  requestResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validator';

const router = Router();

// Stricter per-IP limiter for pre-auth credential endpoints (login/signup/
// password). Redis-backed (via makeStore) so limits hold across replicas.
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  store: makeStore('auth:'),
});

// Stricter per-IP limiter on credential/password endpoints to blunt brute-force
// and credential-stuffing; these are the highest-value attack surface.
router.post('/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);
router.post('/password/reset-request', authLimiter, validate(requestResetSchema), authController.requestPasswordReset);
router.post('/password/reset', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.get('/me', requireAuth, authController.me);

export default router;
