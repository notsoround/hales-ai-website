import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
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
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
    contentRef.current?.scrollTo(0, 0);
  }, [photoUrl]);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = overflow;
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const changeZoom = (value: number) => {
    setZoom(Math.max(1, Math.min(3, value)));
    if (value <= 1) contentRef.current?.scrollTo(0, 0);
  };

  return (
    <div 
      className="cc-photo-viewer" 
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Photo viewer'}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        if (zoom === 1 && e.key === 'ArrowLeft' && hasPrevious && onPrevious) { e.preventDefault(); e.stopPropagation(); onPrevious(); }
        if (zoom === 1 && e.key === 'ArrowRight' && hasNext && onNext) { e.preventDefault(); e.stopPropagation(); onNext(); }
        if (e.key === 'Tab') {
          const targets = [...(containerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]') || [])].filter(el => el.getClientRects().length > 0);
          const first = targets[0], last = targets[targets.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === containerRef.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}
    >
      <div className="cc-photo-viewer-header">
        <h2>{title || 'Photo'}</h2>
        <button 
          ref={closeRef}
          className="cc-icon-btn" 
          onClick={onClose}
          aria-label="Close photo viewer"
        >
          <X size={24} />
        </button>
      </div>

      <div className="cc-photo-viewer-tools" role="group" aria-label="Photo zoom">
        <button type="button" onClick={() => changeZoom(zoom - .5)} disabled={zoom === 1} aria-label="Zoom out"><ZoomOut size={20}/></button>
        <button type="button" onClick={() => changeZoom(1)}>Fit photo</button>
        <span role="status" aria-label="Photo magnification">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(zoom + .5)} disabled={zoom === 3} aria-label="Zoom in"><ZoomIn size={20}/></button>
      </div>
      <div className="cc-photo-viewer-content" ref={contentRef} tabIndex={0} role="region" aria-label="Photo inspection area">
        <div className="cc-photo-viewer-stage" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <img src={photoUrl} alt={title || 'Photo'} />
        </div>
      </div>

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
          <button className="cc-photo-close-btn" onClick={onClose} aria-label="Close">Back</button>
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
    </div>
  );
}
