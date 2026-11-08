import { assertStorageScope, captureStorageScope, type StorageScope } from './personalStorage';

export type PhotoIntent = { request_id: string; image: string; consumed_at: string; photo_taken_at: string | null; photo_time_basis: 'file_last_modified' | 'user_entered' | 'unknown'; confirm_consumed: true; estimate_visible_portion: true; note?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validPhotoIntent(value: unknown): value is PhotoIntent {
  const row = value as PhotoIntent;
  return !!row && uuid.test(row.request_id) && typeof row.image === 'string' && row.image.length <= 1_700_000 && /^data:image\/(jpeg|png|webp);base64,/.test(row.image)
    && typeof row.consumed_at === 'string' && Number.isFinite(Date.parse(row.consumed_at)) && /(Z|[+-]\d\d:\d\d)$/.test(row.consumed_at)
    && row.confirm_consumed === true && row.estimate_visible_portion === true && (row.note === undefined || typeof row.note === 'string' && row.note.length <= 1000)
    && (row.photo_time_basis === 'unknown' ? row.photo_taken_at === null : ['file_last_modified', 'user_entered'].includes(row.photo_time_basis) && typeof row.photo_taken_at === 'string' && Number.isFinite(Date.parse(row.photo_taken_at)));
}
/** Browser recovery is bound to the account captured when the component mounted. */
export function photoDraftStore() {
  const scope: StorageScope = captureStorageScope();
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    assertStorageScope(scope);
    const request = indexedDB.open(scope.namespace + 'cupcake-food-photos-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'request_id' });
    request.onerror = () => reject(Error('Browser photo recovery is unavailable. No upload was started.'));
    request.onblocked = () => reject(Error('Close other photo windows and try again. No upload was started.'));
    request.onsuccess = () => { try { assertStorageScope(scope); resolve(request.result); } catch (error) { request.result.close(); reject(error); } };
  });
  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void) {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let value: T;
      const tx = db.transaction('drafts', mode);
      tx.oncomplete = () => { db.close(); try { assertStorageScope(scope); resolve(value); } catch (error) { reject(error); } };
      tx.onerror = tx.onabort = () => { db.close(); reject(Error('Your photo recovery could not be saved. No new upload was started.')); };
      try { assertStorageScope(scope); run(tx.objectStore('drafts'), result => { value = result; }); } catch (error) { tx.abort(); reject(error); }
    });
  }
  return {
    list: () => transaction<PhotoIntent[]>('readonly', (store, done) => { const query = store.getAll(); query.onsuccess = () => done(query.result.filter(validPhotoIntent)); }),
    save: (intent: PhotoIntent) => transaction<void>('readwrite', (store, done) => {
      if (!validPhotoIntent(intent)) throw Error('The photo request could not be confirmed.');
      const query = store.get(intent.request_id);
      query.onsuccess = () => {
        if (query.result && JSON.stringify(query.result) !== JSON.stringify(intent)) { store.transaction.abort(); return; }
        const count = store.count(); count.onsuccess = () => {
          if (!query.result && count.result >= 20) { store.transaction.abort(); return; }
          store.put(intent); done(undefined);
        };
      };
    }),
    remove: (id: string) => transaction<void>('readwrite', (store, done) => { store.delete(id); done(undefined); }),
  };
}
