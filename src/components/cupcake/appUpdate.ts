export function releaseEntry(src: string, base: string): string | null {
  try {
    const url = new URL(src, base);
    if (url.origin !== new URL(base).origin || !/^\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(url.pathname)) return null;
    return url.pathname;
  } catch { return null; }
}

export function releaseEntryFromHtml(html: string, base: string): string | null {
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    const type = tag.match(/\btype\s*=\s*(["'])(.*?)\1/i)?.[2];
    const src = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (type === 'module' && src) {
      const entry = releaseEntry(src, base);
      if (entry) return entry;
    }
  }
  return null;
}
