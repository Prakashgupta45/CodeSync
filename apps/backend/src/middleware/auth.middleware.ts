import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { ACCESS_TOKEN_COOKIE } from '../utils/cookie';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
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
      throw new AppError('Authentication required. Missing token.', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED'));
    } else {
      next(new AppError('Invalid or corrupted authentication token', 401, 'INVALID_TOKEN'));
    }
  }
};
