import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { paymentIntentController } from '../controllers/paymentIntent.controller';

// Mounted at /api/v1/payment_intents by Agent A's routes/index.ts.
const router = Router();

router.use(requireAuth);

// Money-moving actions require an elevated role; VIEWER may read but never write.
const requireWrite = requireRole('OWNER', 'ADMIN');

router.post('/', requireWrite, paymentIntentController.create);
router.get('/', paymentIntentController.list);
router.get('/:id', paymentIntentController.get);
router.post('/:id/confirm', requireWrite, paymentIntentController.confirm);
router.post('/:id/cancel', requireWrite, paymentIntentController.cancel);

export default router;
