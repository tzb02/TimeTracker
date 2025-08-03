import { corsOptions } from '../middleware/security';
import { apiLimiter } from '../middleware/rateLimiter';
import { errorHandler, AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';

describe('API Foundation Components', () => {
  describe('CORS Configuration', () => {
    it('should allow localhost origins', (done) => {
      const origin = 'http://localhost:3000';
      corsOptions.origin!(origin, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should allow GoHighLevel domains', (done) => {
      const origin = 'https://app.gohighlevel.com';
      corsOptions.origin!(origin, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should reject unauthorized origins', (done) => {
      const origin = 'https://malicious-site.com';
      corsOptions.origin!(origin, (err, allow) => {
        expect(err).toBeInstanceOf(Error);
        expect(allow).toBe(false);
        done();
      });
    });
  });

  describe('Rate Limiter', () => {
    it('should be configured with proper limits', () => {
      expect(apiLimiter).toBeDefined();
      // Rate limiter configuration is tested through middleware tests
    });
  });

  describe('Error Handler', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
    });
  });

  describe('Validation Middleware', () => {
    it('should create validation middleware', () => {
      const validations = [
        body('email').isEmail(),
        body('password').isLength({ min: 6 })
      ];
      const middleware = validate(validations);
      expect(middleware).toBeInstanceOf(Function);
    });
  });
});