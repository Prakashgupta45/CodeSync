import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { executionController } from '../controllers/execution.controller';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

// POST /api/v1/rooms/:roomId/execute
router.post('/execute', executionController.executeCode);

export default router;
