import { AxiosError } from 'axios';

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export class ErrorHandler {
  static handleApiError(error: unknown): AppError {
    if (error instanceof AxiosError) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      switch (statusCode) {
        case 401:
          return {
            message: 'Your session has expired. Please log in again.',
            code: 'UNAUTHORIZED',
            statusCode,
          };
        case 403:
          return {
            message: 'You do not have permission to perform this action.',
            code: 'FORBIDDEN',
            statusCode,
          };
        case 404:
          return {
            message: 'The requested resource was not found.',
            code: 'NOT_FOUND',
            statusCode,
          };
        case 429:
          return {
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
            statusCode,
          };
        case 500:
          return {
            message: 'A server error occurred. Please try again.',
            code: 'SERVER_ERROR',
            statusCode,
          };
        default:
          return {
            message: message || 'An unexpected error occurred.',
            code: 'UNKNOWN_ERROR',
            statusCode,
          };
      }
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'CLIENT_ERROR',
      };
    }

    return {
      message: 'An unexpected error occurred.',
      code: 'UNKNOWN_ERROR',
    };
  }

  static logError(error: AppError, context?: string) {
    console.error(`[${context || 'App'}] Error:`, error);
    
    // Send to error tracking service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: `${context ? `${context}: ` : ''}${error.message}`,
        fatal: false,
      });
    }
  }

  static createRetryHandler(
    operation: () => Promise<any>,
    maxRetries: number = 3,
    delay: number = 1000
  ) {
    return async (...args: any[]) => {
      let lastError: any;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation.apply(null, args);
        } catch (error) {
          lastError = error;
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, delay * Math.pow(2, attempt - 1))
          );
        }
      }
      
      throw lastError;
    };
  }
}

export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = ErrorHandler.handleApiError(error);
      ErrorHandler.logError(appError, context);
      throw appError;
    }
  }) as T;
};