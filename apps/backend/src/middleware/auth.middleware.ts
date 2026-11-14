import { Request, Response, NextFunction } from 'express';
import {
  verifyAccessToken,
  verifyCandidateInterviewToken,
  TokenPayload,
} from '../utils/jwt';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../utils/cookie';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  candidateInterview?: {
    inviteToken: string;
    roomId: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Try reading access token from HTTP-only cookie
    let token = req.cookies?.[ACCESS_TOKEN_COOKIE];

    // 2. Fallback to Bearer token in Authorization header if provided
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      const canRefresh = Boolean(req.cookies?.[REFRESH_TOKEN_COOKIE]);
      throw new AppError('Authentication required. Missing token.', 401, 'UNAUTHORIZED', { canRefresh });
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else if (error.name === 'TokenExpiredError') {
      const canRefresh = Boolean(req.cookies?.[REFRESH_TOKEN_COOKIE]);
      next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED', { canRefresh }));
    } else {
      next(new AppError('Invalid or corrupted authentication token', 401, 'INVALID_TOKEN'));
    }
  }
};

export const authenticateRoomOrCandidate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    let token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        req.user = payload;
        return next();
      } catch {
        // Token invalid, check if room allows candidate execution
      }
    }

    const roomIdParam = req.params.roomId;
    const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;
    const rawInterviewHeader = req.headers['x-interview-token'];
    const interviewToken =
      typeof rawInterviewHeader === 'string' ? rawInterviewHeader.trim() : undefined;

    if (interviewToken) {
      const decoded = verifyCandidateInterviewToken(interviewToken);
      if (!roomId || decoded.roomId !== roomId) {
        throw new AppError('Interview token is not valid for this room.', 403, 'FORBIDDEN');
      }
      req.candidateInterview = {
        inviteToken: decoded.inviteToken,
        roomId: decoded.roomId,
      };
      req.user = {
        userId: 'candidate-user',
        email: 'candidate@codesync.ai',
        role: 'USER',
      };
      return next();
    }

    throw new AppError('Authentication required. Missing token.', 401, 'UNAUTHORIZED');
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid authentication token', 401, 'INVALID_TOKEN'));
    }
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new AppError('Administrator privileges required. Access denied.', 403, 'FORBIDDEN');
  }
  next();
};
