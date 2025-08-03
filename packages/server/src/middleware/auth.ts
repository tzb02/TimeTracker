import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/auth';
import { getAuthService } from '../services/authService';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
      sessionId?: string;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // Verify the token
    const decoded = verifyAccessToken(token);
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    // Extract session ID from headers if provided
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      req.sessionId = sessionId;
      
      // Validate session if session ID is provided
      const authService = getAuthService();
      const sessionData = await authService.validateSession(sessionId);
      
      if (!sessionData || sessionData.userId !== decoded.userId) {
        res.status(401).json({ 
          error: 'Invalid session',
          code: 'INVALID_SESSION'
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
        return;
      }
      
      if (error.message.includes('invalid')) {
        res.status(401).json({ 
          error: 'Invalid token',
          code: 'TOKEN_INVALID'
        });
        return;
      }
    }

    res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
}

/**
 * Middleware to check if user has admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ 
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }

  next();
}

/**
 * Middleware to check if user can access resource (admin or owner)
 */
export function requireOwnershipOrAdmin(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // User can only access their own resources
    if (req.user.userId !== resourceUserId) {
      res.status(403).json({ 
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };

      // Handle session validation if session ID provided
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        req.sessionId = sessionId;
        
        const authService = getAuthService();
        const sessionData = await authService.validateSession(sessionId);
        
        if (sessionData && sessionData.userId === decoded.userId) {
          // Session is valid, keep user info
        } else {
          // Invalid session, remove user info
          req.user = undefined;
          req.sessionId = undefined;
        }
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    // Just proceed without user info
    req.user = undefined;
    req.sessionId = undefined;
    next();
  }
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export function authRateLimit(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key);
      }
    }

    const clientAttempts = attempts.get(clientId);
    
    if (!clientAttempts) {
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (now > clientAttempts.resetTime) {
      // Reset window
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientAttempts.count >= maxAttempts) {
      res.status(429).json({
        error: 'Too many authentication attempts',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000),
      });
      return;
    }

    clientAttempts.count++;
    next();
  };
}