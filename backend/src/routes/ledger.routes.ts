import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { ledgerController } from '../controllers/ledger.controller';

// Mounted at /api/v1/ledger by Agent A's routes/index.ts.
const router = Router();

router.use(requireAuth);

// Order matters: the literal /balance must be declared before any dynamic
// segment would shadow it (there is no /:id here, but this keeps intent clear).
router.get('/balance', ledgerController.balance);
router.get('/', ledgerController.history);

export default router;
