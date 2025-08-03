import { Request, Response, NextFunction } from 'express';
import { iframeHeaders, corsOptions } from '../security';

// Mock Express request and response objects
const createMockReq = (headers: Record<string, string> = {}): Partial<Request> => ({
  get: (name: string) => headers[name.toLowerCase()] as any,
  headers: headers as any,
});

const createMockRes = (): Partial<Response> => {
  const headers: Record<string, string> = {};
  const mockRes: any = {
    setHeader: jest.fn((name: string, value: string): any => {
      headers[name] = value;
      return mockRes;
    }),
    removeHeader: jest.fn((name: string): any => {
      delete headers[name];
      return mockRes;
    }),
    getHeader: jest.fn((name: string) => headers[name]),
    _headers: headers,
  };
  return mockRes;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Iframe Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = createMockReq();
    mockRes = createMockRes();
    mockNext = createMockNext();
    
    // Reset environment
    delete process.env.NODE_ENV;
    delete process.env.ALLOWED_IFRAME_DOMAINS;
  });

  describe('iframeHeaders middleware', () => {
    it('should set SAMEORIGIN for development environment', () => {
      process.env.NODE_ENV = 'development';
      
      iframeHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Iframe-Compatible', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow framing from GoHighLevel domains', () => {
      process.env.NODE_ENV = 'production';
      mockReq = createMockReq({
        'origin': 'https://app.gohighlevel.com',
      });

      iframeHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Frame-Options');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Iframe-Compatible', 'true');
    });

    it('should deny framing from unknown domains', () => {
      process.env.NODE_ENV = 'production';
      mockReq = createMockReq({
        'origin': 'https://malicious-site.com',
      });

      iframeHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should handle iframe-specific headers', () => {
      mockReq = createMockReq({
        'x-iframe-request': 'true',
      });

      iframeHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Iframe-Restrictions', expect.any(String));
    });

    it('should set security headers', () => {
      iframeHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should handle custom allowed domains from environment', () => {
      process.env.ALLOWED_IFRAME_DOMAINS = 'custom.domain.com,another.domain.com';
      mockReq = createMockReq({
        'origin': 'https://custom.domain.com',
      });

      iframeHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Frame-Options');
    });
  });

  describe('CORS configuration', () => {
    it('should allow requests with no origin', (done) => {
      corsOptions.origin!(undefined, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should allow GoHighLevel domains', (done) => {
      const allowedOrigins = [
        'https://app.gohighlevel.com',
        'https://agency.gohighlevel.com',
        'https://app.highlevel.com',
        'https://agency.highlevel.com',
      ];

      let completed = 0;
      allowedOrigins.forEach(origin => {
        corsOptions.origin!(origin, (err, allow) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          completed++;
          if (completed === allowedOrigins.length) {
            done();
          }
        });
      });
    });

    it('should allow GoHighLevel subdomain patterns', (done) => {
      const subdomainOrigins = [
        'https://custom.gohighlevel.com',
        'https://client.highlevel.com',
        'https://app.custom.gohighlevel.com',
      ];

      let completed = 0;
      subdomainOrigins.forEach(origin => {
        corsOptions.origin!(origin, (err, allow) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          completed++;
          if (completed === subdomainOrigins.length) {
            done();
          }
        });
      });
    });

    it('should block unauthorized domains', (done) => {
      const unauthorizedOrigins = [
        'https://malicious-site.com',
        'https://fake-gohighlevel.com',
        'http://app.gohighlevel.com', // HTTP instead of HTTPS
      ];

      let completed = 0;
      unauthorizedOrigins.forEach(origin => {
        corsOptions.origin!(origin, (err, allow) => {
          expect(err).toBeInstanceOf(Error);
          expect(allow).toBe(false);
          completed++;
          if (completed === unauthorizedOrigins.length) {
            done();
          }
        });
      });
    });

    it('should allow development origins in development mode', (done) => {
      process.env.NODE_ENV = 'development';
      
      const devOrigins = [
        'http://localhost:3000',
        'https://localhost:5173',
        'http://127.0.0.1:3000',
      ];

      let completed = 0;
      devOrigins.forEach(origin => {
        corsOptions.origin!(origin, (err, allow) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          completed++;
          if (completed === devOrigins.length) {
            done();
          }
        });
      });
    });

    it('should include iframe-specific headers in allowed headers', () => {
      expect(corsOptions.allowedHeaders).toContain('X-Iframe-Compatible');
      expect(corsOptions.allowedHeaders).toContain('X-Iframe-Request');
      expect(corsOptions.allowedHeaders).toContain('X-Parent-Origin');
    });

    it('should expose iframe-specific headers', () => {
      expect(corsOptions.exposedHeaders).toContain('X-Iframe-Compatible');
      expect(corsOptions.exposedHeaders).toContain('X-Iframe-Restrictions');
      expect(corsOptions.exposedHeaders).toContain('X-Fallback-Mode');
    });

    it('should allow credentials for authentication', () => {
      expect(corsOptions.credentials).toBe(true);
    });

    it('should include all necessary HTTP methods', () => {
      const expectedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
      expectedMethods.forEach(method => {
        expect(corsOptions.methods).toContain(method);
      });
    });
  });

  describe('Environment-based configuration', () => {
    it('should handle custom iframe origins from environment', (done) => {
      process.env.ALLOWED_IFRAME_ORIGINS = 'https://custom1.com,https://custom2.com';
      
      // Re-import to get updated configuration
      delete require.cache[require.resolve('../security')];
      const { corsOptions: updatedCorsOptions } = require('../security');

      updatedCorsOptions.origin!('https://custom1.com', (err: any, allow: any) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should handle production vs development configurations', () => {
      // Test production mode
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../security')];
      let { corsOptions: prodCorsOptions } = require('../security');

      // Test development mode
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../security')];
      let { corsOptions: devCorsOptions } = require('../security');

      // Both should be defined but may have different allowed origins
      expect(prodCorsOptions).toBeDefined();
      expect(devCorsOptions).toBeDefined();
    });
  });
});