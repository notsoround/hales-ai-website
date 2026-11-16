/** A quiet line when the phone loses its connection, and a short confirmation when it returns (which also refreshes
 *  the screens that show saved data). The app needs a connection; this only says so instead of failing silently. */
import { useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { notifyAllDataChanged } from './dataChanges';
import { useConnection, useResumed } from './nativeFeel';
import './noir/noir-native.css';

export function ConnectionNotice({ sassy = false }: { sassy?: boolean }) {
  const { online, back } = useConnection(), wasBack = useRef(false);
  useEffect(() => { if (back && !wasBack.current) notifyAllDataChanged(); wasBack.current = back; }, [back]);
  // Reopened after a while (like switching back to an app): show current numbers without a pull or a reload.
  useResumed(10 * 60_000, notifyAllDataChanged);
  if (online && !back) return null;
  return <p className="nx-net" role="status" data-state={online ? 'back' : 'off'}>
    {online ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
    <span>{online ? (sassy ? 'And we’re back. Catching up.' : 'Back online. Catching up.') : (sassy ? 'No signal. Showing what I already had.' : 'No connection. Showing what was already loaded.')}</span>
  </p>;
}
