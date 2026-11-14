import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';

function readRootEnvSecret(key: string): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        if (trimmed.slice(0, eqIdx).trim() === key) {
          return trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // Ignore unreadable env file candidates
    }
  }
  return undefined;
}

export interface AuthenticatedServerUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function getBackendInternalUrl(): string {
  const raw =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:5000';
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
}

function getCandidateSigningSecret(): string {
  const explicit =
    process.env.INTERVIEW_SIGNING_SECRET?.trim() ||
    readRootEnvSecret('INTERVIEW_SIGNING_SECRET')?.trim();
  if (explicit && explicit.length >= 32) {
    return explicit;
  }

  const accessSecret =
    process.env.JWT_ACCESS_SECRET?.trim() ||
    readRootEnvSecret('JWT_ACCESS_SECRET')?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && (!accessSecret || accessSecret.length < 32)) {
    throw new Error(
      'INTERVIEW_SIGNING_SECRET or strong JWT_ACCESS_SECRET must be configured in production.'
    );
  }

  const resolvedAccessSecret =
    accessSecret && accessSecret.length > 0
      ? accessSecret
      : 'dev_access_secret_change_in_production_123456789';

  return crypto
    .createHmac('sha256', resolvedAccessSecret)
    .update('codesync-candidate-interview-signing-v1')
    .digest('hex');
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Signs a short-lived HS256 JWT authorizing candidate execution and AI requests
 * exclusively for the bound interview roomId. Matches Express backend verification.
 */
export function signCandidateInterviewToken(inviteToken: string, roomId: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: 'candidate-user',
      inviteToken,
      roomId,
      purpose: 'CANDIDATE_INTERVIEW',
      iat: nowSec,
      exp: nowSec + 12 * 60 * 60,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', getCandidateSigningSecret()).update(signingInput).digest()
  );
  return `${signingInput}.${signature}`;
}

/**
 * Verifies the caller's HTTP-only access_token cookie via Express /api/v1/auth/me.
 * Returns the authenticated user or null when unauthenticated/invalid.
 */
export async function getAuthenticatedServerUser(
  req?: Request
): Promise<AuthenticatedServerUser | null> {
  try {
    let cookieHeader = req?.headers.get('cookie') || '';
    if (!cookieHeader) {
      const cookieStore = await cookies();
      cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join('; ');
    }

    if (!cookieHeader) {
      return null;
    }

    const response = await fetch(`${getBackendInternalUrl()}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    const meUser = body?.data?.user ?? body?.data;
    if (!body?.success || !meUser?.id) {
      return null;
    }

    return {
      id: meUser.id,
      name: meUser.name,
      email: meUser.email,
      role: meUser.role || 'USER',
    };
  } catch {
    return null;
  }
}

export function getBackendApiBaseUrl(): string {
  return getBackendInternalUrl();
}
