import { useLayoutEffect } from 'react';
import type { Persona } from './assistantAppearance';

/** A public presentation hint only. Accounts and saved preferences remain server-bound. */
export function publicAssistantBrand() {
  const persona: Persona = new URLSearchParams(window.location.search).get('assistant') === 'matthieu' ? 'matthieu' : 'cupcake';
  return { persona, name: persona === 'matthieu' ? 'Matthieu' : 'Cupcake', appearance: persona === 'matthieu' ? 'rose' as const : 'caribbean' as const };
}

export const assistantIcon = (persona: Persona) => persona === 'matthieu' ? '/matthieu-avatar.png' : '/cupcake-avatar.jpg';
export const personalAssistantLabel = (name: string, owner: string) => `${name === 'Cupcake' ? 'MyCupcake' : name} — ${owner}`;

/** Metadata contains the public assistant name/icon, never account identity or data. */
export function useAssistantDocumentBrand(name: string, persona: Persona, enabled = true) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const previousTitle = document.title;
    document.title = `${name} — Your private companion`;
    const changes = ['icon', 'apple-touch-icon'].map(rel => {
      const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      const link = existing || document.createElement('link');
      const before = { href: link.getAttribute('href'), type: link.getAttribute('type') };
      link.rel = rel; link.href = assistantIcon(persona);
      link.type = persona === 'matthieu' ? 'image/png' : 'image/jpeg';
      if (!existing) document.head.appendChild(link);
      return () => {
        if (!existing) { link.remove(); return; }
        for (const [key, value] of Object.entries(before)) {
          if (value === null) link.removeAttribute(key); else link.setAttribute(key, value);
        }
      };
    });
    return () => { document.title = previousTitle; changes.forEach(restore => restore()); };
  }, [name, persona, enabled]);
}
