import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { listDeliveries, getDelivery, retryDelivery } from '../controllers/webhook.controller';

// Webhook delivery inspection + retry. Mounts at /api/v1/webhook_deliveries.
const router = Router();

router.use(requireAuth);

router.get('/', listDeliveries);
router.get('/:id', getDelivery);
router.post('/:id/retry', retryDelivery);

export default router;
