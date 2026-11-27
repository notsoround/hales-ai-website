/** One duration format for the account app: "1 h 34 m", "45 m", "2 h". Rounds to whole minutes first, so 59.6 minutes
 *  reads "1 h", never "0:60". Missing or invalid input reads "—". Pair with formatDurationSpoken for screen readers. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const total = Math.round(Math.abs(minutes)), h = Math.floor(total / 60), m = total % 60;
  const text = h && m ? `${h} h ${m} m` : h ? `${h} h` : `${m} m`;
  return minutes < 0 && total ? `−${text}` : text;
}

/** The same duration in words, e.g. "1 hour 34 minutes", "1 minute". */
export function formatDurationSpoken(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return 'unknown';
  const total = Math.round(Math.abs(minutes)), h = Math.floor(total / 60), m = total % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const text = h && m ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : h ? unit(h, 'hour') : unit(m, 'minute');
  return minutes < 0 && total ? `minus ${text}` : text;
}
