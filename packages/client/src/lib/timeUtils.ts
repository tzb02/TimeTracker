/**
 * Utility functions for time formatting and calculations
 */

/**
 * Format seconds into HH:MM:SS format
 */
export const formatElapsedTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Format seconds into a human-readable duration (e.g., "2h 30m", "45m", "30s")
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Calculate elapsed time from a start time to now
 */
export const calculateElapsedTime = (startTime: Date | string): number => {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  return Math.floor((Date.now() - start.getTime()) / 1000);
};

/**
 * Parse ISO date string to Date object safely
 */
export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

/**
 * Format date to ISO string for API requests
 */
export const formatDateForApi = (date: Date): string => {
  return date.toISOString();
};