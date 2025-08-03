import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { StringValue } from 'ms';
import { User } from '../types/models';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-change-in-production';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Salt rounds for bcrypt
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as StringValue,
    issuer: 'web-time-tracker',
    audience: 'web-time-tracker-client',
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
  const payload = {
    userId,
    type: 'refresh',
  };

  const options: jwt.SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as StringValue,
    issuer: 'web-time-tracker',
    audience: 'web-time-tracker-client',
  };

  return jwt.sign(payload, REFRESH_TOKEN_SECRET, options);
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'web-time-tracker',
      audience: 'web-time-tracker-client',
    });
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): any {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: 'web-time-tracker',
      audience: 'web-time-tracker-client',
    });
    
    if (typeof decoded === 'object' && decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}