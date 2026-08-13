import { Response, CookieOptions } from 'express';
import { ENV } from '../config/env';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const getBaseCookieOptions = (): CookieOptions => {
  const isProd = ENV.NODE_ENV === 'production';
  return {
    httpOnly: true, // Prevents XSS access to tokens
    secure: ENV.COOKIE_SECURE || isProd, // Environment-based: false for local HTTP dev
    sameSite: isProd ? 'strict' : 'lax', // Lax for cross-origin dev if needed
    domain: ENV.COOKIE_DOMAIN && ENV.COOKIE_DOMAIN !== 'localhost' ? ENV.COOKIE_DOMAIN : undefined,
    path: '/',
  };
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  const baseOptions = getBaseCookieOptions();

  // Access Token Cookie (15 min)
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000,
  });

  // Refresh Token Cookie (7 days)
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookies = (res: Response): void => {
  const baseOptions = getBaseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions);
};
