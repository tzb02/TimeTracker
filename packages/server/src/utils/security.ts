import crypto from 'crypto';
import bcrypt from 'bcrypt';

export class SecurityUtils {
  private static readonly SALT_ROUNDS = 12;
  private static readonly TOKEN_LENGTH = 32;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a cryptographically secure random token
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Generate a CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Sanitize user input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number, one special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  /**
   * Generate a secure session ID
   */
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a hash for data integrity verification
   */
  static createHash(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify data integrity hash
   */
  static verifyHash(data: string, hash: string, secret: string): boolean {
    const expectedHash = this.createHash(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(text: string, key: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: { encrypted: string; iv: string }, key: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Rate limiting helper - check if action is allowed
   */
  static isRateLimited(
    attempts: number,
    windowStart: Date,
    maxAttempts: number,
    windowMs: number
  ): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - windowStart.getTime();
    
    if (timeDiff > windowMs) {
      return false; // Window has expired
    }
    
    return attempts >= maxAttempts;
  }

  /**
   * Generate a secure API key
   */
  static generateApiKey(): string {
    const prefix = 'tk_';
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return prefix + randomPart;
  }

  /**
   * Validate API key format
   */
  static isValidApiKey(apiKey: string): boolean {
    return /^tk_[A-Za-z0-9_-]{32}$/.test(apiKey);
  }
}