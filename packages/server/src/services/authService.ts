import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserRequest } from '../types/models';
import { getDatabase } from '../database';
import { 
  hashPassword, 
  verifyPassword, 
  generateAccessToken, 
  generateRefreshToken,
  validatePassword,
  validateEmail 
} from '../utils/auth';
import { getSessionManager, SessionManager, SessionData } from './sessionManager';

export interface LoginResult {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface RegisterResult {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export class AuthService {
  private db = getDatabase();
  private sessionManager = getSessionManager();

  /**
   * Register a new user
   */
  async register(userData: CreateUserRequest): Promise<RegisterResult> {
    // Validate input
    if (!validateEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    const passwordValidation = validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    if (!userData.name || userData.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    // Check if user already exists
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    // Create user
    const userId = uuidv4();
    const now = new Date();
    
    const defaultPreferences = {
      timeFormat: '24h' as const,
      weekStartDay: 1, // Monday
      notifications: true,
    };

    const query = `
      INSERT INTO users (id, email, name, password_hash, organization_id, role, preferences, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, name, organization_id, role, preferences, created_at, updated_at
    `;

    const values = [
      userId,
      userData.email.toLowerCase().trim(),
      userData.name.trim(),
      passwordHash,
      userData.organizationId || null,
      'user',
      JSON.stringify(defaultPreferences),
      now,
      now,
    ];

    const result = await this.db.query(query, values);
    const userRow = result.rows[0];

    const user: User = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      passwordHash: '', // Don't include password hash in response
      organizationId: userRow.organization_id,
      role: userRow.role,
      preferences: userRow.preferences,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    };

    // Create session and tokens
    const sessionId = uuidv4();
    const refreshTokenId = uuidv4();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);

    // Store session
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: new Date(),
      lastActivity: new Date(),
      refreshTokenId,
    };

    await this.sessionManager.createSession(sessionId, sessionData);
    await this.sessionManager.storeRefreshToken(refreshTokenId, user.id);

    return {
      user: { ...user, passwordHash: undefined } as Omit<User, 'passwordHash'>,
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Get user by email
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Create session and tokens
    const sessionId = uuidv4();
    const refreshTokenId = uuidv4();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);

    // Store session
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: new Date(),
      lastActivity: new Date(),
      refreshTokenId,
    };

    await this.sessionManager.createSession(sessionId, sessionData);
    await this.sessionManager.storeRefreshToken(refreshTokenId, user.id);

    return {
      user: { ...user, passwordHash: undefined } as Omit<User, 'passwordHash'>,
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token using the utility function
      const { verifyRefreshToken } = await import('../utils/auth');
      const decoded = verifyRefreshToken(refreshToken);
      
      if (!decoded.userId) {
        throw new Error('Invalid refresh token payload');
      }

      // Get user
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user.id);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: string, refreshTokenId?: string): Promise<void> {
    // Delete session
    await this.sessionManager.deleteSession(sessionId);
    
    // Delete refresh token if provided
    if (refreshTokenId) {
      await this.sessionManager.deleteRefreshToken(refreshTokenId);
    }
  }

  /**
   * Logout user from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await this.sessionManager.deleteUserSessions(userId);
    await this.sessionManager.deleteUserRefreshTokens(userId);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, password_hash, organization_id, role, preferences, created_at, updated_at
      FROM users 
      WHERE email = $1
    `;
    
    const result = await this.db.query(query, [email.toLowerCase().trim()]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      organizationId: row.organization_id,
      role: row.role,
      preferences: row.preferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, password_hash, organization_id, role, preferences, created_at, updated_at
      FROM users 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      organizationId: row.organization_id,
      role: row.role,
      preferences: row.preferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get user
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = $2
      WHERE id = $3
    `;
    
    await this.db.query(query, [newPasswordHash, new Date(), userId]);

    // Logout user from all devices for security
    await this.logoutAll(userId);
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const sessionData = await this.sessionManager.getSession(sessionId);
    
    if (!sessionData) {
      return null;
    }

    // Update last activity
    await this.sessionManager.updateActivity(sessionId);
    
    return sessionData;
  }
}

// Singleton instance
let authService: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}