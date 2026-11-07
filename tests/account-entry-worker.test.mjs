import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/cupcake-sw.js', import.meta.url), 'utf8');
const origin = 'https://hales.ai';

/** In-memory browser surfaces only: no real IndexedDB, caches or networking. */
function worker() {
  const events = new Map(), stores = new Map(), clients = new Map([
    ['legacy', { id:'legacy', url:origin+'/cupcake?tab=record' }],
    ['account', { id:'account', url:origin+'/cupcake/account?tab=record' }],
    ['account-slash', { id:'account-slash', url:origin+'/cupcake/account/' }],
  ]);
  const cache = new Map([
    ['/cupcake-browser-mode', 'account'], ['/cupcake', 'legacy shell'],
    ['/assets/existing.js', 'existing asset'], ['/unrelated-key', 'keep this'],
  ]);
  const calls = { formData:0, opens:[], writes:[], closes:0, databaseDeletes:[],
    cacheOpens:[], entryDeletes:[], cacheDeletes:[], cachePuts:[], clientGets:[], claims:0, network:0 };
  const cacheAPI = {
    async addAll() {},
    async delete(key) { calls.entryDeletes.push(key); return cache.delete(key); },
    async put(key, value) { calls.cachePuts.push(key); cache.set(key, value); },
    async match(key) { return cache.get(key); },
  };
  let ids = 0;
  const sandbox = {
    URL, Blob, Response, Headers, Date, Promise,
    crypto:{ randomUUID:()=>`00000000-0000-4000-8000-${String(++ids).padStart(12,'0')}` },
    self:{ location:{ origin }, addEventListener(name, listener) { events.set(name, listener); },
      clients:{ async get(id) { calls.clientGets.push(id); return clients.get(id); }, async claim() { calls.claims++; } } },
    caches:{ async open(name) { calls.cacheOpens.push(name); return cacheAPI; },
      async match(key) { return cache.get(key); }, async delete(name) { calls.cacheDeletes.push(name); throw Error('Whole caches must not be deleted.'); } },
    indexedDB:{
      deleteDatabase(name) { calls.databaseDeletes.push(name); throw Error('Databases must not be deleted.'); },
      open(name, version) {
        calls.opens.push({name,version});
        const fresh = !stores.has(name);
        if (fresh) stores.set(name,new Map());
        const db = {
          createObjectStore() {}, close() { calls.closes++; },
          transaction(table, mode) {
            assert.equal(table,'drafts'); assert.equal(mode,'readwrite');
            const tx = { objectStore(actual) { assert.equal(actual,'drafts'); return { put(draft) {
              stores.get(name).set(draft.id,draft); calls.writes.push({name,draft});
              queueMicrotask(()=>tx.oncomplete?.());
            } }; } };
            return tx;
          },
        };
        const request = { result:db };
        queueMicrotask(()=>{ if(fresh)request.onupgradeneeded?.(); request.onsuccess?.(); });
        return request;
      },
    },
    fetch() { calls.network++; throw Error('Worker tests must never use the network.'); },
  };
  vm.runInNewContext(source,sandbox,{filename:'public/cupcake-sw.js'});
  async function lifecycle(name) {
    let pending;
    events.get(name)?.({waitUntil(value) { pending=value; }});
    await pending;
  }
  async function share(path,clientId='',forbidBody=false) {
    const audio = new Blob(['simulated audio only'],{type:'audio/webm'});
    Object.defineProperty(audio,'name',{value:'simulated.webm'});
    let pending;
    events.get('fetch')({clientId,request:{url:origin+path,method:'POST',headers:new Headers(),async formData() {
      calls.formData++; if(forbidBody)throw Error('Refused shares must not parse a body.');
      return new Map([['audio',audio],['title','Synthetic original']]);
    }},respondWith(value) { pending=value; }});
    assert.ok(pending,'The worker must handle this share explicitly.');
    return await pending;
  }
  async function message(accountSessions,client='account') {
    let pending;
    events.get('message')?.({source:{id:client},data:{type:'cupcake-browser-mode',accountSessions},waitUntil(value) { pending=value; }});
    await pending;
  }
  return {events,stores,cache,calls,share,message,lifecycle};
}

test('account and legacy messages cannot toggle path-specific share behavior', async()=>{
  const w=worker();
  assert.equal(w.events.has('message'),false);
  for(const mode of [true,false]) {
    await w.message(mode,mode?'account':'legacy');
    assert.equal((await w.share('/cupcake/share','legacy')).status,303);
    assert.equal((await w.share('/cupcake/share','account',true)).status,409);
  }
  assert.equal(w.cache.get('/cupcake-browser-mode'),'account','An old marker cannot disable legacy sharing.');
  assert.equal(w.calls.cachePuts.length,0);
  assert.equal(w.calls.network,0);
});

test('explicit account share POSTs refuse before parsing form data or opening IndexedDB', async()=>{
  const w=worker();
  for(const path of ['/cupcake/account/share','/cupcake/account','/cupcake/account/']) {
    assert.equal((await w.share(path,'',true)).status,409);
  }
  assert.equal(w.calls.formData,0); assert.equal(w.calls.opens.length,0); assert.equal(w.calls.writes.length,0);
});

test('account clients cannot send audio through the legacy share target', async()=>{
  const w=worker();
  for(const client of ['account','account-slash'])assert.equal((await w.share('/cupcake/share',client,true)).status,409);
  assert.equal(w.calls.formData,0); assert.equal(w.calls.opens.length,0); assert.equal(w.calls.writes.length,0);
});

for(const [name,client] of [['legacy client','legacy'],['OS share with no client','']]) {
  test(`${name} saves only an unbound original in the legacy recorder and redirects to legacy Cupcake`, async()=>{
    const w=worker(), response=await w.share('/cupcake/share',client);
    assert.equal(response.status,303); assert.equal(response.headers.get('location'),origin+'/cupcake?shared=1');
    assert.equal(w.calls.formData,1); assert.equal(w.calls.opens.length,1); assert.equal(w.calls.opens[0].name,'cupcake-recorder'); assert.equal(w.calls.opens[0].version,1);
    assert.equal(w.calls.writes.length,1); const {name,draft}=w.calls.writes[0];
    assert.equal(name,'cupcake-recorder'); assert.equal(draft.title,'Synthetic original'); assert.equal(draft.complete,true); assert.equal(draft.mime,'audio/webm');
    assert.equal(await draft.blob.text(),'simulated audio only'); assert.equal(Object.hasOwn(draft,'owner_id'),false); assert.equal(Object.hasOwn(draft,'storageScope'),false);
    assert.equal(w.calls.closes,1); assert.equal(w.calls.network,0);
    if(!client)assert.deepEqual(w.calls.clientGets,[]);
  });
}

test('activation removes only the obsolete mode entry and preserves caches and databases', async()=>{
  const w=worker(), before=new Map(w.cache);
  w.stores.set('cupcake-recorder',new Map([['keep',{id:'keep',title:'Synthetic existing original'}]]));
  await w.lifecycle('activate'); before.delete('/cupcake-browser-mode');
  assert.deepEqual([...w.cache],[...before]); assert.deepEqual(w.calls.entryDeletes,['/cupcake-browser-mode']);
  assert.deepEqual(w.calls.cacheOpens,['cupcake-shell-v1']); assert.deepEqual(w.calls.cacheDeletes,[]);
  assert.equal(w.calls.opens.length,0); assert.deepEqual(w.calls.databaseDeletes,[]); assert.equal(w.stores.get('cupcake-recorder').get('keep').title,'Synthetic existing original');
  assert.equal(w.calls.claims,1); assert.equal(w.calls.network,0);
});
