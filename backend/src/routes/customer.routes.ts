import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { customerController } from '../controllers/customer.controller';

// Mounted at /api/v1/customers by Agent A's routes/index.ts.
const router = Router();

router.use(requireAuth);

// Mutations require an elevated role; VIEWER may read but never write.
const requireWrite = requireRole('OWNER', 'ADMIN');

router.post('/', requireWrite, customerController.create);
router.get('/', customerController.list);
router.get('/:id', customerController.get);
router.patch('/:id', requireWrite, customerController.update);
router.delete('/:id', requireWrite, customerController.remove);

export default router;
