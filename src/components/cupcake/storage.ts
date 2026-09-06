export type Draft = { id: string; title: string; startedAt: number; mime: string; complete: boolean; recordingId?: string; blob?: Blob };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cupcake-recorder', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('drafts', { keyPath: 'id' }); request.result.createObjectStore('chunks', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function putDraft(draft: Draft) { const db = await database(); return new Promise<void>((resolve, reject) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(draft); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
export async function putChunk(draftId: string, index: number, blob: Blob) { const db = await database(); return new Promise<void>((resolve, reject) => { const tx = db.transaction('chunks', 'readwrite'); tx.objectStore('chunks').put({ id: `${draftId}:${index}`, draftId, index, blob }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
export async function drafts(): Promise<Draft[]> { const db = await database(); return new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').getAll(); r.onsuccess = () => { db.close(); resolve(r.result); }; r.onerror = () => { db.close(); reject(r.error); }; }); }
export async function draftBlob(d: Draft) {
  if (d.blob) return d.blob;
  const db = await database();
  return new Promise<Blob>((resolve,reject)=>{
    const chunks:{index:number;blob:Blob}[]=[];
    const r=db.transaction('chunks').objectStore('chunks').openCursor(IDBKeyRange.bound(`${d.id}:`,`${d.id}:\uffff`));
    r.onsuccess=()=>{const c=r.result;if(c){chunks.push({index:c.value.index,blob:c.value.blob});c.continue();}else{db.close();resolve(new Blob(chunks.sort((a,b)=>a.index-b.index).map(c=>c.blob),{type:d.mime}));}};
    r.onerror=()=>{db.close();reject(r.error);};
  });
}
export async function deleteDraft(id: string) { const db = await database(); return new Promise<void>((resolve, reject) => { const tx = db.transaction(['drafts', 'chunks'], 'readwrite'); tx.objectStore('drafts').delete(id); const c = tx.objectStore('chunks').openCursor(); c.onsuccess = () => { const v = c.result; if (v) { if (v.value.draftId === id) v.delete(); v.continue(); } }; tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
