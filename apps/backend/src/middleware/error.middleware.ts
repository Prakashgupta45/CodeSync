import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@codesync/shared';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? err.statusCode : 500;
  const errorCode = isOperational ? err.errorCode : 'INTERNAL_SERVER_ERROR';
  const isProduction = (process.env.NODE_ENV || ENV.NODE_ENV) === 'production';

  logger.error('Request error', {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorCode,
    err,
  });

  // Never leak unexpected internal error details, DB errors, or stack messages in production
  const safeMessage =
    isProduction && (!isOperational || statusCode >= 500)
      ? 'An unexpected internal error occurred'
      : err.message || 'An unexpected error occurred';

  const safeDetails =
    isProduction && (!isOperational || statusCode >= 500)
      ? undefined
      : isOperational
      ? err.details
      : undefined;

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message: safeMessage,
      ...(safeDetails !== undefined ? { details: safeDetails } : {}),
    },
  };

  res.status(statusCode).json(response);
};
