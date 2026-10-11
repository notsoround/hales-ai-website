import {loadWeightPage,weightProvenanceLabel,type WeightRecord} from '../../../../components/cupcake/weightApi';
import {weightTime} from '../../../../components/cupcake/weightHistoryModel';
import {QuickReset} from '../../../../components/cupcake/QuickReset';
import {QuickChat} from '../../../../components/cupcake/QuickChat';
// CupcakeGPT — Matt's AI accountability app
// Chat + food-photo calorie tracking + live feed + week view.
// Talks to n8n webhooks on automate.hales.ai (CORS-enabled).

import CupcakeStudio from '../../../../components/cupcake/CupcakeStudio';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
// framer-motion intentionally not used: tab switches must render instantly and
// never depend on rAF (which throttles/freezes in backgrounded webviews).
import {
  Home, MessageCircle, Camera, Trophy, ArrowLeft, Mic, Volume2, VolumeX, Loader2, Headphones, Library, LockKeyhole,
} from 'lucide-react';
import { FeedDashboard, SignalDetail, type DashboardEntry, type DashboardRange, type DashboardStats, type FoodMeal } from '../../../../components/cupcake/DashboardView';
import { TALK_SEED_KEY, talkSeedFromIntervention } from '../../../../components/cupcake/dashboardModel';
import { libraryRequest } from '../../../../components/cupcake/library';
import { LibraryApprovalCancelled } from '../../../../components/cupcake/libraryApproval';
import { MealTimeInput } from '../../../../components/cupcake/MealTimeInput';
import { AppUpdateNotice } from '../../../../components/cupcake/AppUpdateNotice';
import { PRIVATE_ACCESS_STORAGE, readPrivateAccess, savePrivateAccess, clearPrivateAccess, privateAccessHeaders } from '../../../../components/cupcake/privateAccess';

export const metadata = {
  title: 'CupcakeGPT',
  description: "Matt's AI accountability app — chat, snap your food for calories, and see everything Cupcake is tracking.",
  createdAt: '2026-08-09',
};

const API = 'https://automate.hales.ai/webhook';
const authHeaders = privateAccessHeaders;
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
type FoodResult = { meal?: FoodMeal; duplicate?: boolean; error?: boolean; Description?: string; description?: string; Calories?: number; calories?: number; Sugar?: number; sugar_g?: number; Protein?: number; protein_g?: number; Carbs?: number; carbs_g?: number };

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
type AccessGate = 'form' | 'opening' | 'retry' | 'ready';
const TAB_KEYS: readonly TabKey[] = ['feed', 'talk', 'record', 'library', 'chat', 'snap', 'week'];

function tabFromSearch(search: string): TabKey {
  const params = new URLSearchParams(search);
  const explicit = params.get('tab');
  if (explicit && (TAB_KEYS as readonly string[]).includes(explicit)) return explicit as TabKey;
  if (explicit == null) {
    if (params.has('recording') || params.has('document') || params.has('analysis')) return 'library';
    if (params.has('shared')) return 'record';
    if (params.has('thread')) return 'chat';
  }
  return 'feed';
}
function tabHref(next: TabKey) {
  const url = new URL(location.href);
  url.searchParams.set('tab', next);
  return `${url.pathname}${url.search}${url.hash}`;
}
function historyBase(): Record<string, unknown> {
  const current = history.state;
  return current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
}
function uncountedFoodState(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return normalized === 'estimate-only' || normalized === 'review-needed' || normalized === 'needs-review';
}
function foodFieldSources(item: FeedItem): Record<string, unknown>[] {
  const sources: Record<string, unknown>[] = [];
  if (item.details && typeof item.details === 'object') sources.push(item.details);
  const top = item as FeedItem & Record<string, unknown>;
  if (['countedInTotals', 'logState', 'status', 'sheetLoggedAt'].some(key => Object.prototype.hasOwnProperty.call(top, key))) sources.push(top);
  return sources;
}
function foodNeedsOk(item: FeedItem) {
  if (item.type !== 'food') return false;
  const sources = foodFieldSources(item);
  if (!sources.length) return false;
  if (sources.some(source => source.countedInTotals === true)) return false;
  if (sources.some(source => source.countedInTotals === false)) return true;
  if (sources.some(source => uncountedFoodState(source.logState) || uncountedFoodState(source.status))) return true;
  const exposed = sources.filter(source => Object.prototype.hasOwnProperty.call(source, 'sheetLoggedAt'));
  if (!exposed.length) return false;
  return !exposed.some(source => typeof source.sheetLoggedAt === 'string' && source.sheetLoggedAt.trim());
}
function mealsNeedingOk(items: FeedItem[]) {
  const seen = new Set<string>();
  let count = 0;
  items.forEach((item, index) => {
    if (!foodNeedsOk(item)) return;
    const mealId = typeof item.details?.mealId === 'string' ? item.details.mealId : '';
    const key = mealId || item.id || String(item.ts || index);
    if (seen.has(key)) return;
    seen.add(key);
    count += 1;
  });
  return count;
}
function signalClock(time?: string, date?: string, ts?: number) {
  const format = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms)).replace(/[\u202f\u00a0]/g, ' ');
  if (time) {
    const direct = Date.parse(time);
    if (Number.isFinite(direct)) return format(direct);
    const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/);
    if (match) {
      const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      let offset = match[4];
      if (offset !== 'Z' && !offset.includes(':')) {
        const sign = offset[0];
        const digits = offset.slice(1);
        offset = digits.length <= 2 ? `${sign}${digits.padStart(2, '0')}:00` : `${sign}${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
      }
      const parsed = Date.parse(`${day}T${match[1].padStart(2, '0')}:${match[2]}:${(match[3] || '00').padStart(2, '0')}${offset}`);
      if (Number.isFinite(parsed)) return format(parsed);
    }
    if (/\d{1,2}:\d{2}/.test(time)) return time;
  }
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) return format(ts < 1e12 ? ts * 1000 : ts);
  return time || '';
}
function weightAge(measuredAt: string) {
  const ms = Date.parse(measuredAt);
  if (!Number.isFinite(ms) || Date.now() - ms <= 48 * 60 * 60 * 1000) return null;
  const day = (value: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const days = Math.round((Date.parse(`${day(Date.now())}T12:00:00Z`) - Date.parse(`${day(ms)}T12:00:00Z`)) / 86400000);
  return days <= 1 ? 'yesterday' : `${days} days ago`;
}
function recentMealStatus(meal: FoodMeal) {
  if (meal.sheetLoggedAt) return 'Logged';
  if (meal.status === 'analysis_failed') return 'Retry needed';
  if (meal.needsClarification || uncountedFoodState(meal.logState)) return 'Review needed';
  return 'Estimate only';
}
function photoConsumedAt(createdAt?: string) {
  if (!createdAt) return '';
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms) || ms > Date.now()) return '';
  return new Date(ms).toISOString();
}
function foodReviewFirst() {
  try {
    if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('cupcake-food-review') !== '1') return false;
    sessionStorage.removeItem('cupcake-food-review');
    return true;
  } catch { return false; }
}

const CupcakeGPT: React.FC = () => {
  const [tab, setTabState] = useState<TabKey>(() => tabFromSearch(location.search));
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const pendingScroll = useRef<number | null>(null);
  const [quickAction, setQuickAction] = useState<'tip' | 'reset' | null>(null);
  const [speak, setSpeak] = useState(false);
  const [access, setAccess] = useState<AccessGate>(() => (readPrivateAccess() ? 'opening' : 'form'));
  const [keyInput, setKeyInput] = useState(readPrivateAccess);
  const [unlocking, setUnlocking] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [persistenceNotice, setPersistenceNotice] = useState('');
  const accessAttempt = useRef(0);
  const cancelAccessAttempt = useCallback(() => { ++accessAttempt.current; }, []);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const setTab = useCallback((next: TabKey) => {
    if (tabRef.current === next) return;
    history.replaceState({ ...historyBase(), scroll: window.scrollY }, '');
    history.pushState({ scroll: 0 }, '', tabHref(next));
    tabRef.current = next;
    pendingScroll.current = 0;
    setTabState(next);
    window.scrollTo(0, 0);
  }, []);
  const openTalkAbout = (entry: DashboardEntry) => { sessionStorage.setItem(TALK_SEED_KEY, JSON.stringify(talkSeedFromIntervention(entry))); setTab('talk'); };
  const connect = useCallback(async (key: string, restoring = false) => {
    const attempt = ++accessAttempt.current;
    setUnlocking(true); setAccessError('');
    if (restoring) setAccess('opening');
    try {
      const r = await fetch(`${API}/cupcake-feed`, { headers: { 'X-Cupcake-Key': key }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
      if (attempt !== accessAttempt.current) return;
      if (r.status === 401 || r.status === 403) {
        clearPrivateAccess(); setKeyInput(''); setAccess('form');
        setAccessError(restoring ? 'Your saved sign-in is no longer valid. Enter your Cupcake password.' : 'Check your Cupcake password, then try again.');
        return;
      }
      if (!r.ok) throw Error();
      setPersistenceNotice(savePrivateAccess(key) ? '' : 'This browser could not save your sign-in. Cupcake is open for this session.');
      setAccess('ready');
    } catch {
      if (attempt !== accessAttempt.current) return;
      if (restoring) {
        setAccess('retry');
        setAccessError("Couldn't connect. Your saved sign-in is still on this device. Try again.");
      } else setAccessError('Check your Cupcake password and connection, then try again.');
    } finally { if (attempt === accessAttempt.current) setUnlocking(false); }
  }, []);
  const unlock = (e: React.FormEvent) => { e.preventDefault(); if (keyInput.trim() && !unlocking) void connect(keyInput.trim()); };
  const finishLock = useCallback(() => {
    cancelAccessAttempt();
    const cleared = clearPrivateAccess();
    setKeyInput(''); setAccess('form'); setUnlocking(false); setPersistenceNotice('');
    setAccessError(cleared ? '' : 'This browser could not remove your saved sign-in. Clear this site’s browser data to finish locking it.');
  }, [cancelAccessAttempt]);
  const lock = useCallback(() => {
    if (!window.confirm('Lock Cupcake on this browser?')) return;
    finishLock();
  }, [finishLock]);
  useEffect(() => {
    const saved = readPrivateAccess(); if (saved) void connect(saved, true);
    const storageChanged = (event: StorageEvent) => { if (event.storageArea === localStorage && (event.key === PRIVATE_ACCESS_STORAGE || event.key === null) && event.newValue === null) finishLock(); };
    window.addEventListener('storage', storageChanged);
    return () => { cancelAccessAttempt(); window.removeEventListener('storage', storageChanged); };
  }, [connect, finishLock, cancelAccessAttempt]);
  useLayoutEffect(() => {
    if (pendingScroll.current == null) return;
    const y = pendingScroll.current;
    pendingScroll.current = null;
    window.scrollTo(0, y);
  });
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('tab', tabRef.current);
    const previousRestoration = 'scrollRestoration' in history ? history.scrollRestoration : undefined;
    if (previousRestoration) history.scrollRestoration = 'manual';
    history.replaceState({ ...historyBase(), scroll: window.scrollY }, '', `${url.pathname}${url.search}${url.hash}`);
    const onPop = (event: PopStateEvent) => {
      const path = location.pathname.replace(/\/+$/, '') || '/';
      if (path !== '/cupcake') return;
      const next = tabFromSearch(location.search);
      tabRef.current = next;
      const state = event.state as { scroll?: unknown } | null;
      pendingScroll.current = state && typeof state.scroll === 'number' ? state.scroll : 0;
      setTabState(next);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (previousRestoration) history.scrollRestoration = previousRestoration;
    };
  }, []);
  useEffect(()=>{
    document.title='Cupcake — Your private companion';
    const links:HTMLLinkElement[]=[];
    for(const [rel,href] of [['manifest','/cupcake.webmanifest'],['apple-touch-icon','/cupcake-avatar.jpg']]){const l=document.createElement('link');l.rel=rel;l.href=href;document.head.appendChild(l);links.push(l);}
    if('serviceWorker'in navigator)void navigator.serviceWorker.register('/cupcake-sw.js',{scope:'/cupcake'}).catch(()=>{});
    const before=(e:Event)=>{e.preventDefault();setInstall(e as InstallPrompt);};window.addEventListener('beforeinstallprompt',before);
    return()=>{links.forEach(l=>l.remove());window.removeEventListener('beforeinstallprompt',before);};
  },[]);
  const promptInstall = () => { if (!install) return; void install.prompt().then(() => install.userChoice).then(() => setInstall(null)); };
  const retrySavedSignIn = () => { const saved = readPrivateAccess(); if (saved) void connect(saved, true); else setAccess('form'); };
  if (access === 'form') return <main className="cc-app"><form className="cc-unlock" onSubmit={unlock}><img src={ICON} alt="Cupcake"/><span className="cc-eyebrow">JUST BETWEEN US</span><h1>Your day.<br/>Your conversations.<br/><span style={{color:'#ffa3c5'}}>Your Cupcake.</span></h1><p>Talk, record, and keep track of what matters. Your private space works on your phone and computer.</p><label className="cc-label">Cupcake password<input type="password" autoComplete="current-password" required disabled={unlocking} value={keyInput} onChange={e=>setKeyInput(e.target.value)}/></label><button className="cc-primary" disabled={unlocking}><LockKeyhole size={18}/>{unlocking?'Connecting…':'Open Cupcake'}</button>{accessError&&<p role="alert">{accessError}</p>}<p style={{fontSize:13}}>Cupcake keeps you signed in on this browser. Use Lock to remove the saved sign-in on a shared device. Private recordings and feed data are never included in the public website.</p><a className="cc-text-button" href="/">← Hales.ai</a></form></main>;
  return <div className="cc-app"><header className="cc-top"><img src={ICON} alt=""/><div><strong>Cupcake</strong><small>Your private companion</small></div><details className="cc-settings"><summary>Settings</summary><div className="cc-settings-panel"><AppUpdateNotice busy={mediaBusy} part="check" />{install&&<button type="button" className="cc-text-button" onClick={promptInstall}>Install Cupcake on this device ↗</button>}<p className="cc-muted cc-small">To keep Cupcake handy: browser menu → Install app / Add to Home screen.</p></div></details><button type="button" className="cc-secondary cc-lock" disabled={mediaBusy} onClick={lock}>Lock</button></header>
    <main className="cc-shell">
      <AppUpdateNotice busy={mediaBusy} part="banner" />
      {persistenceNotice&&<p role="status" className="cc-muted">{persistenceNotice}</p>}
      {access==='opening'&&<p className="cc-card" role="status">Opening Cupcake…</p>}
      {access==='retry'&&<div className="cc-card" role="alert"><p>Couldn't connect. Your saved sign-in is still on this device. Try again.</p><button type="button" className="cc-secondary" onClick={retrySavedSignIn}>Try again</button></div>}
      {mediaBusy&&!['talk','record','library'].includes(tab)&&<button className="cc-live-bar" onClick={()=>setTab('record')}>Cupcake is working · open controls</button>}
      {access==='ready'&&tab==='feed'&&quickAction&&<QuickReset key={quickAction} mode={quickAction} onBack={()=>setQuickAction(null)} onMode={setQuickAction}/>}
      {access==='ready'&&tab==='feed'&&!quickAction&&<TodayHome setTab={setTab} setQuickAction={setQuickAction} openTalkAbout={openTalkAbout}/>}
      {access==='ready'&&<div hidden={!['talk','record','library'].includes(tab)}><CupcakeStudio active={['talk','record','library'].includes(tab)} mode={tab==='talk'?'talk':tab==='library'?'library':'record'} onBusy={setMediaBusy}/></div>}
      {access==='ready'&&<div hidden={tab!=='chat'}><div className="cc-heading-row"><div><span className="cc-eyebrow">QUICK CHAT</span><p className="cc-muted">Everyday conversation with your context. Use Library for deeper strategy and saved analyses.</p></div><button className="cc-text-button" onClick={()=>setTab('library')}>Ask across my Library</button></div><button className="cc-text-button" onClick={()=>setSpeak(!speak)}>{speak?<Volume2 size={18}/>:<VolumeX size={18}/>}Read replies aloud: {speak?'on':'off'}</button><ChatView active={tab==='chat'} speak={speak&&!mediaBusy} mediaBusy={mediaBusy}/></div>}
      {access==='ready'&&tab==='snap'&&<SnapView onBack={()=>setTab('feed')}/>}{access==='ready'&&tab==='week'&&<><button className="cc-text-button" onClick={()=>setTab('feed')}><ArrowLeft size={17}/>Back to Today</button><WeekView onTalkAbout={openTalkAbout}/></>}
    </main><nav className="cc-nav" aria-label="Cupcake"><div>{tabs.map(({key,label,Icon})=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}><Icon size={22}/>{label}</button>)}</div></nav>
  </div>;
};

function TodayWeight({onOpen}:{onOpen:()=>void}) {
 const [reading,setReading]=useState<WeightRecord|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;void loadWeightPage().then(p=>{if(live)setReading(p.latestMeasurement);}).catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 const age=reading?weightAge(reading.measuredAt):null;
 return <button className="cc-dashboard-card" onClick={onOpen}><strong>{loading?'Loading weight…':error?'Weight unavailable':reading?`${reading.weightLb.toFixed(1)} lb`:'No individual weigh-in yet'}</strong><span>{reading?`${weightProvenanceLabel(reading.basis,reading.source)} ${weightTime(reading.measuredAt)}${age?` · ${age}`:''} · View history`:error?'Open history to retry':'Averages stay separate from scale readings.'}</span></button>;
}

function TodayHome({setTab,setQuickAction,openTalkAbout}:{setTab:(tab:TabKey)=>void;setQuickAction:(action:'tip'|'reset'|null)=>void;openTalkAbout:(entry:DashboardEntry)=>void}) {
  const [items,setItems]=useState<FeedItem[]|null>(null);
  const [err,setErr]=useState(false);
  const [selected,setSelected]=useState<DashboardEntry|null>(null);
  const loadId=useRef(0);
  const load=useCallback(()=>{
    const request=++loadId.current;
    setErr(false);setItems(null);
    fetch(`${API}/cupcake-feed`,{headers:authHeaders()})
      .then(readJson)
      .then(d=>{if(request===loadId.current)setItems(d.items||[]);})
      .catch(()=>{if(request===loadId.current)setErr(true);});
  },[]);
  useEffect(()=>{load();},[load]);
  const [pendingMeals,setPendingMeals]=useState(0);
  const [pendingCapped,setPendingCapped]=useState(false);
  useEffect(()=>{
    let live=true;
    void libraryRequest<{meals:FoodMeal[]}>({action:'food_list',limit:200}).then(data=>{
      if(!live)return;
      const meals=data.meals||[];
      setPendingCapped(meals.length>=200);
      setPendingMeals(meals.filter(meal=>!meal.sheetLoggedAt).length);
    }).catch(()=>{if(live){setPendingMeals(0);setPendingCapped(false);}});
    return()=>{live=false;};
  },[]);
  const loadMeal=useCallback(async(mealId:string)=>(await libraryRequest<{meal:FoodMeal}>({action:'food_get',mealId})).meal,[]);
  const needs=Math.max(items?mealsNeedingOk(items):0,pendingMeals);
  return <>
    <div className="cc-welcome"><div><span className="cc-eyebrow">IN YOUR CORNER</span><h2>Hey, Matt.</h2><p>What are we conquering—or confessing?</p><div className="cc-shortcuts"><button className="cc-primary" onClick={()=>setTab('talk')}><Headphones size={18}/>Let's talk</button><button className="cc-secondary" onClick={()=>setTab('record')}><Mic size={18}/>Record a note</button></div></div></div>
    <div className="cc-action-row"><button className="cc-secondary" onClick={()=>setQuickAction('tip')}>Quick tip</button><button className="cc-secondary" onClick={()=>setTab('snap')}><Camera size={18}/>Food photo</button><button className="cc-secondary" onClick={()=>setTab('week')}><Trophy size={18}/>Wins &amp; losses</button></div>
    <TodayWeight onOpen={()=>setTab('week')}/>
    {needs>0&&<button type="button" className="cc-card cc-needs-ok" onClick={()=>{try{sessionStorage.setItem('cupcake-food-review','1');}catch{/* The food screen still lists meals that need a decision. */}setTab('snap');}}>{needs===1?'1 meal needs your OK':pendingCapped&&pendingMeals>=200&&needs===pendingMeals?`${needs} or more meals need your OK`:`${needs} meals need your OK`}</button>}
    <details className="cc-card"><summary style={{fontSize:20,cursor:'pointer',minHeight:44}}>Your latest signals</summary>
      {err?<div className="cc-signal-error"><p role="alert">Cupcake couldn’t load your latest signals. Check your connection.</p><button type="button" className="cc-secondary" onClick={load}>Retry</button></div>:selected?<SignalDetail entry={selected} onBack={()=>setSelected(null)} loadMeal={loadMeal} updateIntervention={updateIntervention} onUpdated={()=>setSelected(null)} onTalkAbout={openTalkAbout}/>:!items?<Spinner/>:!items.length?<Empty text="No recent records were returned. Your older history may still be available in Wins & losses."/>:<div className="space-y-2.5">{items.map((it,i)=><button key={i} type="button" onClick={()=>setSelected({id:it.id||`${it.type}-${it.ts||i}`,type:it.type,date:it.date,time:it.time,title:it.title,body:it.body,calories:it.calories,amount:it.amount,currency:it.currency,details:it.details,icon:it.icon})} aria-label={`Open ${it.title}`} className="cc-signal flex gap-3 items-start bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl px-4 py-3"><div className="text-2xl leading-none mt-0.5">{it.icon}</div><div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{it.title}</p><p className="text-xs text-white/60">{it.body}</p></div><div className="cc-signal-time text-white/30 whitespace-nowrap mt-1">{signalClock(it.time,it.date,it.ts)}</div></button>)}</div>}
    </details>
  </>;
}

// ---------- CHAT ----------
const ChatView = QuickChat;

// ---------- SNAP (food photo) ----------
const SnapView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [consumedAt, setConsumedAt] = useState('');
  const [confirmedConsumed, setConfirmedConsumed] = useState(false);
  const [result, setResult] = useState<FoodResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [portionNote, setPortionNote] = useState('');
  const [error, setError] = useState('');
  const [recentMeals, setRecentMeals] = useState<FoodMeal[]>([]);
  const [reviewFirst] = useState(foodReviewFirst);
  const fileRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null);

  const loadRecentMeals = useCallback(async () => { try { const data = await libraryRequest<{ meals: FoodMeal[] }>({ action: 'food_list', limit: 200 }); setRecentMeals(data.meals || []); } catch (e) { setError(e instanceof Error ? e.message : 'Recent food photos are unavailable.'); } }, []);
  useEffect(() => { void loadRecentMeals(); }, [loadRecentMeals]);

  const onFile = (f: File) => {
    if (busy) return;
    setError(''); setBusy(true);
    setConfirmedConsumed(false); setConsumedAt(''); setPortionNote('');
    void prepareFoodImage(f).then(image => { setPreview(image); setResult(null); }).catch(e => setError(e instanceof Error ? e.message : 'Could not prepare that image.')).finally(() => setBusy(false));
  };

  const analyze = async () => {
    if (!preview || busy) return;
    setBusy(true); setResult(null); setError(''); setConfirmedConsumed(false); setPortionNote('');
    try { setResult(await libraryRequest<FoodResult>({ action: 'food_analyze', image: preview, note, estimateVisiblePortion: true, reviewOnly: true })); void loadRecentMeals(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Food analysis failed. The original image remains on this device.'); }
    finally { setBusy(false); }
  };

  const retry = async () => { const mealId = result?.meal?.id; if (!mealId || busy) return; setBusy(true); setError(''); try { setResult(await libraryRequest<FoodResult>({ action: 'food_retry', mealId })); void loadRecentMeals(); } catch (e) { setError(e instanceof Error ? e.message : 'Retry failed.'); } finally { setBusy(false); } };
  const refine = async () => { const mealId = result?.meal?.id; if (!mealId || !portionNote.trim() || busy) return; setBusy(true); setError(''); setConfirmedConsumed(false); try { setResult(await libraryRequest<FoodResult>({ action: 'food_refine', mealId, note: portionNote.trim(), consumedPortions: { note: portionNote.trim() }, reviewOnly: true })); setPortionNote(''); void loadRecentMeals(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the portion estimate.'); } finally { setBusy(false); } };
  const openMeal = async (mealId: string) => { if (busy) return; setBusy(true); setError(''); try { const data = await libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId }); setResult({ meal: data.meal }); setPreview(null); setPortionNote(''); setConfirmedConsumed(false); setConsumedAt(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load that saved meal.'); } finally { setBusy(false); } };

  const logMeal = async () => {
    const meal = result?.meal; if (!meal || busy || portionNote.trim() || !confirmedConsumed || (!consumedAt && !meal.pendingConsumedAt)) return;
    setBusy(true); setError('');
    let attemptedAt = meal.pendingConsumedAt || '';
    try {
      const timestamp = Date.parse(meal.pendingConsumedAt || consumedAt);
      if (!Number.isFinite(timestamp) || timestamp > Date.now()) throw new Error('Choose a valid time when you ate this meal, no later than now.');
      const at = new Date(timestamp).toISOString();
      attemptedAt = at;
      setResult(current => current?.meal ? { ...current, meal: { ...current.meal, pendingConsumedAt: at } } : current);
      setResult(await libraryRequest<FoodResult>({ action: 'food_log', mealId: meal.id, confirmConsumed: true, consumedAt: at }));
      void loadRecentMeals();
    }
    catch (e) {
      const retainedAt = e instanceof LibraryApprovalCancelled ? meal.pendingConsumedAt || '' : attemptedAt;
      if (e instanceof LibraryApprovalCancelled && !meal.pendingConsumedAt) {
        setConfirmedConsumed(false);
        setResult(current => current?.meal ? { ...current, meal: { ...current.meal, pendingConsumedAt: undefined } } : current);
      }
      setError(e instanceof Error ? e.message : 'Your food log could not be confirmed. Retry the same meal; it will not be counted twice.');
      try { const current = await libraryRequest<{meal: FoodMeal}>({ action: 'food_get', mealId: meal.id }); setResult({ meal: { ...current.meal, ...(!current.meal.sheetLoggedAt && retainedAt ? { pendingConsumedAt: current.meal.pendingConsumedAt || retainedAt } : {}) } }); } catch { /* Keep the attempted time until the server can confirm it. */ }
    }
    finally { setBusy(false); }
  };

  const viewingSaved = Boolean(result?.meal && !preview);
  const suggestedPhotoTime = photoConsumedAt(result?.meal?.createdAt);
  const pendingMeals = recentMeals.filter(meal => !meal.sheetLoggedAt);
  const loggedMeals = recentMeals.filter(meal => meal.sheetLoggedAt);
  const mealRow = (meal: FoodMeal) => <button type="button" className="cc-snap-recent-item" key={meal.id} disabled={busy} onClick={() => void openMeal(meal.id)}><span><strong>{meal.description || 'Food photo'}</strong><small>{meal.createdAt ? new Date(meal.createdAt).toLocaleString() : 'Saved meal'} · {recentMealStatus(meal)}{meal.sheetLoggedAt ? '' : ' · not in calorie totals'}</small></span><span>{meal.total?.calories ?? '—'} kcal</span></button>;
  const mealQueue = <section className="cc-snap-queue" aria-label="Meals that need your OK"><div className="cc-heading-row"><h3>{pendingMeals.length ? `${pendingMeals.length} need your OK` : 'Meals that need your OK'}</h3><button className="cc-text-button" disabled={busy} onClick={() => void loadRecentMeals()}>Refresh</button></div><p className="cc-muted cc-small">Open a photo, use the photo time or pick another time, check that you ate those portions, then add it to your food log. Nothing is counted before that.</p>{pendingMeals.length ? pendingMeals.map(mealRow) : <p className="text-sm text-white/40">No saved photos are waiting.</p>}</section>;
  const cameraBlock = <>
      {!viewingSaved && !preview && (
        <div
          onClick={() => { if (!busy) cameraRef.current?.click(); }}
          className="relative aspect-square rounded-3xl border-2 border-dashed border-pink-500/30 bg-white/[0.03] overflow-hidden flex items-center justify-center cursor-pointer"
        >
          <div className="text-center text-pink-200/50 px-6">
            <Camera size={40} className="mx-auto mb-3" />
            <p className="text-sm">Tap to snap or upload your meal</p>
            <p className="text-xs mt-1 text-white/30">Cupcake estimates calories, carbs & sugar</p>
          </div>
        </div>
      )}
      {!viewingSaved && preview && <img src={preview} alt="food" className="cc-snap-preview" />}
      {!viewingSaved && <div className="cc-snap-actions"><button type="button" className="cc-primary" disabled={busy} onClick={() => cameraRef.current?.click()}><Camera size={17} />Take photo</button><button type="button" className="cc-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>Choose existing photo</button></div>}
  </>;
  const closeSavedMeal = () => {
    if (busy) return;
    setResult(null); setPreview(null); setError(''); setNote(''); setPortionNote(''); setConfirmedConsumed(false); setConsumedAt('');
  };

  return (
    <div className="space-y-4">
      <div className="cc-snap-head">
        {viewingSaved && <button type="button" className="cc-text-button" disabled={busy} onClick={closeSavedMeal}><ArrowLeft size={17}/>Back</button>}
        <button type="button" className="cc-text-button" onClick={() => onBack?.()}><ArrowLeft size={17}/>Back to Today</button>
        <h2 className="cc-snap-title">Log food</h2>
      </div>
      {reviewFirst ? mealQueue : cameraBlock}
      {reviewFirst ? cameraBlock : mealQueue}
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
          <p className="text-xs text-white/60 mt-2">Estimated nutrition for the portions below.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
            <Stat label="Calories" value={result.meal?.total?.calories ?? result.Calories ?? result.calories} />
            <Stat label="Total carbs (g)" value={result.meal?.total?.carbs_g ?? result.Carbs ?? result.carbs_g} />
            <Stat label="Sugar (g)" value={result.meal?.total?.sugar_g ?? result.Sugar ?? result.sugar_g} />
            <Stat label="Protein (g)" value={result.meal?.total?.protein_g ?? result.Protein ?? result.protein_g} />
          </div>
          {result.meal?.calorieRange && <p className="text-xs text-pink-200 mt-3">Estimated range: {result.meal.calorieRange.low}–{result.meal.calorieRange.high} kcal. Photo estimates depend on portion size and ingredients.</p>}
          {result.meal?.lookupWarnings?.map(warning => <p className="text-xs text-amber-200 mt-3" key={warning}>Variant warning: {warning}</p>)}
          {result.meal?.status === 'ready' && !result.meal.sheetLoggedAt && !result.meal.pendingConsumedAt && <>{result.meal.needsClarification && <p className="text-xs text-amber-200 mt-3">Review needed: {result.meal.clarification || 'Some portions were unclear.'}</p>}<p className="text-xs text-white/60 mt-3">The photo estimate already uses the visible portions. Correct an item, amount, or product below, then review the updated estimate.</p><input aria-label="Portion corrections" disabled={busy} value={portionNote} onChange={e => { setPortionNote(e.target.value); setConfirmedConsumed(false); }} placeholder="e.g. Half the rice; the drink is sugar-free…" className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm mt-3" /><button className="cc-secondary mt-3" disabled={busy || !portionNote.trim()} onClick={() => void refine()}>Apply correction & re-estimate</button></>}
          {result.meal?.status === 'analysis_failed' && <button className="cc-secondary mt-3" disabled={busy} onClick={() => void retry()}>Retry analysis</button>}
          {!!result.meal?.items?.length && <div className="cc-snap-items"><strong>Saved item estimates</strong>{result.meal.items.map(item => <div key={item.id}><span>{item.name}{item.quantity != null ? ` · ${item.quantity} ${item.unit || 'portion(s)'}` : ''}</span><small>{item.nutrition?.calories ?? '—'} kcal · {item.nutrition?.carbs_g ?? '—'} g total carbs · {item.nutrition?.sugar_g ?? '—'} g sugar · {item.provenance || 'estimate'}{item.variantWarning ? ` · ${item.variantWarning}` : ''}{item.calculation ? ` · ${item.calculation}` : ''}{item.portionAssumption ? ` · Assumes ${item.portionAssumption}` : ''}{item.sourceCitations?.map(source => /^https?:\/\//.test(source.url) ? <a key={source.url} href={source.url} target="_blank" rel="noreferrer"> · {source.title}</a> : null)}</small></div>)}</div>}
          {(result.meal?.totalIsPartial || (result.meal?.total && Object.values(result.meal.total).some(value => value == null))) && <p className="text-xs text-amber-200 mt-3">Partial estimate: some items or nutrients could not be estimated. Unknown values show —.</p>}
          {result.meal?.sheetLoggedAt ? <p className="text-xs text-emerald-300 mt-3" role="status">✓ Added to your food log · included in calories for the day you ate it{result.duplicate ? ' · already counted once' : ''}</p> : result.meal && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <p className="text-sm text-amber-100" role="status">{result.meal.status === 'analysis_failed' ? 'Photo saved. Analysis failed—retry to get an estimate.' : 'Photo saved privately. Not counted in your calorie totals yet.'}</p>
            {result.meal.status !== 'analysis_failed' && <p className="text-xs text-white/60">To give your OK: set when you ate it, check the box, then add it to your food log.</p>}
            {result.meal.total?.calories != null && !result.meal.needsClarification && !!result.meal.items?.length && result.meal.items.every(item => item.nutrition?.calories != null) && <>
              {suggestedPhotoTime && !result.meal.pendingConsumedAt && <button type="button" className="cc-secondary" disabled={busy} onClick={() => { setConsumedAt(suggestedPhotoTime); setConfirmedConsumed(false); }}>Use the photo time</button>}
              {result.meal.pendingConsumedAt ? <p className="text-xs text-white/60">Retrying the same meal time: {new Date(result.meal.pendingConsumedAt).toLocaleString()}</p> : <MealTimeInput key={result.meal.id} value={consumedAt} disabled={busy} onChange={value => { setConsumedAt(value); setConfirmedConsumed(false); }} />}
              <label className="cc-meal-consent"><input type="checkbox" disabled={busy || !!portionNote.trim()} checked={confirmedConsumed} onChange={e => setConfirmedConsumed(e.target.checked)} />I ate these portions. Add this estimate to my calorie totals.</label>{portionNote.trim() && <p className="text-xs text-amber-200">Apply your correction, or clear it, before confirming these portions.</p>}
              <button type="button" className="cc-primary" disabled={busy || !!portionNote.trim() || !confirmedConsumed || (!consumedAt && !result.meal.pendingConsumedAt)} onClick={() => void logMeal()}>{busy ? 'Saving…' : 'Add to food log'}</button>
            </>}
          </div>}

        </div>
      )}
      {!!loggedMeals.length && <section className="cc-snap-recent"><div className="cc-heading-row"><h3>Already in your food log</h3></div>{loggedMeals.map(mealRow)}</section>}
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

export { SnapView };
export default CupcakeGPT;
