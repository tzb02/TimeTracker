import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

// Response compression middleware
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Good balance between compression ratio and speed
  threshold: 1024, // Only compress responses larger than 1KB
});

// Response time tracking
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
};

// Memory usage monitoring
export const memoryMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const memUsage = process.memoryUsage();
  
  // Log memory warnings
  if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
    console.warn(`High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  }
  
  res.setHeader('X-Memory-Usage', Math.round(memUsage.heapUsed / 1024 / 1024));
  next();
};

// Request size limiting
export const requestSizeLimiter = (maxSize: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize,
      });
    }
    
    next();
  };
};

// Database query performance monitoring
export const queryPerformanceMonitor = {
  startTiming: (queryName: string) => {
    return {
      queryName,
      startTime: Date.now(),
      end: function() {
        const duration = Date.now() - this.startTime;
        
        if (duration > 100) {
          console.warn(`Slow query: ${this.queryName} took ${duration}ms`);
        }
        
        return duration;
      }
    };
  }
};

// Cache headers for static assets
export const cacheHeaders = (maxAge: number = 3600) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.setHeader('ETag', `"${Date.now()}"`);
    }
    next();
  };
};

// API response optimization
export const optimizeApiResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Remove null/undefined values to reduce payload size
    const optimizedData = removeEmptyValues(data);
    
    // Add performance headers
    res.setHeader('X-Optimized', 'true');
    
    return originalJson.call(this, optimizedData);
  };
  
  next();
};

function removeEmptyValues(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeEmptyValues).filter(item => item !== null && item !== undefined);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeEmptyValues(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

// Health check endpoint
export const healthCheck = (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    version: process.env.npm_package_version || '1.0.0',
  });
};