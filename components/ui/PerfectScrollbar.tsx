'use client';

import { useEffect, useRef, ReactNode } from 'react';
import PerfectScrollbar from 'perfect-scrollbar';
import 'perfect-scrollbar/css/perfect-scrollbar.css';

interface PerfectScrollbarWrapperProps {
  children: ReactNode;
  className?: string;
}

export default function PerfectScrollbarWrapper({ children, className = '' }: PerfectScrollbarWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const psRef = useRef<PerfectScrollbar | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      psRef.current = new PerfectScrollbar(containerRef.current, {
        wheelSpeed: 1,
        wheelPropagation: false,
        minScrollbarLength: 20,
        suppressScrollX: true,
      });

      return () => {
        if (psRef.current) {
          psRef.current.destroy();
          psRef.current = null;
        }
      };
    }
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ position: 'relative' }}>
      {children}
    </div>
  );
}
