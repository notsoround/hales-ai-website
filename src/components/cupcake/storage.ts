import { assertStorageScope, captureStorageScope, type StorageScope } from './personalStorage';

export type Draft = { id: string; title: string; startedAt: number; mime: string; complete: boolean; recordingId?: string; blob?: Blob; storageScope?: string };
function checkDraft(draft: Draft, scope: StorageScope) {
  assertStorageScope(scope);
  if (draft.storageScope !== undefined && draft.storageScope !== scope.namespace) throw Error('This recording belongs to another browser account.');
}
function database(scope: StorageScope): Promise<IDBDatabase> {
  assertStorageScope(scope);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(scope.namespace + 'cupcake-recorder', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('drafts', { keyPath: 'id' }); request.result.createObjectStore('chunks', { keyPath: 'id' }); };
    request.onsuccess = () => { try { assertStorageScope(scope); resolve(request.result); } catch (error) { request.result.close(); reject(error); } };
    request.onerror = () => reject(request.error);
  });
}
async function write(stores: string[], scope: StorageScope, operation: (tx: IDBTransaction) => void) {
  const db = await database(scope);
  return new Promise<void>((resolve, reject) => {
    try {
      assertStorageScope(scope);
      const tx = db.transaction(stores, 'readwrite'); operation(tx);
      tx.oncomplete = () => { db.close(); try { assertStorageScope(scope); resolve(); } catch (error) { reject(error); } };
      tx.onerror = () => { db.close(); reject(tx.error); };
    } catch (error) { db.close(); reject(error); }
  });
}
export async function putDraft(draft: Draft, scope = captureStorageScope()) {
  checkDraft(draft, scope);
  // Carry the captured owner through delayed recording stop/import/upload work.
  // Flag-off legacy drafts retain their original shape and database.
  if (scope.namespace) draft.storageScope = scope.namespace;
  return write(['drafts'], scope, tx => { tx.objectStore('drafts').put(draft); });
}
export async function putChunk(draftId: string, index: number, blob: Blob, scope = captureStorageScope()) {
  return write(['chunks'], scope, tx => { tx.objectStore('chunks').put({ id: `${draftId}:${index}`, draftId, index, blob }); });
}
export async function drafts(scope = captureStorageScope()): Promise<Draft[]> {
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const r = db.transaction('drafts').objectStore('drafts').getAll();
    r.onsuccess = () => { db.close(); try { assertStorageScope(scope); r.result.forEach(d => checkDraft(d, scope)); resolve(r.result); } catch (error) { reject(error); } };
    r.onerror = () => { db.close(); reject(r.error); };
  });
}
export async function draftBlob(draft: Draft, scope = captureStorageScope()) {
  checkDraft(draft, scope);
  if (draft.blob) return draft.blob;
  const db = await database(scope);
  return new Promise<Blob>((resolve, reject) => {
    const chunks: { index: number; blob: Blob }[] = [];
    const r = db.transaction('chunks').objectStore('chunks').openCursor(IDBKeyRange.bound(`${draft.id}:`, `${draft.id}:\uffff`));
    r.onsuccess = () => { const cursor = r.result; if (cursor) { chunks.push(cursor.value); cursor.continue(); } else { db.close(); try { assertStorageScope(scope); resolve(new Blob(chunks.sort((a,b) => a.index-b.index).map(c => c.blob), { type:draft.mime })); } catch (error) { reject(error); } } };
    r.onerror = () => { db.close(); reject(r.error); };
  });
}
export async function deleteDraft(id: string, scope = captureStorageScope()) {
  return write(['drafts','chunks'], scope, tx => {
    tx.objectStore('drafts').delete(id);
    const cursor = tx.objectStore('chunks').openCursor();
    cursor.onsuccess = () => { const row = cursor.result; if (row) { if (row.value.draftId === id) row.delete(); row.continue(); } };
  });
}
