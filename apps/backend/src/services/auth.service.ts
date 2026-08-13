import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { prisma } from '@codesync/database';
import { RegisterInput, LoginInput, UserDto } from '@codesync/shared';
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';

export class AuthService {
  private formatUserDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  public async register(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError('An account with this email address already exists', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: 'USER',
      },
    });

    const tokens = await this.generateAndStoreTokens(user.id, user.email, user.role);

    return {
      user: this.formatUserDto(user),
      ...tokens,
    };
  }

  public async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const tokens = await this.generateAndStoreTokens(user.id, user.email, user.role);

    return {
      user: this.formatUserDto(user),
      ...tokens,
    };
  }

  public async refreshTokens(rawRefreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError('User associated with token no longer exists', 401, 'USER_NOT_FOUND');
    }

    // Find refresh tokens for this user
    const userTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
    });

    let matchedTokenRecord = null;
    for (const record of userTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, record.hashedToken);
      if (isMatch) {
        matchedTokenRecord = record;
        break;
      }
    }

    // REUSE DETECTION: Token not found in active records or token is marked as revoked!
    if (!matchedTokenRecord || matchedTokenRecord.isRevoked) {
      // Security Event: Potential Refresh Token Reuse Attack! Revoke ALL tokens for user.
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
      throw new AppError(
        'Security Alert: Refresh token reuse detected. All sessions have been terminated.',
        401,
        'TOKEN_REUSE_DETECTED'
      );
    }

    // Check expiration date
    if (new Date() > matchedTokenRecord.expiresAt) {
      await prisma.refreshToken.update({
        where: { id: matchedTokenRecord.id },
        data: { isRevoked: true },
      });
      throw new AppError('Refresh token expired. Please login again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // ROTATION: Revoke old token
    await prisma.refreshToken.update({
      where: { id: matchedTokenRecord.id },
      data: { isRevoked: true },
    });

    // Generate NEW Access Token and NEW Refresh Token (same family)
    const newTokens = await this.generateAndStoreTokens(
      user.id,
      user.email,
      user.role,
      matchedTokenRecord.familyId
    );

    return {
      user: this.formatUserDto(user),
      ...newTokens,
    };
  }

  public async logout(rawRefreshToken?: string, userId?: string) {
    if (rawRefreshToken) {
      const userTokens = await prisma.refreshToken.findMany({
        where: { isRevoked: false },
      });

      for (const record of userTokens) {
        const isMatch = await bcrypt.compare(rawRefreshToken, record.hashedToken);
        if (isMatch) {
          await prisma.refreshToken.update({
            where: { id: record.id },
            data: { isRevoked: true },
          });
          break;
        }
      }
    }

    if (userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    return { success: true };
  }

  public async getCurrentUser(userId: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return this.formatUserDto(user);
  }

  private async generateAndStoreTokens(
    userId: string,
    email: string,
    role: string,
    existingFamilyId?: string
  ) {
    const familyId = existingFamilyId || randomUUID();
    const tokenId = randomUUID();

    const accessToken = signAccessToken({ userId, email, role });
    const refreshToken = signRefreshToken({ userId, email, role, tokenId, familyId });

    // Securely Hash Refresh Token before DB Storage
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        hashedToken,
        familyId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
