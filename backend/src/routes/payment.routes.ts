import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { paymentController } from '../controllers/payment.controller';

// Mounted at /api/v1/payments by Agent A's routes/index.ts.
const router = Router();

router.use(requireAuth);

router.get('/', paymentController.list);
router.get('/:id', paymentController.get);

export default router;
