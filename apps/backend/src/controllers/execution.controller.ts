import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { executionService } from '../services/execution.service';

export class ExecutionController {
  public executeCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const roomIdParam = req.params.roomId;
      const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;
      const userId = req.user!.userId;
      const { language, code } = req.body || {};

      const result = await executionService.runRoomCode(roomId, userId, language, code);

      res.status(200).json({
        success: true,
        message: 'Code executed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const executionController = new ExecutionController();
