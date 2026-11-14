import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import {
  DEFAULT_GEMINI_MODEL,
  isConfiguredApiKey,
  parseLlmTimeoutMs,
} from '../utils/llm-client';

// Load .env from workspace root if running in backend folder
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const WEAK_SECRET_PATTERNS = [
  'dev_',
  'change_in_production',
  'change-in-production',
  'placeholder',
  'your-',
  'example',
];

function isWeakOrPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (trimmed.length < 32) return true;
  const lower = trimmed.toLowerCase();
  return WEAK_SECRET_PATTERNS.some((pattern) => lower.includes(pattern));
}

export interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  CLIENT_URL: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  INTERVIEW_SIGNING_SECRET: string;
  COOKIE_SECURE: boolean;
  COOKIE_DOMAIN: string | undefined;
  DOCKER_MAX_CONCURRENCY: number;
  GEMINI_MODEL: string;
  LLM_TIMEOUT_MS: number;
  GEMINI_CONFIGURED: boolean;
}

export function validateEnv(source: NodeJS.ProcessEnv = process.env): ValidatedEnv {
  const nodeEnv = source.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const rawAccessSecret = source.JWT_ACCESS_SECRET?.trim();
  const rawRefreshSecret = source.JWT_REFRESH_SECRET?.trim();
  const rawInterviewSecret = source.INTERVIEW_SIGNING_SECRET?.trim();
  const rawDbUrl = source.DATABASE_URL?.trim();

  if (isProd) {
    if (isWeakOrPlaceholder(rawAccessSecret)) {
      throw new Error(
        'FATAL: JWT_ACCESS_SECRET must be set to a strong (>=32 char) non-placeholder value in production.'
      );
    }
    if (isWeakOrPlaceholder(rawRefreshSecret)) {
      throw new Error(
        'FATAL: JWT_REFRESH_SECRET must be set to a strong (>=32 char) non-placeholder value in production.'
      );
    }
    if (rawAccessSecret === rawRefreshSecret) {
      throw new Error(
        'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct values in production.'
      );
    }
    if (rawInterviewSecret !== undefined && isWeakOrPlaceholder(rawInterviewSecret)) {
      throw new Error(
        'FATAL: INTERVIEW_SIGNING_SECRET must be at least 32 non-placeholder characters when configured.'
      );
    }
    if (!rawDbUrl || rawDbUrl.includes('postgres:postgres@localhost')) {
      throw new Error(
        'FATAL: DATABASE_URL must be configured with non-default production credentials.'
      );
    }
  }

  const accessSecret =
    rawAccessSecret || 'dev_access_secret_change_in_production_123456789';
  const refreshSecret =
    rawRefreshSecret || 'dev_refresh_secret_change_in_production_987654321';

  // Domain-separated fallback derived from validated JWT access secret when unset
  const interviewSigningSecret =
    rawInterviewSecret && rawInterviewSecret.length > 0
      ? rawInterviewSecret
      : crypto
          .createHmac('sha256', accessSecret)
          .update('codesync-candidate-interview-signing-v1')
          .digest('hex');

  const maxConcurrencyRaw = parseInt(source.DOCKER_MAX_CONCURRENCY || '5', 10);

  return {
    NODE_ENV: nodeEnv,
    PORT: parseInt(source.PORT || '5000', 10),
    CLIENT_URL: source.CLIENT_URL || 'http://localhost:3000,http://localhost:3001',
    DATABASE_URL:
      rawDbUrl ||
      'postgresql://postgres:postgres@localhost:5432/codesync_db?schema=public',
    REDIS_URL: source.REDIS_URL || 'redis://localhost:6379',
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_EXPIRES_IN: source.JWT_ACCESS_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_IN: source.JWT_REFRESH_EXPIRES_IN || '7d',
    INTERVIEW_SIGNING_SECRET: interviewSigningSecret,
    COOKIE_SECURE:
      source.COOKIE_SECURE !== undefined ? source.COOKIE_SECURE === 'true' : isProd,
    COOKIE_DOMAIN: source.COOKIE_DOMAIN || undefined,
    DOCKER_MAX_CONCURRENCY:
      Number.isFinite(maxConcurrencyRaw) && maxConcurrencyRaw > 0
        ? maxConcurrencyRaw
        : 5,
    GEMINI_MODEL: source.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    LLM_TIMEOUT_MS: parseLlmTimeoutMs(source.LLM_TIMEOUT_MS),
    GEMINI_CONFIGURED: isConfiguredApiKey(source.GEMINI_API_KEY),
  };
}

export const ENV = validateEnv(process.env);
