import { useState, useEffect } from 'react';

interface IframeSize {
  width: number;
  height: number;
  isCompact: boolean;
  isVeryCompact: boolean;
}

export const useIframeSize = (): IframeSize => {
  const [size, setSize] = useState<IframeSize>({
    width: window.innerWidth,
    height: window.innerHeight,
    isCompact: window.innerWidth < 500 || window.innerHeight < 400,
    isVeryCompact: window.innerWidth < 350 || window.innerHeight < 300,
  });

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setSize({
        width,
        height,
        isCompact: width < 500 || height < 400,
        isVeryCompact: width < 350 || height < 300,
      });
    };

    window.addEventListener('resize', updateSize);
    
    // Also listen for iframe resize events
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  return size;
};