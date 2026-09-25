import React, { CSSProperties, useRef } from 'react';

type SpotlightTone = 'electric' | 'lime' | 'violet';

interface SpotlightSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SpotlightTone;
  as?: 'div' | 'section';
}

/**
 * A local, GPU-cheap pointer light for large dashboard surfaces.
 * It intentionally tracks only its own bounds, so it does not add a global
 * pointer listener or compete with controls inside the surface.
 */
export function SpotlightSurface({ children, className = '', tone = 'electric', as: Tag = 'div', ...props }: SpotlightSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds) return;

    surfaceRef.current?.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
    surfaceRef.current?.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
  };

  const resetPointer = () => {
    surfaceRef.current?.style.removeProperty('--spotlight-x');
    surfaceRef.current?.style.removeProperty('--spotlight-y');
  };

  return (
    <Tag
      ref={surfaceRef}
      data-spotlight-tone={tone}
      onPointerMove={updatePointer}
      onPointerLeave={resetPointer}
      className={`spotlight-surface ${className}`}
      style={{ '--spotlight-x': '50%', '--spotlight-y': '50%' } as CSSProperties}
      {...props}
    >
      {children}
    </Tag>
  );
}
