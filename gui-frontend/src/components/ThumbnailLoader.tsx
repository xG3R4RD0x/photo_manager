import React, { useRef, useEffect } from 'react';

interface ThumbnailLoaderProps {
  photoPath: string;
  children: React.ReactNode;
}

export const ThumbnailLoader: React.FC<ThumbnailLoaderProps> = ({
  photoPath,
  children,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;
    elementRef.current.setAttribute('data-photo-path', photoPath);

    return () => {
      if (elementRef.current) {
        elementRef.current.removeAttribute('data-photo-path');
      }
    };
  }, [photoPath]);

  return (
    <div ref={elementRef} className="thumbnail-item">
      {children}
    </div>
  );
};

export default ThumbnailLoader;
