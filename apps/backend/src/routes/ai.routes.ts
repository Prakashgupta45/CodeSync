import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { aiController } from '../controllers/ai.controller';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

// AI Actions endpoints
router.post('/prompt', aiController.promptAi);
router.post('/explain', (req, res, next) => {
  req.body.action = 'EXPLAIN';
  aiController.promptAi(req, res, next);
});
router.post('/debug', (req, res, next) => {
  req.body.action = 'DEBUG';
  aiController.promptAi(req, res, next);
});
router.post('/refactor', (req, res, next) => {
  req.body.action = 'REFACTOR';
  aiController.promptAi(req, res, next);
});
router.post('/tests', (req, res, next) => {
  req.body.action = 'TESTS';
  aiController.promptAi(req, res, next);
});
router.get('/history', aiController.getHistory);

export default router;
