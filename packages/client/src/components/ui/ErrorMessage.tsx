import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AppError } from '../../utils/errorHandler';

interface ErrorMessageProps {
  error: AppError | string;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onDismiss,
  className = '',
}) => {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div className={`flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-md ${className}`}>
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <p className="text-red-800 text-sm flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};