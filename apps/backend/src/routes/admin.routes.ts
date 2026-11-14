import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// Protect all admin routes with authentication + ADMIN role check
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard Overview
router.get('/stats', (req, res, next) => adminController.getDashboardStats(req, res, next));
router.get('/system-health', (req, res, next) => adminController.getSystemHealth(req, res, next));
router.get('/audit-logs', (req, res, next) => adminController.getAuditLogs(req, res, next));
router.get('/ai-usage', (req, res, next) => adminController.getAiUsage(req, res, next));
router.get('/executions', (req, res, next) => adminController.getExecutions(req, res, next));

// Users Management
router.get('/users', (req, res, next) => adminController.getUsers(req, res, next));
router.patch('/users/:userId/status', (req, res, next) => adminController.updateUserStatus(req, res, next));
router.patch('/users/:userId/role', (req, res, next) => adminController.updateUserRole(req, res, next));

// Coding Rooms Management
router.get('/rooms', (req, res, next) => adminController.getRooms(req, res, next));
router.delete('/rooms/:roomId', (req, res, next) => adminController.terminateRoom(req, res, next));

// Interviews Management & Safe Deletion
router.get('/interviews', (req, res, next) => adminController.getInterviews(req, res, next));
router.delete('/interviews/:interviewId', (req, res, next) => adminController.deleteInterview(req, res, next));
router.post('/interviews/:interviewId/recover', (req, res, next) => adminController.recoverInterview(req, res, next));
router.post('/interviews/:interviewId/cancel', (req, res, next) => adminController.cancelInterview(req, res, next));

export default router;
