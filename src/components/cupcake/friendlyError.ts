/** Server errors in the account app already arrive as plain sentences. A failed fetch or a broken response does not: it
 *  carries browser or route text ("Failed to fetch", "…recordings/list"). Show one friendly line for those and keep the
 *  raw text for a details toggle. */
export function friendlyError(reason: unknown, fallback: string): { text: string; raw: string } {
  const raw = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  const technical = !raw || reason instanceof TypeError || reason instanceof SyntaxError
    || /\b[a-z]+(?:[_-][a-z]+)*\/[a-z_/-]+\b|failed to fetch|load failed|networkerror|unexpected token|\bjson\b/i.test(raw);
  return technical ? { text: fallback, raw } : { text: raw, raw: '' };
}
