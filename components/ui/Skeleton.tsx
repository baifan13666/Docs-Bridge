import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({ 
  className = '', 
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClasses = 'bg-(--color-bg-tertiary)';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-(--color-bg-tertiary) via-(--color-bg-secondary) to-(--color-bg-tertiary) bg-[length:200%_100%]',
    none: ''
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

// Preset skeleton components for common use cases
export function FolderSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse">
      <Skeleton variant="circular" width={32} height={32} />
      <Skeleton variant="text" className="flex-1 h-4" />
    </div>
  );
}

export function DocumentSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse">
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1">
        <Skeleton variant="text" className="h-4 w-3/4 mb-2" />
        <Skeleton variant="text" className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="px-3 py-2.5 rounded-lg animate-pulse">
      <Skeleton variant="text" className="h-4 w-full mb-2" />
      <Skeleton variant="text" className="h-3 w-2/3" />
    </div>
  );
}

export function AttachmentSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl animate-pulse">
      <Skeleton variant="rectangular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton variant="text" className="h-4 w-3/4 mb-2" />
        <Skeleton variant="text" className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      <Skeleton variant="circular" width={32} height={32} className="shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="h-4 w-full" />
        <Skeleton variant="text" className="h-4 w-5/6" />
        <Skeleton variant="text" className="h-4 w-4/6" />
      </div>
    </div>
  );
}
