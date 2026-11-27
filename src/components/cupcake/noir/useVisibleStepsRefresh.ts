import { useEffect } from 'react';

const REFRESH_MS = 5 * 60_000;

/** The page loads steps on entry. Keep it current while open and when the user returns. */
export function useVisibleStepsRefresh(reload: () => void) {
  useEffect(() => {
    let timer: number | undefined;

    function schedule() {
      window.clearInterval(timer);
      if (document.visibilityState === 'visible') {
        timer = window.setInterval(reload, REFRESH_MS);
      }
    }

    function onVisibilityChange() {
      schedule();
      if (document.visibilityState === 'visible') reload();
    }

    schedule();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reload]);
}
