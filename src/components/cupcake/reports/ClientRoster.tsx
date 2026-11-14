/** The coach's client list: one row per active received authorization, opened with a tap, Enter or Space. */
import { useEffect, useRef } from 'react';
import './reports.css';

export type RosterGrant = { id: string; scopes: string[]; expires: number; ownerDisplayName?: string | null };

const until = (expires: number) => new Date(expires * 1000).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ClientRoster({ grants, name, scopeLabel, onOpen, focusId }: {
  grants: RosterGrant[]; name: (grant: RosterGrant) => string; scopeLabel: (scope: string) => string; onOpen: (grant: RosterGrant) => void; focusId?: string | null;
}) {
  const list = useRef<HTMLUListElement>(null);
  // Coming back from a report returns focus to the client that was open.
  useEffect(() => { if (focusId) list.current?.querySelector<HTMLButtonElement>(`[data-grant-id="${focusId}"]`)?.focus(); }, [focusId]);
  return <ul className="cc-rep-roster" ref={list} aria-label="Clients who shared reports with you">
    {grants.map((grant, index) => {
      const who = name(grant), scopes = grant.scopes.map(scopeLabel).join(' · ');
      return <li key={grant.id}>
        <button type="button" className="cc-rep-client" data-grant-id={grant.id} onClick={() => onOpen(grant)}>
          <span className="cc-rep-avatar" data-tone={index % 2 ? 'b' : 'a'} aria-hidden="true">{(who.trim()[0] || '?').toUpperCase()}</span>
          <span className="cc-rep-client-text">
            <strong>{who}</strong>
            <span>{scopes}</span>
            <small>Until {until(grant.expires)} CT</small>
          </span>
          <svg className="cc-rep-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </li>;
    })}
  </ul>;
}
