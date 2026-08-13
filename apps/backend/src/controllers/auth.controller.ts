import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } from '../utils/cookie';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ApiResponse, AuthResponseData } from '@codesync/shared';

export class AuthController {
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.register(req.body);

      // Set HTTP-only cookies for Access & Refresh Tokens
      setAuthCookies(res, result.accessToken, result.refreshToken);

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        message: 'Logged in successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

      if (!refreshToken && req.body?.refreshToken) {
        refreshToken = req.body.refreshToken;
      }

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token cookie or payload is required',
          },
        });
        return;
      }

      const result = await authService.refreshTokens(refreshToken);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      // Clear cookies if refresh fails
      clearAuthCookies(res);
      next(error);
    }
  };

  public logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      const userId = req.user?.userId;

      await authService.logout(refreshToken, userId);
      clearAuthCookies(res);

      const response: ApiResponse = {
        success: true,
        message: 'Logged out successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      clearAuthCookies(res);
      next(error);
    }
  };

  public me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User unauthenticated' },
        });
        return;
      }

      const user = await authService.getCurrentUser(req.user.userId);

      const response: ApiResponse = {
        success: true,
        data: { user },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
