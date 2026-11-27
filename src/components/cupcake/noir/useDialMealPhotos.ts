import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { accountData, sessionSnapshot, subscribeSession } from '../accountSession';
import { useDataChanged } from '../dataChanges';
import { mealDay, mealIsCounted, validDay, type NutritionHistory } from '../nutritionModel';

type PhotoRead = { photo?: { dataUrl?: unknown } | null };
const MAX_PHOTOS = 3;
const MAX_THUMBNAIL_BYTES = 50 * 1024;
const NO_PHOTOS: string[] = [];

function thumbnailUrl(value: unknown): string | null {
  const prefix = 'data:image/jpeg;base64,';
  if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
  const length = value.length - prefix.length;
  if (length > 4 * Math.ceil(MAX_THUMBNAIL_BYTES / 3) || length % 4 !== 0) return null;
  return /^[a-z\d+/]+={0,2}$/i.test(value.slice(prefix.length)) ? value : null;
}

/** The authenticated account's last confirmed, photographed meals for this nutrition day. */
export function useDialMealPhotos(history: NutritionHistory | null, day: string, enabled: boolean): string[] {
  const { generation, identity } = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const [revision, setRevision] = useState(0);
  // Attaching a different photo changes the image even if the meal ID stays the same.
  useDataChanged(['food'], () => setRevision(value => value + 1));
  const candidates = useMemo(() => (history?.meals ?? [])
    .filter(meal => meal.id && meal.imageStored === true && /(?:Z|[+-]\d\d:\d\d)$/.test(meal.consumedAt ?? '')
      && mealIsCounted(meal) && mealDay(meal) === day)
    .map(meal => ({ id: meal.id, eaten: Date.parse(meal.consumedAt!) }))
    .sort((a, b) => b.eaten - a.eaten || a.id.localeCompare(b.id)), [history, day]);
  const selected = new Set<string>();
  const now = Date.now();
  if (enabled && identity && validDay(day)) {
    for (const meal of candidates) {
      if (meal.eaten <= now) selected.add(meal.id);
      if (selected.size === MAX_PHOTOS) break;
    }
  }
  const selection = JSON.stringify([...selected]);
  const confirmedEmpty = enabled && !!identity && !!history && selected.size === 0;
  const scope = JSON.stringify([generation, identity?.account_id, day, revision]);
  const cache = useRef({ scope, urls: new Map<string, string>() });
  const [result, setResult] = useState<{ scope: string; selection: string; photos: string[] } | null>(null);

  useEffect(() => {
    if (cache.current.scope !== scope) {
      cache.current = { scope, urls: new Map() };
      setResult(null);
    }
    const ids: string[] = JSON.parse(selection);
    if (!ids.length) {
      if (confirmedEmpty) {
        cache.current.urls.clear();
        setResult(null);
      }
      return;
    }
    const urls = cache.current.urls;
    for (const id of urls.keys()) if (!ids.includes(id)) urls.delete(id);
    const controller = new AbortController();
    async function read(id: string) {
      if (urls.has(id)) return urls.get(id);
      try {
        const data = await accountData<PhotoRead>({ action: 'food_photo_thumbnail', mealId: id }, controller.signal);
        const url = thumbnailUrl(data.photo?.dataUrl);
        if (url && !controller.signal.aborted) urls.set(id, url);
        return url;
      } catch {
        return null; // Decoration is optional, including on servers without thumbnails.
      }
    }
    void Promise.all(ids.map(read)).then(values => {
      if (!controller.signal.aborted && sessionSnapshot().generation === generation) {
        const photos = [...new Set(values.filter((value): value is string => !!value))];
        setResult({ scope, selection, photos });
      }
    });
    return () => controller.abort();
  }, [generation, scope, selection, confirmedEmpty]);

  return enabled && result?.scope === scope && result.selection === selection ? result.photos : NO_PHOTOS;
}
