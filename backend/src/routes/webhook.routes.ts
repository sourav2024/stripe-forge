import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  createEndpoint,
  listEndpoints,
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
} from '../controllers/webhook.controller';

// Webhook endpoint management. Mounts at /api/v1/webhook_endpoints.
const router = Router();

router.use(requireAuth);

// Managing endpoints exposes signing secrets; VIEWER may read but never write.
const requireWrite = requireRole('OWNER', 'ADMIN');

router.post('/', requireWrite, createEndpoint);
router.get('/', listEndpoints);
router.get('/:id', getEndpoint);
router.patch('/:id', requireWrite, updateEndpoint);
router.delete('/:id', requireWrite, deleteEndpoint);

export default router;
