import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { listJobs, jobStats } from '../controllers/job.controller';

// Job observability. Mounts at /api/v1/jobs.
const router = Router();

router.use(requireAuth);

router.get('/', listJobs);
router.get('/stats', jobStats);

export default router;
