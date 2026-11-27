import { assertStorageScope, captureStorageScope } from '../personalStorage';
import { LOCAL_PHOTOS_CHANGED } from '../accountMealPhotoHandoff';

type Scope = ReturnType<typeof captureStorageScope>;
export type ReviewPhoto = { id: string; name: string; type: string; modified: number; savedAt: number };
function db(scope: Scope) {
  assertStorageScope(scope);
  return new Promise<IDBDatabase>((resolve, reject) => {
    const q = indexedDB.open(scope.namespace + 'camera-review-photos-v1', 1);
    q.onupgradeneeded = () => {
      q.result.createObjectStore('photos', { keyPath: 'id' });
      q.result.createObjectStore('media');
    };
    q.onerror = q.onblocked = () => reject(Error('Device photo storage is unavailable.'));
    q.onsuccess = () => resolve(q.result);
  });
}
async function run<T>(mode: IDBTransactionMode, scope: Scope, work: (tx: IDBTransaction, result: (v: T) => void) => void) {
  const database = await db(scope);
  try {
    assertStorageScope(scope);
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(['photos','media'], mode);
      let value: T;
      tx.oncomplete = () => { try { assertStorageScope(scope); resolve(value); } catch (error) { reject(error); } };
      tx.onabort = tx.onerror = () => reject(Error('Device photo storage is full or unavailable.'));
      work(tx, result => { value = result; });
    });
  } finally { database.close(); }
}
export function listReviewPhotos(scope: Scope) {
  return run<ReviewPhoto[]>('readonly', scope, (tx, done) => {
    const q=tx.objectStore('photos').getAll(); q.onsuccess=()=>done(q.result);
  });
}
export async function readReviewFile(row: ReviewPhoto, scope: Scope) {
  const bytes=await run<ArrayBuffer|undefined>('readonly',scope,(tx,done)=>{
    const q=tx.objectStore('media').get(row.id);q.onsuccess=()=>done(q.result);
  });
  if(!bytes) throw Error('The saved photo is no longer on this device.');
  return new File([bytes],row.name,{type:row.type,lastModified:row.modified});
}
export async function keepReviewPhoto(file: File, scope: Scope) {
  if (!file.size || file.size > 24 * 1024 * 1024) throw Error('Choose a photo smaller than 24 MB to keep on this device.');
  const bytes = await file.arrayBuffer();
  await run<void>('readwrite', scope, tx => {
    const photos=tx.objectStore('photos'), count=photos.count();
    count.onsuccess=()=>{
      if(count.result>=12){tx.abort();return;}
      const id=crypto.randomUUID();
      photos.add({id,name:file.name,type:file.type,modified:file.lastModified,savedAt:Date.now()});
      tx.objectStore('media').add(bytes,id);
    };
  });
  window.dispatchEvent(new Event(LOCAL_PHOTOS_CHANGED));
}
export async function removeReviewPhoto(id: string, scope: Scope) {
  await run<void>('readwrite', scope, tx => {tx.objectStore('photos').delete(id);tx.objectStore('media').delete(id);});
  window.dispatchEvent(new Event(LOCAL_PHOTOS_CHANGED));
}
