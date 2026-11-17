import { assertStorageScope, captureStorageScope } from './personalStorage';

export type ReceiptPhotoIntent = { request_id: string; image: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validIntent(value: unknown): value is ReceiptPhotoIntent {
  const intent = value as ReceiptPhotoIntent;
  return !!intent && uuid.test(intent.request_id) && typeof intent.image === 'string'
    && intent.image.length <= 1_700_000 && /^data:image\/(jpeg|png|webp);base64,/.test(intent.image);
}

/** Keep the exact pending photo with its original account until its save is confirmed. */
export function receiptDraftStore() {
  const scope = captureStorageScope();
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    assertStorageScope(scope);
    const request = indexedDB.open(scope.namespace + 'cupcake-receipt-photos-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'request_id' });
    request.onerror = () => reject(Error('Receipt photo recovery is unavailable. The upload did not start.'));
    request.onblocked = () => reject(Error('Close other receipt windows and try again.'));
    request.onsuccess = () => {
      try { assertStorageScope(scope); resolve(request.result); }
      catch (error) { request.result.close(); reject(error); }
    };
  });
  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void) {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let result: T;
      const tx = db.transaction('drafts', mode);
      tx.oncomplete = () => { db.close(); try { assertStorageScope(scope); resolve(result); } catch (error) { reject(error); } };
      tx.onerror = tx.onabort = () => { db.close(); reject(Error('The receipt photo could not be saved on this device.')); };
      try { assertStorageScope(scope); run(tx.objectStore('drafts'), value => { result = value; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  return {
    list: () => transaction<ReceiptPhotoIntent[]>('readonly', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => done(request.result.filter(validIntent));
    }),
    save: (intent: ReceiptPhotoIntent) => transaction<void>('readwrite', (store, done) => {
      if (!validIntent(intent)) throw Error('The receipt photo request is invalid.');
      const existing = store.get(intent.request_id);
      existing.onsuccess = () => {
        if (existing.result && JSON.stringify(existing.result) !== JSON.stringify(intent)) { store.transaction.abort(); return; }
        const count = store.count();
        count.onsuccess = () => {
          if (!existing.result && count.result >= 20) { store.transaction.abort(); return; }
          store.put(intent); done(undefined);
        };
      };
    }),
    remove: (id: string) => transaction<void>('readwrite', (store, done) => { store.delete(id); done(undefined); }),
  };
}
