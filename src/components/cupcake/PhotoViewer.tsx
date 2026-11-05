import { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './photo-viewer.css';

export function PhotoViewer({ 
  photoUrl, 
  title, 
  onClose, 
  onPrevious, 
  onNext, 
  hasNext, 
  hasPrevious 
}: {
  photoUrl: string;
  title?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}) {
  const prevFocus = useRef<Element | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    containerRef.current?.focus();
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) onPrevious();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    };
    
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose, onPrevious, onNext, hasNext, hasPrevious]);

  return (
    <div 
      className="cc-photo-viewer" 
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Photo viewer'}
    >
      <div className="cc-photo-viewer-header">
        {title && <h2>{title}</h2>}
        <button 
          className="cc-icon-btn" 
          onClick={onClose}
          aria-label="Close photo viewer"
        >
          <X size={24} />
        </button>
      </div>

      <div className="cc-photo-viewer-content">
        <img src={photoUrl} alt={title || 'Photo'} />
      </div>

      {(onPrevious || onNext) && (
        <div className="cc-photo-viewer-nav">
          {onPrevious && (
            <button
              className="cc-photo-nav-btn cc-photo-nav-prev"
              onClick={onPrevious}
              disabled={!hasPrevious}
              aria-label="Previous photo"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          {onNext && (
            <button
              className="cc-photo-nav-btn cc-photo-nav-next"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next photo"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}

      <button className="cc-photo-close-btn" onClick={onClose} aria-label="Close">
        Back
      </button>
    </div>
  );
}
