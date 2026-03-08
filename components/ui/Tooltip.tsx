'use client';

import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;

      // If not enough space above, show below
      if (spaceAbove < tooltipRect.height + 10 && spaceBelow > tooltipRect.height + 10) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isVisible]);

  return (
    <span className="relative inline-block">
      <span
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className={className}
      >
        {children}
      </span>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-xs bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg min-w-[200px] max-w-[300px] ${
            position === 'top' 
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' 
              : 'top-full left-1/2 -translate-x-1/2 mt-2'
          }`}
          style={{ pointerEvents: 'none' }}
        >
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45 ${
              position === 'top' ? 'bottom-[-4px]' : 'top-[-4px]'
            }`}
          />
          
          {/* Content */}
          <div className="relative z-10">
            {content}
          </div>
        </div>
      )}
    </span>
  );
}
