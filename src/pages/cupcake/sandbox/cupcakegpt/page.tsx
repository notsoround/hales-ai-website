import {loadWeightPage,type WeightRecord} from '../../../../components/cupcake/weightApi';
import {weightTime} from '../../../../components/cupcake/weightHistoryModel';
import {QuickReset} from '../../../../components/cupcake/QuickReset';
import {QuickChat} from '../../../../components/cupcake/QuickChat';
// CupcakeGPT — Matt's AI accountability app
// Chat + food-photo calorie tracking + live feed + week view.
// Talks to n8n webhooks on automate.hales.ai (CORS-enabled).

import CupcakeStudio from '../../../../components/cupcake/CupcakeStudio';
import React, { useState, useEffect, useRef, useCallback } from 'react';
// framer-motion intentionally not used: tab switches must render instantly and
// never depend on rAF (which throttles/freezes in backgrounded webviews).
import {
  Home, MessageCircle, Camera, Trophy, ArrowLeft, Mic, Volume2, VolumeX, Loader2, Headphones, Library, LockKeyhole,
} from 'lucide-react';
import { FeedDashboard, SignalDetail, type DashboardEntry, type DashboardRange, type DashboardStats, type FoodMeal } from '../../../../components/cupcake/DashboardView';
import { TALK_SEED_KEY, talkSeedFromIntervention } from '../../../../components/cupcake/dashboardModel';
import { libraryRequest } from '../../../../components/cupcake/library';

export const metadata = {
  title: 'CupcakeGPT',
  description: "Matt's AI accountability app — chat, snap your food for calories, and see everything Cupcake is tracking.",
  createdAt: '2026-08-09',
};

const API = 'https://automate.hales.ai/webhook';
// A private key must never be compiled into the public website bundle.
const TOKEN_STORAGE = 'cupcake-private-access';
const authHeaders = () => ({ 'X-Cupcake-Key': sessionStorage.getItem(TOKEN_STORAGE) || '' });
async function readJson(response: Response) {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}
async function updateIntervention(entry: DashboardEntry, note: string, boughtAnyway: boolean | null) {
  const details = entry.details || {};
  const response = await fetch(`${API}/cupcake-intervention-update`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: entry.id,
      note,
      boughtAnyway,
      merchant: details.merchant || String(entry.title || '').replace(/^Intervention:\s*/, ''),
      sheetDate: details.sheetDate || entry.date,
      sheetTime: details.sheetTime || entry.time || '',
    }),
  });
  await readJson(response);
}
const ICON = '/cupcake-avatar.jpg';

type FeedResponse = { nextCursor?:string|null; outcomes?:DashboardStats['outcomes']; items?: Array<FeedItem & { id?: string; calories?: number | null; amount?: number | null; currency?: string | null; details?: Record<string, unknown> }>; totals?: { calories?: number; spendUsd?: number; foodCount?: number; transactionCount?: number; weightLb?: number | null; weightDate?: string }; daily?: Array<{ date: string; calories?: number; spendUsd?: number }>; coverage?: { start: string; end: string; timezone?: string; complete?: boolean; returnedCount?: number; totalCount?: number; spendSource?: string; notes?: string[] } };
async function loadDashboardStats(range: DashboardRange, cursor?: string): Promise<DashboardStats> {
  const response = await fetch(`${API}/cupcake-feed?${range.preset==='all'?`scope=history${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`:`start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`}`, { headers: authHeaders(), cache: 'no-store' });
  const data = await readJson(response) as FeedResponse;
  const entries: DashboardEntry[] = (data.items || []).map((item, index) => ({ id: item.id || `${item.type}-${item.ts || index}`, type: item.type, date: item.date, time: item.time, title: item.title, body: item.body, amount: item.amount ?? null, currency: item.currency ?? null, calories: item.calories ?? null, details: item.details, icon: item.icon }));
  const coverageNote = data.coverage ? `${data.coverage.complete === false ? 'Partial coverage. ' : ''}${(data.coverage.notes || []).join(' ')}`.trim() : '';
  return { range: { start: range.preset==='all'?(data.coverage?.start||range.start):range.start, end: range.end, timezone: data.coverage?.timezone || 'America/Chicago', coverage: coverageNote, spendSource: data.coverage?.spendSource }, totals: { calories: data.totals?.calories || 0, spend: data.totals?.spendUsd || 0, currency: 'USD', weightLb: data.totals?.weightLb ?? null, weightDate: data.totals?.weightDate || '' }, series: (data.daily || []).map(day => ({ date: day.date, calories: day.calories || 0, spend: day.spendUsd || 0 })), entries, nextCursor:data.nextCursor,totalCount:data.coverage?.totalCount,outcomes:data.outcomes, coverage: coverageNote || (data.coverage?.complete === false ? 'Partial feed coverage; older entries may be omitted.' : undefined) };
}

type FeedItem = { id?: string; type: string; icon: string; title: string; body: string; date: string; time: string; ts: number; calories?: number | null; amount?: number | null; currency?: string | null; details?: { mealId?: string | null; [key: string]: unknown } };
type FoodResult = { meal?: FoodMeal; duplicate?: boolean; error?: boolean; Description?: string; description?: string; Calories?: number; calories?: number; Sugar?: number; sugar_g?: number; Protein?: number; protein_g?: number };

async function prepareFoodImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('This browser could not prepare the image.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = .86; let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (quality > .42 && (dataUrl.length > 1_700_000 || Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * .75) > 1_274_000)) { quality -= .08; dataUrl = canvas.toDataURL('image/jpeg', quality); }
    if (dataUrl.length > 1_700_000 || Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * .75) > 1_274_000) throw new Error('This image is still too large. Crop the food photo and try again.');
    return dataUrl;
  } finally { URL.revokeObjectURL(objectUrl); }
}

const tabs = [
  {key:'feed',label:'Today',Icon:Home}, {key:'talk',label:'Talk',Icon:Headphones},
  {key:'record',label:'Record',Icon:Mic}, {key:'library',label:'Library',Icon:Library},
  {key:'chat',label:'Chat',Icon:MessageCircle},
] as const;
type TabKey = (typeof tabs)[number]['key'] | 'snap' | 'week';
type InstallPrompt = Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const CupcakeGPT: React.FC = () => {
  const [tab,setTab]=useState<TabKey>(()=>{const q=new URLSearchParams(location.search);return (q.get('tab')==='library'||q.has('recording')||q.has('document')||q.has('analysis'))?'library':q.has('shared')?'record':q.get('tab')==='week'?'week':q.get('tab')==='chat'||q.has('thread')?'chat':q.get('tab')==='talk'?'talk':q.get('tab')==='record'?'record':q.get('tab')==='snap'?'snap':'feed';});
  const [quickAction,setQuickAction]=useState<'tip'|'reset'|null>(null);
  const [speak,setSpeak]=useState(false);const [unlocked,setUnlocked]=useState(false);
  const [keyInput,setKeyInput]=useState(()=>sessionStorage.getItem(TOKEN_STORAGE)||'');
  const [unlocking,setUnlocking]=useState(false);const [accessError,setAccessError]=useState('');
  const [mediaBusy,setMediaBusy]=useState(false);const [install,setInstall]=useState<InstallPrompt|null>(null);
  const openTalkAbout=(entry:DashboardEntry)=>{sessionStorage.setItem(TALK_SEED_KEY,JSON.stringify(talkSeedFromIntervention(entry)));setTab('talk');};
  const unlock=async(e:React.FormEvent)=>{e.preventDefault();if(!keyInput.trim()||unlocking)return;setUnlocking(true);setAccessError('');try{const r=await fetch(`${API}/cupcake-feed`,{headers:{'X-Cupcake-Key':keyInput.trim()},signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw Error();sessionStorage.setItem(TOKEN_STORAGE,keyInput.trim());setUnlocked(true);}catch{setAccessError('Check your Cupcake password and connection, then try again.');}finally{setUnlocking(false);}};
  useEffect(()=>{
    document.title='Cupcake — Your private companion';
    const links:HTMLLinkElement[]=[];
    for(const [rel,href] of [['manifest','/cupcake.webmanifest'],['apple-touch-icon','/cupcake-avatar.jpg']]){const l=document.createElement('link');l.rel=rel;l.href=href;document.head.appendChild(l);links.push(l);}
    if('serviceWorker'in navigator)void navigator.serviceWorker.register('/cupcake-sw.js',{scope:'/cupcake'}).catch(()=>{});
    const before=(e:Event)=>{e.preventDefault();setInstall(e as InstallPrompt);};window.addEventListener('beforeinstallprompt',before);
    return()=>{links.forEach(l=>l.remove());window.removeEventListener('beforeinstallprompt',before);};
  },[]);
  if(!unlocked)return <main className="cc-app"><form className="cc-unlock" onSubmit={unlock}><img src={ICON} alt="Cupcake"/><span className="cc-eyebrow">JUST BETWEEN US</span><h1>Your day.<br/>Your conversations.<br/><span style={{color:'#ffa3c5'}}>Your Cupcake.</span></h1><p>Talk, record, and keep track of what matters. Your private space works on your phone and computer.</p><label className="cc-label">Cupcake password<input type="password" autoComplete="off" required value={keyInput} onChange={e=>setKeyInput(e.target.value)}/></label><button className="cc-primary" disabled={unlocking}><LockKeyhole size={18}/>{unlocking?'Connecting…':'Open Cupcake'}</button>{accessError&&<p role="alert">{accessError}</p>}<p style={{fontSize:13}}>Your password stays in this tab for the session. Private recordings and feed data are never included in the public website.</p><a className="cc-text-button" href="/">← Hales.ai</a></form></main>;
  return <div className="cc-app"><header className="cc-top"><img src={ICON} alt=""/><div><strong>Cupcake</strong><small>Your private companion</small></div><button className="cc-secondary cc-lock" disabled={mediaBusy} onClick={()=>{sessionStorage.removeItem(TOKEN_STORAGE);setKeyInput('');setUnlocked(false);}}>Lock</button></header>
    <main className="cc-shell">
      {install&&<div className="cc-install"><button className="cc-text-button" onClick={()=>{void install.prompt().then(()=>install.userChoice).then(()=>setInstall(null));}}>Install Cupcake on this device ↗</button></div>}
      {!install&&<p className="cc-muted" style={{fontSize:12}}>To keep Cupcake handy: browser menu → Install app / Add to Home screen.</p>}
      {mediaBusy&&!['talk','record','library'].includes(tab)&&<button className="cc-live-bar" onClick={()=>setTab('record')}>Cupcake is working · open controls</button>}
      {tab==='feed'&&quickAction&&<QuickReset mode={quickAction} onBack={()=>setQuickAction(null)}/>}
      {tab==='feed'&&!quickAction&&<><div className="cc-welcome"><div><span className="cc-eyebrow">IN YOUR CORNER</span><h2>Hey, Matt.</h2><p>What are we conquering—or confessing?</p><div className="cc-shortcuts"><button className="cc-primary" onClick={()=>setTab('talk')}><Headphones size={18}/>Let's talk</button><button className="cc-secondary" onClick={()=>setTab('record')}><Mic size={18}/>Remember this</button></div></div><img src={ICON} alt="Cupcake, your companion"/></div><div className="cc-action-row"><button className="cc-secondary" onClick={()=>setQuickAction('tip')}>Quick tip</button><button className="cc-secondary" onClick={()=>setQuickAction('reset')}>Quick reset</button><button className="cc-secondary" onClick={()=>setTab('snap')}><Camera size={18}/>Food photo</button><button className="cc-secondary" onClick={()=>setTab('week')}><Trophy size={18}/>Wins &amp; losses</button></div><TodayWeight onOpen={()=>setTab('week')}/><details className="cc-card"><summary style={{fontSize:20,cursor:'pointer',minHeight:44}}>Your latest signals</summary><FeedView onTalkAbout={openTalkAbout}/></details></>}
      <div hidden={!['talk','record','library'].includes(tab)}><CupcakeStudio active={['talk','record','library'].includes(tab)} mode={tab==='talk'?'talk':tab==='library'?'library':'record'} onBusy={setMediaBusy}/></div>
      <div hidden={tab!=='chat'}><div className="cc-heading-row"><div><span className="cc-eyebrow">QUICK CHAT</span><p className="cc-muted">Everyday conversation with your context. Use Library for deeper strategy and saved analyses.</p></div><button className="cc-text-button" onClick={()=>setTab('library')}>Open strategist ↗</button></div><button className="cc-text-button" onClick={()=>setSpeak(!speak)}>{speak?<Volume2 size={18}/>:<VolumeX size={18}/>}Read replies aloud: {speak?'on':'off'}</button><ChatView active={tab==='chat'} speak={speak&&!mediaBusy} mediaBusy={mediaBusy}/></div>
      {tab==='snap'&&<SnapView/>}{tab==='week'&&<><button className="cc-text-button" onClick={()=>setTab('feed')}><ArrowLeft size={17}/>Back to Today</button><WeekView onTalkAbout={openTalkAbout}/></>}
    </main><nav className="cc-nav" aria-label="Cupcake"><div>{tabs.map(({key,label,Icon})=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}><Icon size={22}/>{label}</button>)}</div></nav>
  </div>;
};

function TodayWeight({onOpen}:{onOpen:()=>void}) {
 const [reading,setReading]=useState<WeightRecord|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;void loadWeightPage().then(p=>{if(live)setReading(p.latestMeasurement);}).catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 return <button className="cc-dashboard-card" onClick={onOpen}><strong>{loading?'Loading weight…':error?'Weight unavailable':reading?`${reading.weightLb.toFixed(1)} lb`:'No individual weigh-in yet'}</strong><span>{reading?`${reading.basis==='owner_corrected'?'Corrected by you · scale record':'Measured'} ${weightTime(reading.measuredAt)} · View history`:error?'Open history to retry':'Averages stay separate from scale readings.'}</span></button>;
}

// ---------- FEED ----------
const FeedView: React.FC<{ onTalkAbout?: (entry: DashboardEntry) => void }> = ({ onTalkAbout }) => {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [selected, setSelected] = useState<DashboardEntry | null>(null);
  const loadMeal = useCallback(async (mealId: string) => (await libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId })).meal, []);
  useEffect(() => {
    fetch(`${API}/cupcake-feed`, { headers: authHeaders() })
      .then(readJson)
      .then((d) => setItems(d.items || []))
      .catch(() => setErr(true));
  }, []);
  if (err) return <Empty text="Couldn't reach the feed. Try again in a sec." />;
  if (selected) return <SignalDetail entry={selected} onBack={() => setSelected(null)} loadMeal={loadMeal} updateIntervention={updateIntervention} onUpdated={() => setSelected(null)} onTalkAbout={onTalkAbout} />;
  if (!items) return <Spinner />;
  if (!items.length) return <Empty text="No recent records were returned. Your older history may still be available in Wins & losses." />;
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <button
          key={i}
          onClick={() => setSelected({ id: it.id || `${it.type}-${it.ts || i}`, type: it.type, date: it.date, time: it.time, title: it.title, body: it.body, calories: it.calories, amount: it.amount, currency: it.currency, details: it.details, icon: it.icon })}
          aria-label={`Open ${it.title}`}
          className="flex gap-3 items-start bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl px-4 py-3"
        >
          <div className="text-2xl leading-none mt-0.5">{it.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{it.title}</p>
            <p className="text-xs text-white/60">{it.body}</p>
          </div>
          <div className="text-[10px] text-white/30 whitespace-nowrap mt-1">{it.time?.replace(/:\d\d\s/, ' ')}</div>
        </button>
      ))}
    </div>
  );
};

// ---------- CHAT ----------
const ChatView = QuickChat;

// ---------- SNAP (food photo) ----------
const SnapView: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<FoodResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [portionNote, setPortionNote] = useState('');
  const [error, setError] = useState('');
  const [recentMeals, setRecentMeals] = useState<FoodMeal[]>([]);
  const fileRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null);

  const loadRecentMeals = useCallback(async () => { try { const data = await libraryRequest<{ meals: FoodMeal[] }>({ action: 'food_list', limit: 20 }); setRecentMeals(data.meals || []); } catch (e) { setError(e instanceof Error ? e.message : 'Recent food photos are unavailable.'); } }, []);
  useEffect(() => { void loadRecentMeals(); }, [loadRecentMeals]);

  const onFile = (f: File) => {
    if (busy) return;
    setError(''); setBusy(true);
    void prepareFoodImage(f).then(image => { setPreview(image); setResult(null); }).catch(e => setError(e instanceof Error ? e.message : 'Could not prepare that image.')).finally(() => setBusy(false));
  };

  const analyze = async () => {
    if (!preview || busy) return;
    setBusy(true); setResult(null); setError('');
    try { setResult(await libraryRequest<FoodResult>({ action: 'food_analyze', image: preview, note })); void loadRecentMeals(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Food analysis failed. The original image remains on this device.'); }
    finally { setBusy(false); }
  };

  const retry = async () => { const mealId = result?.meal?.id; if (!mealId || busy) return; setBusy(true); setError(''); try { setResult(await libraryRequest<FoodResult>({ action: 'food_retry', mealId })); void loadRecentMeals(); } catch (e) { setError(e instanceof Error ? e.message : 'Retry failed.'); } finally { setBusy(false); } };
  const refine = async () => { const mealId = result?.meal?.id; if (!mealId || !portionNote.trim() || busy) return; setBusy(true); setError(''); try { setResult(await libraryRequest<FoodResult>({ action: 'food_refine', mealId, note: portionNote.trim(), consumedPortions: { note: portionNote.trim() } })); setPortionNote(''); void loadRecentMeals(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the portion estimate.'); } finally { setBusy(false); } };
  const openMeal = async (mealId: string) => { if (busy) return; setBusy(true); setError(''); try { const data = await libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId }); setResult({ meal: data.meal }); setPreview(null); setPortionNote(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load that saved meal.'); } finally { setBusy(false); } };

  return (
    <div className="space-y-4">
      <div
        onClick={() => { if (!busy) cameraRef.current?.click(); }}
        className="relative aspect-square rounded-3xl border-2 border-dashed border-pink-500/30 bg-white/[0.03] overflow-hidden flex items-center justify-center cursor-pointer"
      >
        {preview ? (
          <img src={preview} alt="food" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-pink-200/50 px-6">
            <Camera size={40} className="mx-auto mb-3" />
            <p className="text-sm">Tap to snap or upload your meal</p>
            <p className="text-xs mt-1 text-white/30">Cupcake estimates the calories & sugar</p>
          </div>
        )}
      </div>
      <div className="cc-snap-actions"><button type="button" className="cc-secondary" disabled={busy} onClick={() => cameraRef.current?.click()}><Camera size={17} />Take photo</button><button type="button" className="cc-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>Choose existing photo</button></div>
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.currentTarget.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.currentTarget.value = ''; }} />
      {error && <p className="text-sm text-rose-200" role="alert">{error}</p>}

      {preview && (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…"
            className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm outline-none focus:border-pink-400/50 placeholder:text-white/30" />
          <button onClick={analyze} disabled={busy}
            className="w-full py-3.5 rounded-full font-semibold bg-gradient-to-r from-pink-500 to-rose-600 flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <><Loader2 className="animate-spin" size={18} /> Preparing…</> : 'Analyze food'}
          </button>
        </>
      )}

      {result && (
        <div className="bg-white/[0.05] border border-pink-500/20 rounded-2xl p-4">
          <p className="font-semibold text-pink-200">{result.meal?.description || result.Description || result.description || 'Food photo'}</p>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <Stat label="Calories" value={result.meal?.total?.calories ?? result.Calories ?? result.calories} />
            <Stat label="Sugar (g)" value={result.meal?.total?.sugar_g ?? result.Sugar ?? result.sugar_g} />
            <Stat label="Protein (g)" value={result.meal?.total?.protein_g ?? result.Protein ?? result.protein_g} />
          </div>
          {result.meal?.lookupWarnings?.map(warning => <p className="text-xs text-amber-200 mt-3" key={warning}>Variant warning: {warning}</p>)}
          {result.meal?.needsClarification && <><p className="text-xs text-amber-200 mt-3">Review needed: {result.meal.clarification || 'Some portions were unclear.'}</p><input value={portionNote} onChange={e => setPortionNote(e.target.value)} placeholder="Tell Cupcake the portion or variant…" className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm mt-3" /><button className="cc-secondary mt-3" disabled={busy || !portionNote.trim()} onClick={() => void refine()}>Update portion estimate</button></>}
          {result.meal?.status === 'analysis_failed' && <button className="cc-secondary mt-3" disabled={busy} onClick={() => void retry()}>Retry analysis</button>}
          {!!result.meal?.items?.length && <div className="cc-snap-items"><strong>Saved item estimates</strong>{result.meal.items.map(item => <div key={item.id}><span>{item.name}{item.quantity && item.quantity !== 1 ? ` × ${item.quantity}` : ''}</span><small>{item.nutrition?.calories ?? '—'} kcal · {item.provenance || 'estimate'}{item.variantWarning ? ` · ${item.variantWarning}` : ''}{item.calculation ? ` · ${item.calculation}` : ''}{item.sourceCitations?.map(source => /^https?:\/\//.test(source.url) ? <a key={source.url} href={source.url} target="_blank" rel="noreferrer"> · {source.title}</a> : null)}</small></div>)}</div>}
          {(result.meal?.totalIsPartial || (result.meal?.total && Object.values(result.meal.total).some(value => value == null))) && <p className="text-xs text-amber-200 mt-3">Partial estimate: some items or nutrients could not be estimated. Unknown values are left blank.</p>}
          {!result.error && <p className="text-xs text-emerald-300/70 mt-3">{result.meal?.sheetLoggedAt ? '✓ Logged to your food log' : '✓ Saved privately · food log row not confirmed'}{result.duplicate ? ' · already saved' : ''}</p>}
        </div>
      )}
      <section className="cc-snap-recent"><div className="cc-heading-row"><h3>Recent food photos</h3><button className="cc-text-button" disabled={busy} onClick={() => void loadRecentMeals()}>Refresh</button></div>{recentMeals.length ? recentMeals.map(meal => <button type="button" className="cc-snap-recent-item" key={meal.id} disabled={busy} onClick={() => void openMeal(meal.id)}><span><strong>{meal.description || 'Food photo'}</strong><small>{meal.createdAt ? new Date(meal.createdAt).toLocaleString() : 'Saved meal'} · {meal.sheetLoggedAt ? 'Logged' : meal.status === 'analysis_failed' ? 'Retry needed' : meal.needsClarification ? 'Review needed' : 'Ready'}</small></span><span>{meal.total?.calories ?? '—'} kcal</span></button>) : <p className="text-sm text-white/40">No saved food photos yet.</p>}</section>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-black/30 rounded-xl py-2">
    <div className="text-lg font-bold text-white">{value ?? '—'}</div>
    <div className="text-[10px] text-white/40">{label}</div>
  </div>
);

// ---------- WEEK ----------
const WeekView: React.FC<{ onTalkAbout?: (entry: DashboardEntry) => void }> = ({ onTalkAbout }) => {
  const loadMeal = useCallback(async (mealId: string) => (await libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId })).meal, []);
  return <FeedDashboard loadStats={loadDashboardStats} loadMeal={loadMeal} updateIntervention={updateIntervention} onTalkAbout={onTalkAbout} />;
};

// ---------- shared ----------
const Spinner = () => <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pink-400" size={28} /></div>;
const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center py-16 text-white/40 text-sm px-8">{text}</div>
);

export default CupcakeGPT;
