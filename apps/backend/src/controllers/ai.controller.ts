import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { aiService } from '../services/ai.service';
import { AiActionType } from '@codesync/shared';

export class AiController {
  public promptAi = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const roomIdParam = req.params.roomId;
      const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;
      const userId = req.user!.userId;
      const { action = 'CHAT', prompt, code, errorContext } = req.body || {};

      const result = await aiService.promptAi(
        roomId,
        userId,
        action as AiActionType,
        prompt,
        code,
        errorContext
      );

      res.status(200).json({
        success: true,
        message: 'AI response generated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const roomIdParam = req.params.roomId;
      const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;
      const userId = req.user!.userId;

      const history = await aiService.getRoomAiHistory(roomId, userId);

      res.status(200).json({
        success: true,
        message: 'AI history retrieved successfully',
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const aiController = new AiController();
