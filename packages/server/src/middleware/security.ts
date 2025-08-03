import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

// Enhanced security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'self'", "https://*.gohighlevel.com"],
      frameAncestors: ["'self'", "https://*.gohighlevel.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow iframe embedding
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests and API endpoints with valid JWT
  if (req.method === 'GET' || req.path.startsWith('/api/auth/')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID',
    });
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = DOMPurify.sanitize(req.body[field], {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
        });
      }
    });
    next();
  };
};

// Rate limiting for different endpoints
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message || 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Specific rate limits
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later.'
);

export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100 // 100 requests
);

export const timerRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  30 // 30 timer operations
);

// Input validation helpers
export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address');

export const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

export const validateProjectName = body('name')
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage('Project name must be between 1 and 100 characters');

export const validateTimeEntry = [
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
];

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map((error: any) => ({
        field: error.param,
        message: error.msg,
      })),
    });
  }
  next();
};

// Secure error response (no sensitive information leakage)
export const secureErrorResponse = (error: any, req: Request, res: Response) => {
  // Log full error details for debugging
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: (req as any).user?.userId,
    timestamp: new Date().toISOString(),
  });

  // Return sanitized error to client
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (error.code === 'VALIDATION_ERROR') {
    return res.status(400).json({
      error: 'Invalid input data',
      code: 'VALIDATION_ERROR',
    });
  }

  if (error.code === 'UNAUTHORIZED') {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }

  if (error.code === 'FORBIDDEN') {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
  }

  if (error.code === 'NOT_FOUND') {
    return res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND',
    });
  }

  // Generic server error
  res.status(500).json({
    error: 'An internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { details: error.message }),
  });
};

// CORS configuration for iframe embedding
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Allow GoHighLevel domains
    const allowedOrigins = [
      /^https:\/\/.*\.gohighlevel\.com$/,
      /^https:\/\/.*\.highlevel\.com$/,
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      }
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};

// Iframe-specific headers
export const iframeHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Allow iframe embedding from GoHighLevel
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', 
    "frame-ancestors 'self' https://*.gohighlevel.com https://*.highlevel.com"
  );
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
};