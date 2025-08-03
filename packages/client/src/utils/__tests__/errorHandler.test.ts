import { AxiosError } from 'axios';
import { ErrorHandler, withErrorHandling } from '../errorHandler';

describe('ErrorHandler', () => {
  describe('handleApiError', () => {
    it('handles 401 unauthorized errors', () => {
      const axiosError = new AxiosError('Unauthorized');
      axiosError.response = { status: 401, data: { message: 'Token expired' } } as any;

      const result = ErrorHandler.handleApiError(axiosError);

      expect(result).toEqual({
        message: 'Your session has expired. Please log in again.',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    });

    it('handles 403 forbidden errors', () => {
      const axiosError = new AxiosError('Forbidden');
      axiosError.response = { status: 403, data: { message: 'Access denied' } } as any;

      const result = ErrorHandler.handleApiError(axiosError);

      expect(result).toEqual({
        message: 'You do not have permission to perform this action.',
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });

    it('handles 404 not found errors', () => {
      const axiosError = new AxiosError('Not Found');
      axiosError.response = { status: 404, data: { message: 'Resource not found' } } as any;

      const result = ErrorHandler.handleApiError(axiosError);

      expect(result).toEqual({
        message: 'The requested resource was not found.',
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });

    it('handles 429 rate limit errors', () => {
      const axiosError = new AxiosError('Too Many Requests');
      axiosError.response = { status: 429, data: { message: 'Rate limited' } } as any;

      const result = ErrorHandler.handleApiError(axiosError);

      expect(result).toEqual({
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
        statusCode: 429,
      });
    });

    it('handles 500 server errors', () => {
      const axiosError = new AxiosError('Internal Server Error');
      axiosError.response = { status: 500, data: { message: 'Server error' } } as any;

      const result = ErrorHandler.handleApiError(axiosError);

      expect(result).toEqual({
        message: 'A server error occurred. Please try again.',
        code: 'SERVER_ERROR',
        statusCode: 500,
      });
    });

    it('handles generic Error objects', () => {
      const error = new Error('Generic error');

      const result = ErrorHandler.handleApiError(error);

      expect(result).toEqual({
        message: 'Generic error',
        code: 'CLIENT_ERROR',
      });
    });

    it('handles unknown errors', () => {
      const result = ErrorHandler.handleApiError('unknown error');

      expect(result).toEqual({
        message: 'An unexpected error occurred.',
        code: 'UNKNOWN_ERROR',
      });
    });
  });

  describe('createRetryHandler', () => {
    it('retries failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const retryHandler = ErrorHandler.createRetryHandler(operation, 3, 10);
      const result = await retryHandler();

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('throws error after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      const retryHandler = ErrorHandler.createRetryHandler(operation, 2, 10);

      await expect(retryHandler()).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('withErrorHandling', () => {
    it('wraps function with error handling', async () => {
      const mockFn = jest.fn().mockRejectedValue(new AxiosError('API Error'));
      const wrappedFn = withErrorHandling(mockFn, 'test context');

      await expect(wrappedFn()).rejects.toMatchObject({
        message: 'API Error',
        code: 'UNKNOWN_ERROR',
      });
    });

    it('passes through successful results', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = withErrorHandling(mockFn);

      const result = await wrappedFn();
      expect(result).toBe('success');
    });
  });
});