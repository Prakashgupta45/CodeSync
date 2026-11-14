import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tokenId?: string;
  familyId?: string;
}

export interface CandidateInterviewTokenPayload {
  purpose: 'CANDIDATE_INTERVIEW';
  inviteToken: string;
  roomId: string;
}

export const signAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
    expiresIn: ENV.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const signRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
};

export const decodeRefreshTokenUnsafe = (token: string): TokenPayload | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') return null;
  return decoded as TokenPayload;
};

export const signCandidateInterviewToken = (
  inviteToken: string,
  roomId: string,
  expiresIn: jwt.SignOptions['expiresIn'] = '4h'
): string => {
  const payload: CandidateInterviewTokenPayload = {
    purpose: 'CANDIDATE_INTERVIEW',
    inviteToken,
    roomId,
  };
  return jwt.sign(payload, ENV.INTERVIEW_SIGNING_SECRET, { expiresIn });
};

export const verifyCandidateInterviewToken = (
  token: string
): CandidateInterviewTokenPayload => {
  const decoded = jwt.verify(token, ENV.INTERVIEW_SIGNING_SECRET) as CandidateInterviewTokenPayload;
  if (
    !decoded ||
    decoded.purpose !== 'CANDIDATE_INTERVIEW' ||
    typeof decoded.inviteToken !== 'string' ||
    typeof decoded.roomId !== 'string'
  ) {
    throw new Error('Invalid candidate interview token payload');
  }
  return decoded;
};
