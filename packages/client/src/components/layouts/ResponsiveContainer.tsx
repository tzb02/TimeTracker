import React, { useEffect, useState } from 'react';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
}

type BreakpointSize = 'xs' | 'sm' | 'md' | 'lg';

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  const [breakpoint, setBreakpoint] = useState<BreakpointSize>('md');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 300) {
        setBreakpoint('xs');
      } else if (width < 500) {
        setBreakpoint('sm');
      } else if (width < 800) {
        setBreakpoint('md');
      } else {
        setBreakpoint('lg');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  const containerClasses = {
    xs: 'px-1 py-1 space-y-2',
    sm: 'px-2 py-2 space-y-3',
    md: 'px-4 py-3 space-y-4',
    lg: 'px-6 py-4 space-y-4',
  };

  return (
    <div 
      className={`w-full h-full ${containerClasses[breakpoint]} ${className}`}
      data-breakpoint={breakpoint}
    >
      {children}
    </div>
  );
};