import { useEffect } from 'react';

const CUPCAKE_VIEWPORT = 'width=device-width, initial-scale=1';

/** Cupcake's phone viewport policy; restore the public site's policy on exit. */
export function useCupcakeViewport() {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const meta = existing || document.createElement('meta');
    const previous = meta.getAttribute('content');
    if (!existing) { meta.name = 'viewport'; document.head.append(meta); }
    meta.content = CUPCAKE_VIEWPORT;
    return () => {
      if (meta.content !== CUPCAKE_VIEWPORT) return;
      if (!existing) meta.remove();
      else if (previous == null) meta.removeAttribute('content');
      else meta.content = previous;
    };
  }, []);
}
