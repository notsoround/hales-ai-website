const CACHE = 'cupcake-shell-v1';
const PUBLIC = ['/cupcake','/cupcake-avatar.jpg','/cupcake.webmanifest'];
// Entry-specific behavior, never a browser-wide mode changed by another tab.
// Account PWA/share support is staged: no cookie identity can own an OS share.
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(c => c.addAll(PUBLIC))); });
self.addEventListener('activate', event => { event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.delete('/cupcake-browser-mode');await self.clients.claim();})()); });
function saveShared(draft) { return new Promise((resolve,reject) => { const r=indexedDB.open('cupcake-recorder',1);r.onupgradeneeded=()=>{r.result.createObjectStore('drafts',{keyPath:'id'});r.result.createObjectStore('chunks',{keyPath:'id'});};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};}; }); }
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.method==='POST'&&/^\/cupcake\/account(?:\/|$)/.test(url.pathname)) {
    event.respondWith(Promise.resolve(new Response('Audio sharing is not available for account sign-in yet. Open your account and use Import audio; recordings stay on this device.',{status:409})));return;
  }
  if(event.request.method==='POST'&&url.pathname==='/cupcake/share') {
    event.respondWith((async()=>{try {const client=event.clientId?await self.clients.get(event.clientId):null;if(client&&/^\/cupcake\/account\/?$/.test(new URL(client.url).pathname))return new Response('Audio sharing is not available for account sign-in yet. Use Import audio in your account.',{status:409});const form=await event.request.formData(),audio=form.get('audio');if(!(audio instanceof Blob)||audio.size>1000000000)return new Response('Choose an audio file smaller than 1 GB.',{status:413});await saveShared({id:crypto.randomUUID(),title:String(form.get('title')||audio.name||'Shared recording').slice(0,120),startedAt:Date.now(),mime:audio.type||'audio/mp4',complete:true,blob:audio});return Response.redirect(new URL('/cupcake?shared=1',self.location.origin).href,303);}catch{return new Response('Could not save this recording. Open Cupcake and use Import audio.',{status:507});}})());return;
  }
  if(event.request.method!=='GET'||event.request.headers.has('X-Cupcake-Key'))return;
  if(url.pathname==='/cupcake'||url.pathname==='/cupcake/') {
    event.respondWith(fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();void caches.open(CACHE).then(c=>c.put('/cupcake',copy));}return r;}).catch(()=>caches.match('/cupcake').then(r=>r||new Response('Open Cupcake once while online to prepare this device.',{status:503}))));return;
  }
  if(url.pathname.startsWith('/assets/')||PUBLIC.includes(url.pathname))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();void caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;})));
});
