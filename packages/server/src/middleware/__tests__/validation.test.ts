import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { validate, handleValidationErrors } from '../validation';
import { AppError } from '../errorHandler';

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  body: jest.fn(() => ({
    isEmail: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('handleValidationErrors', () => {
    it('should call next() when no validation errors', () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      handleValidationErrors(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw AppError when validation errors exist', () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email',
            value: 'invalid-email'
          },
          {
            type: 'field',
            path: 'password',
            msg: 'Password too short',
            value: '123'
          }
        ]
      });

      expect(() => {
        handleValidationErrors(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should run all validations and call next on success', async () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      const mockValidation = {
        run: jest.fn().mockResolvedValue(undefined)
      } as any;
      const validations = [mockValidation];

      const middleware = validate(validations);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidation.run).toHaveBeenCalledWith(mockRequest);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw AppError when validations fail', async () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email',
            value: 'invalid-email'
          }
        ]
      });

      const mockValidation = {
        run: jest.fn().mockResolvedValue(undefined)
      } as any;
      const validations = [mockValidation];

      const middleware = validate(validations);

      await expect(
        middleware(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockValidation.run).toHaveBeenCalledWith(mockRequest);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});