// Augment Express's Request so authenticated handlers can read `req.merchant`
// with full type safety, set by the auth middleware after verifying the JWT.
import 'express';

declare global {
  namespace Express {
    interface Request {
      merchant?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export {};
