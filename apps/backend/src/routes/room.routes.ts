import { Router } from 'express';
import { roomController } from '../controllers/room.controller';
import { executionController } from '../controllers/execution.controller';
import aiRoutes from './ai.routes';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { createRoomSchema, updateMemberRoleSchema } from '@codesync/shared';

const router = Router();

// Require authentication for all room operations
router.use(authenticateToken);

router.post('/', validateRequest(createRoomSchema), roomController.create);
router.get('/', roomController.list);
router.get('/:roomId', roomController.getById);
router.post('/:roomId/join', roomController.join);
router.post('/:roomId/leave', roomController.leave);
router.delete('/:roomId', roomController.delete);
router.get('/:roomId/members', roomController.getMembers);
router.delete('/:roomId/members/:userId', roomController.removeMember);
router.patch('/:roomId/members/:userId/role', validateRequest(updateMemberRoleSchema), roomController.updateMemberRole);

// POST /api/v1/rooms/:roomId/execute (Secure Docker Code Execution)
router.post('/:roomId/execute', executionController.executeCode);

// AI Assistant Routes
router.use('/:roomId/ai', aiRoutes);

export default router;
