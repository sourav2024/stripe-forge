import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { refundController } from '../controllers/refund.controller';

// Mounted at /api/v1/refunds by Agent A's routes/index.ts.
const router = Router();

router.use(requireAuth);

// Issuing a refund moves money; VIEWER may read but never write.
router.post('/', requireRole('OWNER', 'ADMIN'), refundController.create);
router.get('/', refundController.list);
router.get('/:id', refundController.get);

export default router;
