import { Router } from 'express';
import { roomController } from '../controllers/room.controller';
import { executionController } from '../controllers/execution.controller';
import aiRoutes from './ai.routes';
import { authenticateToken, authenticateRoomOrCandidate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { createRoomSchema, updateMemberRoleSchema, updateRoomLanguageSchema } from '@codesync/shared';

const router = Router();

// POST /api/v1/rooms/:roomId/execute (Secure Docker Code Execution - supports interview assessment rooms)
router.post('/:roomId/execute', authenticateRoomOrCandidate, executionController.executeCode);

// AI Assistant Routes
router.use('/:roomId/ai', authenticateRoomOrCandidate, aiRoutes);

// Require strict authentication for collaborative coding room operations
router.use(authenticateToken);

router.post('/', validateRequest(createRoomSchema), roomController.create);
router.get('/', roomController.list);
router.get('/:roomId', roomController.getById);
router.patch('/:roomId/language', validateRequest(updateRoomLanguageSchema), roomController.updateLanguage);
router.post('/:roomId/join', roomController.join);
router.post('/:roomId/leave', roomController.leave);
router.delete('/:roomId', roomController.delete);
router.get('/:roomId/members', roomController.getMembers);
router.delete('/:roomId/members/:userId', roomController.removeMember);
router.patch('/:roomId/members/:userId/role', validateRequest(updateMemberRoleSchema), roomController.updateMemberRole);

export default router;
