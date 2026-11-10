import { feedRequest, feedCoverage, phoneOutcomesAvailable } from '../../../../components/cupcake/feedApi';
import { personalAssistantLabel, useAssistantDocumentBrand } from '../../../../components/cupcake/assistantBrand';
import { AccountControls, AccountSessionGate } from '../../../../components/cupcake/AccountSessionGate';
import CupcakeSettings, { SettingsGroup } from '../../../../components/cupcake/CupcakeSettings';
import { AccountSelfExport } from '../../../../components/cupcake/AccountSelfExport';
import { AccountClosureControls } from '../../../../components/cupcake/AccountClosureControls';
import { AccountCoachView } from '../../../../components/cupcake/AccountCoachView';
import { accountControl, type AccountIdentity } from '../../../../components/cupcake/accountSession';
import { useAccountInstallMetadata } from '../../../../components/cupcake/accountInstall';
import { AccountInstallInstructions } from '../../../../components/cupcake/AccountInstallInstructions';
import { AccountAppleHealth } from '../../../../components/cupcake/AccountAppleHealth';
import AccountHealthSyncCard from '../../../../components/cupcake/AccountHealthSyncCard';
import { ACCOUNT_SESSIONS, ACCOUNT_UNAVAILABLE, CUPCAKE_ENTRY, privateFetch as fetch } from '../../../../components/cupcake/accountMode';
import { personalStorage } from '../../../../components/cupcake/personalStorage';
import {loadWeightPage,weightProvenanceLabel,type WeightRecord} from '../../../../components/cupcake/weightApi';
import type {Body} from '../../../../components/cupcake/robyn/viewerApi';
import {weightTime} from '../../../../components/cupcake/weightHistoryModel';
import {QuickReset} from '../../../../components/cupcake/QuickReset';
import {QuickChat} from '../../../../components/cupcake/QuickChat';
// CupcakeGPT — Matt's AI accountability app
// Chat + food-photo calorie tracking + live feed + week view.
// Talks to n8n webhooks on automate.hales.ai (CORS-enabled).

import CupcakeStudio from '../../../../components/cupcake/CupcakeStudio';
import { BodyAssessmentCard } from '../../../../components/cupcake/assessment/BodyAssessmentCard';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
// framer-motion intentionally not used: tab switches must render instantly and
// never depend on rAF (which throttles/freezes in backgrounded webviews).
import {
  Home, MessageCircle, Camera, ArrowLeft, Mic, Volume2, VolumeX, Loader2, Headphones, Library, LockKeyhole, Lightbulb, Dumbbell,
  ClipboardList,
} from 'lucide-react';
import { Timeline } from '../../../../components/cupcake/TodayPulse';
import { SavesHero } from '../../../../components/cupcake/SavesCard';
import { AssistantShell, type AssistantMode } from '../../../../components/cupcake/AssistantShell';
import { AssistantPortrait, AssistantAppearanceSettings } from '../../../../components/cupcake/AssistantPersona';
import { useAssistantAppearance } from '../../../../components/cupcake/assistantAppearance';
import '../../../../components/cupcake/assistant-appearance.css';
import { SectionBoundary } from '../../../../components/cupcake/SectionBoundary';
import type { PulseItem } from '../../../../components/cupcake/pulseModel';
import { exerciseTimelineItems, mergeTimelineItems } from '../../../../components/cupcake/exerciseTimeline';
import { SignalSheet } from '../../../../components/cupcake/SignalSheet';
import { FeedDashboard, SignalDetail, type DashboardEntry, type DashboardRange, type DashboardStats, type FoodMeal } from '../../../../components/cupcake/DashboardView';
import { TALK_SEED_KEY, talkSeedFromIntervention } from '../../../../components/cupcake/dashboardModel';
import { libraryRequest } from '../../../../components/cupcake/library';
import { LibraryApprovalCancelled } from '../../../../components/cupcake/libraryApproval';
import { MealTimeInput } from '../../../../components/cupcake/MealTimeInput';
import { SavedMealDialog } from '../../../../components/cupcake/SavedMealDialog';
import { AccountManualMeal } from '../../../../components/cupcake/AccountManualMeal';
import { AccountPhotoMeal } from '../../../../components/cupcake/AccountPhotoMeal';
import { prepareFoodImage } from '../../../../components/cupcake/prepareFoodImage';
import { AccountFoodSections } from '../../../../components/cupcake/AccountFoodSections';
import { NutritionTodayCard, NutritionWorkspace } from '../../../../components/cupcake/NutritionWorkspace';
import { useNutritionData } from '../../../../components/cupcake/nutritionApi';
import { MealDialog } from '../../../../components/cupcake/MealDialog';
import { AppUpdateNotice } from '../../../../components/cupcake/AppUpdateNotice';
import { PRIVATE_ACCESS_STORAGE, readPrivateAccess, savePrivateAccess, clearPrivateAccess, privateAccessHeaders } from '../../../../components/cupcake/privateAccess';
import { TodayEnergy, useTodayExercise } from '../../../../components/cupcake/TodayEnergy';
import { AccentHeatToggle } from '../../../../components/cupcake/AccentHeatToggle';
import { useAccentHeat } from '../../../../components/cupcake/useAccentHeat';
import { useCupcakeViewport } from '../../../../components/cupcake/useCupcakeViewport';
import { ToneIcon } from '../../../../components/cupcake/design/ToneIcon';
import { Sparkline } from '../../../../components/cupcake/design/Visuals';
import '../../../../components/cupcake/design/tokens.css';
import '../../../../components/cupcake/design/cupcake-theme.css';
import '../../../../components/cupcake/pulse.css';
import '../../../../components/cupcake/account-shell.css';
import '../../../../components/cupcake/account-today.css';
import '../../../../components/cupcake/account-food.css';
import '../../../../components/cupcake/account-reports.css';
import '../../../../components/cupcake/account-base.css';
import { queueAccountMealPhoto } from '../../../../components/cupcake/accountMealPhotoHandoff';
import { lastLoggedMeal } from '../../../../components/cupcake/nutritionModel';

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

async function loadDashboardStats(range: DashboardRange, cursor?: string): Promise<DashboardStats> {
  const data = await feedRequest(range.preset === 'all' ? {scope:'history',...(cursor ? {cursor} : {})} : {start:range.start,end:range.end});
  const entries: DashboardEntry[] = (data.items || []).map((item, index) => ({ id: item.id || `${item.type}-${item.ts || index}`, type: item.type, date: item.date, time: item.time, title: item.title, body: item.body, amount: item.amount ?? null, currency: item.currency ?? null, calories: item.calories ?? null, details: item.details, icon: item.icon }));
  const coverageNote = feedCoverage(data);
  const outcomes = phoneOutcomesAvailable(data.outcomes) ? data.outcomes as DashboardStats['outcomes'] : undefined;
  return { range: { start: range.preset==='all'?(data.coverage?.start||range.start):range.start, end: range.end, timezone: data.coverage?.timezone || 'America/Chicago', coverage: coverageNote, spendSource: data.coverage?.spendSource },
    totals: { calories: typeof data.totals?.calories === 'number' ? data.totals.calories : null, caloriesPartial:data.totals?.caloriesPartial===true, spend: typeof data.totals?.spendUsd === 'number' ? data.totals.spendUsd : null, currency:ACCOUNT_SESSIONS&&data.totals?.spendUsd==null?undefined:'USD', weightLb:data.totals?.weightLb??null,weightDate:data.totals?.weightDate||'' },
    series:(data.daily||[]).map(day=>({date:day.date,calories:day.calories??null,spend:day.spendUsd??null})),
    entries,nextCursor:data.nextCursor,totalCount:data.coverage?.totalCount??undefined,outcomes,
    phoneOutcomesAvailable:ACCOUNT_SESSIONS ? !!outcomes : undefined,localComplete:data.coverage?.localComplete,coverage:coverageNote||undefined };

}

type FeedItem = { id?: string; type: string; icon: string; title: string; body: string; date: string; time: string; ts: number; calories?: number | null; amount?: number | null; currency?: string | null; details?: { mealId?: string | null; [key: string]: unknown } };
type FoodResult = { logError?: string; meal?: FoodMeal; duplicate?: boolean; error?: boolean; Description?: string; description?: string; Calories?: number; calories?: number; Sugar?: number; sugar_g?: number; Protein?: number; protein_g?: number; Carbs?: number; carbs_g?: number };



const tabs = [
  {key:'feed',label:'Today',Icon:Home}, {key:'snap',label:'Food',Icon:Camera},
  {key:'library',label:'Library',Icon:Library}, {key:'chat',label:'Assistant',Icon:MessageCircle},
] as const;
const navigationTabs = ACCOUNT_SESSIONS ? [...tabs, {key:'reports',label:'Reports',Icon:ClipboardList} as const] : tabs;
type TabKey = (typeof tabs)[number]['key'] | 'talk' | 'record' | 'week' | 'reports';
const isAssistantTab = (tab: TabKey) => ['chat','talk','record'].includes(tab);
const assistantModeFor = (tab: TabKey): AssistantMode => tab === 'talk' ? 'voice' : tab === 'record' ? 'record' : 'text';
type InstallPrompt = Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
type AccessGate = 'form' | 'opening' | 'retry' | 'ready';
const TAB_KEYS: readonly TabKey[] = ['feed', 'talk', 'record', 'library', 'chat', 'snap', 'week', ...(ACCOUNT_SESSIONS?['reports' as const]:[])];

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
// Kept for reuse (the Today timeline now formats times with pulseModel.itemClock).
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
    if (typeof sessionStorage === 'undefined' || personalStorage('sessionStorage').getItem('cupcake-food-review') !== '1') return false;
    personalStorage('sessionStorage').removeItem('cupcake-food-review');
    return true;
  } catch { return false; }
}

const CupcakeGPT: React.FC<{accountIdentity?:AccountIdentity}> = ({accountIdentity}) => {
  useCupcakeViewport();
  const [tab, setTabState] = useState<TabKey>(() => tabFromSearch(location.search));
  const appearance = useAssistantAppearance();
  const assistantName = appearance.name.trim() || (appearance.persona==='matthieu'?'Matthieu':'Cupcake');
  useAssistantDocumentBrand(assistantName, appearance.persona);
  const [talkContextVersion, setTalkContextVersion] = useState(0);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>(() => assistantModeFor(tab));
  const returnTab = useRef<TabKey>('feed');
  const assistantOpen = isAssistantTab(tab);
  const screen = assistantOpen ? returnTab.current : tab;
  const navigationScreen = screen === 'week' ? 'feed' : screen;
  const [activity, setActivity] = useState({kind: null as 'voice'|'record'|'library'|null, label: ''});
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const pendingScroll = useRef<number | null>(null);
  const [quickAction, setQuickAction] = useState<'tip' | 'reset' | null>(null);
  const [speak, setSpeak] = useState(false);
  const [access, setAccess] = useState<AccessGate>(() => (accountIdentity ? 'ready' : readPrivateAccess() ? 'opening' : 'form'));
  const [accentHeat, setAccentHeat] = useAccentHeat();
  const [keyInput, setKeyInput] = useState(readPrivateAccess);
  const [unlocking, setUnlocking] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [persistenceNotice, setPersistenceNotice] = useState('');
  const accessAttempt = useRef(0);
  const cancelAccessAttempt = useCallback(() => { ++accessAttempt.current; }, []);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const setTab = useCallback((next: TabKey) => {
    if (isAssistantTab(next)) setAssistantMode(assistantModeFor(next));
    if (tabRef.current==='reports' && isAssistantTab(next)) returnTab.current='feed';
    else if (!isAssistantTab(tabRef.current)) returnTab.current = tabRef.current;
    if (tabRef.current === next) return;
    history.replaceState({ ...historyBase(), scroll: window.scrollY }, '');
    history.pushState({ scroll: 0 }, '', tabHref(next));
    tabRef.current = next;
    pendingScroll.current = 0;
    setTabState(next);
    window.scrollTo(0, 0);
  }, []);
  const openAssistantMode = (mode: AssistantMode) => setTab(mode === 'voice' ? 'talk' : mode === 'record' ? 'record' : 'chat');
  const openTalkAbout = (entry: DashboardEntry) => { personalStorage('sessionStorage').setItem(TALK_SEED_KEY, JSON.stringify(talkSeedFromIntervention(entry))); setTalkContextVersion(version=>version+1); setTab('talk'); };
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
    if (ACCOUNT_SESSIONS) { void accountControl('sign-out',{}).catch(()=>{}); return; }
    cancelAccessAttempt();
    const cleared = clearPrivateAccess();
    setKeyInput(''); setAccess('form'); setUnlocking(false); setPersistenceNotice('');
    setAccessError(cleared ? '' : 'This browser could not remove your saved sign-in. Clear this site’s browser data to finish locking it.');
  }, [cancelAccessAttempt]);
  const lock = useCallback(() => {
    if (!window.confirm(ACCOUNT_SESSIONS?`Sign out of ${assistantName} on this browser and stop active media?`:`Lock ${assistantName} on this browser?`)) return;
    finishLock();
  }, [finishLock, assistantName]);
  useEffect(() => {
    if (ACCOUNT_SESSIONS) return;
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
      if (path !== CUPCAKE_ENTRY) return;
      const next = tabFromSearch(location.search);
      tabRef.current = next;
      const state = event.state as { scroll?: unknown } | null;
      pendingScroll.current = state && typeof state.scroll === 'number' ? state.scroll : 0;
      if (isAssistantTab(next)) setAssistantMode(assistantModeFor(next));
      else returnTab.current = next;
      setTabState(next);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (previousRestoration) history.scrollRestoration = previousRestoration;
    };
  }, []);
  useEffect(()=>{
    if (ACCOUNT_SESSIONS) return; // Account launch metadata is separate; legacy sharing stays scoped here.
    const links:HTMLLinkElement[]=[];
    for(const [rel,href] of [['manifest','/cupcake.webmanifest'],['apple-touch-icon','/cupcake-avatar.jpg']]){const l=document.createElement('link');l.rel=rel;l.href=href;document.head.appendChild(l);links.push(l);}
    if('serviceWorker'in navigator)void navigator.serviceWorker.register('/cupcake-sw.js',{scope:'/cupcake'}).then(()=>navigator.serviceWorker.ready).then(registration=>registration.active?.postMessage({type:'cupcake-browser-mode',accountSessions:ACCOUNT_SESSIONS})).catch(()=>{});
    const before=(e:Event)=>{e.preventDefault();setInstall(e as InstallPrompt);};window.addEventListener('beforeinstallprompt',before);
    return()=>{links.forEach(l=>l.remove());window.removeEventListener('beforeinstallprompt',before);};
  },[]);
  const promptInstall = () => { if (!install) return; void install.prompt().then(() => install.userChoice).then(() => setInstall(null)); };
  const retrySavedSignIn = () => { const saved = readPrivateAccess(); if (saved) void connect(saved, true); else setAccess('form'); };
  if (access === 'form') return <main className="cc-app" data-appearance={appearance.appearance}><form className="cc-unlock" onSubmit={unlock}><img src={ICON} alt="Cupcake"/><span className="cc-eyebrow">JUST BETWEEN US</span><h1>Your day.<br/>Your conversations.<br/><span style={{color:'var(--cc-pink)'}}>Your Cupcake.</span></h1><p>Talk, record, and keep track of what matters. Your private space works on your phone and computer.</p><label className="cc-label">Cupcake password<input type="password" autoComplete="current-password" required disabled={unlocking} value={keyInput} onChange={e=>setKeyInput(e.target.value)}/></label><button className="cc-primary" disabled={unlocking}><LockKeyhole size={18}/>{unlocking?'Connecting…':'Open Cupcake'}</button>{accessError&&<p role="alert">{accessError}</p>}<p style={{fontSize:13}}>Cupcake keeps you signed in on this browser. Use Lock to remove the saved sign-in on a shared device. Private recordings and feed data are never included in the public website.</p><a className="cc-text-button" href="/">← Hales.ai</a></form></main>;
  return <div className="cc-app" data-appearance={appearance.appearance} data-entry={ACCOUNT_SESSIONS?'account':undefined}><header className="cc-top"><AssistantPortrait persona={appearance.persona} name={assistantName} small/><div><strong className="cc-account-identity">{accountIdentity?personalAssistantLabel(assistantName,accountIdentity.name||accountIdentity.email):assistantName}</strong><small>Your private companion</small></div><CupcakeSettings>
      <SettingsGroup title="Appearance"><AssistantAppearanceSettings {...appearance}/><AccentHeatToggle heat={accentHeat} onChange={setAccentHeat}/></SettingsGroup>
      {accountIdentity&&<><SettingsGroup title="Account & security"><AccountControls identity={accountIdentity} assistantName={assistantName} includePrivacy={false}/></SettingsGroup><SettingsGroup title="Download my data"><AccountSelfExport/></SettingsGroup><SettingsGroup title="Close account access" danger><AccountClosureControls owner={accountIdentity.account_id}/></SettingsGroup></>}
      <SettingsGroup title="App & updates"><AppUpdateNotice busy={mediaBusy} part="check"/>{install&&<button type="button" className="cc-text-button" onClick={promptInstall}>Install Cupcake on this device ↗</button>}{!ACCOUNT_SESSIONS&&<p className="cc-muted cc-small">To keep Cupcake handy: browser menu → Install app / Add to Home screen.</p>}</SettingsGroup>
      {ACCOUNT_SESSIONS&&<SettingsGroup title="iPhone & Apple Health"><AccountInstallInstructions/><AccountAppleHealth/></SettingsGroup>}
    </CupcakeSettings><button type="button" className="cc-secondary cc-lock" aria-label={accountIdentity?`Sign out of ${assistantName}`:`Lock ${assistantName}`} disabled={mediaBusy&&!accountIdentity} onClick={lock}><LockKeyhole size={17} aria-hidden="true"/><span className="cc-top-label">{accountIdentity?"Sign out":"Lock"}</span></button></header>
    <main className="cc-shell">
      <AppUpdateNotice busy={mediaBusy} part="banner" />{accountIdentity&&<details className="cc-account-note"><summary>Your private account · Sharing details</summary><p>You’re in your private account. Manage coach reports and meal-photo sharing in Reports. <button type="button" className="cc-text-button" onClick={()=>setTab('reports')}>Open Reports</button></p></details>}
      {persistenceNotice&&<p role="status" className="cc-muted">{persistenceNotice}</p>}
      {access==='opening'&&<p className="cc-card" role="status">Opening Cupcake…</p>}
      {access==='retry'&&<div className="cc-card" role="alert"><p>Couldn't connect. Your saved sign-in is still on this device. Try again.</p><button type="button" className="cc-secondary" onClick={retrySavedSignIn}>Try again</button></div>}
      {access==='ready'&&screen==='feed'&&quickAction&&<QuickReset key={quickAction} mode={quickAction} onBack={()=>setQuickAction(null)} onMode={setQuickAction}/>}
      {access==='ready'&&screen==='feed'&&!quickAction&&<SectionBoundary label="Today"><TodayHome accountName={accountIdentity?.name||accountIdentity?.email} setTab={setTab} setQuickAction={setQuickAction} openTalkAbout={openTalkAbout}/></SectionBoundary>}
      {access==='ready'&&screen==='reports'&&accountIdentity&&<SectionBoundary label="Authorized reports"><AccountCoachView identity={accountIdentity} assistantName={assistantName} onPersonal={()=>setTab('feed')}/></SectionBoundary>}
      {access==='ready'&&<AssistantShell open={assistantOpen} library={tab==='library'} mode={assistantMode} onMode={openAssistantMode} onOpen={()=>openAssistantMode(activity.kind==='voice'?'voice':activity.kind==='record'?'record':assistantMode)} onMinimize={()=>setTab(returnTab.current)} onLibrary={()=>setTab('library')} busy={mediaBusy} activity={activity} persona={appearance.persona} name={assistantName}>
        <div hidden={!(tab==='library'||assistantMode!=='text')}><CupcakeStudio assistantName={assistantName} active={tab==='library'||(assistantOpen&&assistantMode!=='text')} keepMediaOnHide contextVersion={talkContextVersion} mode={tab==='library'?'library':assistantMode==='voice'?'talk':'record'} onBusy={setMediaBusy} onActivity={setActivity}/></div>
        <div hidden={tab==='library'||assistantMode!=='text'}><div className="cc-assistant-text-intro"><p className="cc-muted">Your everyday conversations, saved across devices. Library keeps deeper research and original recordings.</p><button className="cc-text-button" onClick={()=>setSpeak(!speak)}>{speak?<Volume2 size={18}/>:<VolumeX size={18}/>}Read replies aloud: {speak?'on':'off'}</button></div><SectionBoundary label="Chat"><ChatView active={assistantOpen&&assistantMode==='text'} speak={speak&&!mediaBusy} mediaBusy={mediaBusy} locked={mediaBusy} assistantName={assistantName}/></SectionBoundary></div>
      </AssistantShell>}
      {access==='ready'&&screen==='snap'&&<SectionBoundary label="Food"><SnapView onBack={()=>setTab('feed')}/></SectionBoundary>}{access==='ready'&&screen==='week'&&<><button className="cc-text-button cc-week-back" onClick={()=>setTab('feed')}><ArrowLeft size={17}/>Back to Today</button><SectionBoundary label="Wins & losses"><WeekView onTalkAbout={openTalkAbout}/></SectionBoundary></>}
    </main><nav className="cc-nav" aria-label={assistantName}><div>{navigationTabs.map(({key,label,Icon})=><button key={key} type="button" aria-current={key!=='chat'&&navigationScreen===key?'page':undefined} aria-controls={key==='chat'?'cupcake-assistant':undefined} aria-expanded={key==='chat'?assistantOpen:undefined} onClick={()=>key==='chat'?(assistantOpen?setTab(returnTab.current):openAssistantMode(assistantMode)):setTab(key)}>{ACCOUNT_SESSIONS&&key==='chat'?<span className="cc-nav-portrait" aria-hidden="true"><AssistantPortrait persona={appearance.persona} name={assistantName} small/></span>:<Icon size={22} aria-hidden="true"/>}<span className="cc-nav-label">{label}</span></button>)}</div></nav>
  </div>;
};

/** One headline weight (same rule as Robyn's page: latest dated reading, Robyn's assessment first on a tie), with date and source; other readings are detail. */
function TodayWeight({onOpen}:{onOpen:()=>void}) {
 const [scale,setScale]=useState<WeightRecord[]|null>(null),[body,setBody]=useState<Body|null>(null),[error,setError]=useState(false),[scaleError,setScaleError]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;void Promise.allSettled([loadWeightPage(),libraryRequest<{body:Body}>({action:'body_headline_get'})]).then(([w,b])=>{if(!live)return;
  if(w.status==='fulfilled')setScale(w.value.latestMeasurement?[w.value.latestMeasurement,...w.value.measurements.filter(m=>m.id!==w.value.latestMeasurement!.id)]:[]);
  if(b.status==='fulfilled')setBody(b.value.body||null);setScaleError(w.status==='rejected');setError(w.status==='rejected'&&b.status==='rejected');setLoading(false);});return()=>{live=false;};},[]);
 const latest=scale?.[0]||null,hb=body?.weight&&body.weight.source!=='scale'?body.weight:null;
 const md=(iso:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(iso+'T12:00:00Z'));
 // Change: vs the previous reading from the same source (headline from a check-in), or vs about a week earlier (scale).
 const weekAgo=latest&&scale?scale.find(m=>{const d=Date.parse(latest.measuredAt)-Date.parse(m.measuredAt);return d>=6.5*864e5&&d<=10*864e5;}):undefined;
 const change=hb?hb.previous?{v:hb.previous.change,ref:md(hb.previous.date)}:null:latest&&weekAgo?{v:Math.round((latest.weightLb-weekAgo.weightLb)*10)/10,ref:'a week earlier'}:null;
 const others=[...(hb&&latest?[`Scale ${latest.weightLb.toFixed(1)} lb (${weightTime(latest.measuredAt)})`]:[]),...(body?.weight_others||[]).filter(o=>o.source!=='scale'&&!(hb&&o.source===hb.source)).map(o=>`${o.label} ${o.value.toFixed(1)} lb (${md(o.date)})`)];
 const age=!hb&&latest?weightAge(latest.measuredAt):null;
  const trend=scale&&scale.length?scale.filter(m=>Date.parse(scale[0].measuredAt)-Date.parse(m.measuredAt)<=30*864e5).map(m=>m.weightLb).reverse():[];
 return <button className="cc-dashboard-card cc-weight-card" onClick={onOpen} data-empty={!loading&&!error&&!scaleError&&!hb&&!latest?'':undefined}><span className="cc-weight-eyebrow"><ToneIcon tone="weight"/>Weight</span>{trend.length>2&&<span className="cc-weight-spark"><Sparkline values={trend}/><small>Scale · 30 days</small></span>}
  <strong className={!hb&&!latest?'cc-weight-none':undefined}>{loading?'Loading weight…':error?'Weight unavailable':hb?`${hb.value.toFixed(1)} lb`:latest?`${latest.weightLb.toFixed(1)} lb`:scaleError?'Scale weight unavailable':'No weigh-in yet'}</strong>
  <span>{hb?`${hb.label} · ${md(hb.date)}`:latest?`${weightProvenanceLabel(latest.basis,latest.source)} · ${weightTime(latest.measuredAt)}${age?` · ${age}`:''}`:error||scaleError?'Open history to retry':'Step on the scale and it’ll show here.'}</span>
  {change&&<span className={`cc-weight-change ${change.v<0?'cc-good':change.v>0?'cc-bad':''}`}>{change.v>0?'▲ +':change.v<0?'▼ −':'= '}{Math.abs(change.v).toFixed(1)} lb vs {change.ref}</span>}
  {others.length>0&&<span className="cc-weight-others">Other readings: {others.join(' · ')}</span>}
  {!loading&&!error&&<span className="cc-weight-more">View history →</span>}</button>;
}

function TodayHome({setTab,setQuickAction,openTalkAbout,accountName}:{accountName?:string;setTab:(tab:TabKey)=>void;setQuickAction:(action:'tip'|'reset'|null)=>void;openTalkAbout:(entry:DashboardEntry)=>void}) {
  const [items,setItems]=useState<FeedItem[]|null>(null);
  const [err,setErr]=useState(false);
  const [coverage,setCoverage]=useState('');
  const [selected,setSelected]=useState<DashboardEntry|null>(null);
  const [selectedMeal,setSelectedMeal]=useState<string|null>(null);
  const nutrition=useNutritionData();
  const exercise=useTodayExercise();
  const [logExerciseRequest,setLogExerciseRequest]=useState(0);
  const mealCamera=useRef<HTMLInputElement>(null);
  const timelineItems=React.useMemo(()=>items?(ACCOUNT_SESSIONS?items:mergeTimelineItems(items,exerciseTimelineItems(exercise.entries))):null,[items,exercise.entries]);
  const loadId=useRef(0);
  const load=useCallback(()=>{
    const request=++loadId.current;
    setErr(false);setItems(null);
    feedRequest(ACCOUNT_SESSIONS ? {start:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date()),end:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date())} : {})
      .then(d=>{if(request===loadId.current){setItems(d.items);setCoverage(feedCoverage(d));}})
      .catch(()=>{if(request===loadId.current)setErr(true);});
  },[]);
  useEffect(()=>{load();const ref=loadId;return()=>{ref.current++;};},[load]);
  // Account feed owns the timeline snapshot. Confirmed workout changes refresh it
  // instead of replacing complete feed rows with the independent capped list.
  const exerciseWithRefresh=ACCOUNT_SESSIONS?{...exercise,add:(entry:Parameters<typeof exercise.add>[0])=>{exercise.add(entry);load();},remove:(id:string)=>{exercise.remove(id);load();}}:exercise;
  const loadMeal=useCallback(async(mealId:string)=>(await libraryRequest<{meal:FoodMeal}>({action:'food_get',mealId})).meal,[]);
  const needs=Math.max(items?mealsNeedingOk(items):0,nutrition.history?.pendingCount||0);
  const toEntry=(it:FeedItem|PulseItem,i:number):DashboardEntry=>({id:it.id||`${it.type}-${it.ts||i}`,type:it.type,date:it.date,time:it.time,title:it.title,body:it.body,calories:it.calories,amount:it.amount,currency:it.currency,details:it.details,icon:it.icon});
  const openItem=(it:FeedItem|PulseItem,i:number)=>{if(it.type==='food'&&typeof it.details?.mealId==='string')setSelectedMeal(it.details.mealId);else setSelected(toEntry(it,i));};
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(new Date()));
  const greeting=hour<5?'Up late':hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const dateLine=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long',month:'long',day:'numeric'}).format(new Date());
  // One time-of-day nudge, only when the food log is loaded and no meal was logged in the last three hours.
  const mealWindow=hour>=7&&hour<10?'Breakfast':hour>=11&&hour<14?'Lunch':hour>=17&&hour<21?'Dinner':null;
  const lastMeal=ACCOUNT_SESSIONS&&nutrition.history?lastLoggedMeal(nutrition.history.meals):null;
  const nextUp=ACCOUNT_SESSIONS&&nutrition.history&&mealWindow&&(!lastMeal||Date.now()-Date.parse(lastMeal.consumedAt||'')>3*36e5)?mealWindow:null;
  return <>
    <div className="cc-welcome cc-welcome-compact"><div><span className="cc-eyebrow">{dateLine}</span><h2>{greeting}, {accountName||'Matt'}.</h2><p>What are we conquering—or confessing?</p></div>
      {ACCOUNT_SESSIONS?<div className="cc-quick cc-quick-account" role="group" aria-label="Quick actions"><button className="cc-primary" onClick={()=>setTab('talk')}><Headphones size={20}/><span>Let's talk</span></button><button className="cc-secondary" onClick={()=>mealCamera.current?.click()}><Camera size={20}/><span>Meal photo</span></button><button className="cc-secondary" onClick={()=>setTab('record')}><Mic size={20}/><span>Record</span></button><button className="cc-secondary" aria-label="Log exercise" onClick={()=>setLogExerciseRequest(n=>n+1)}><Dumbbell size={20}/><span>Exercise</span></button><button className="cc-text-button cc-quick-tip" onClick={()=>setQuickAction('tip')}><Lightbulb size={16}/><span>Quick tip</span></button><input ref={mealCamera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label="Take meal photo file" onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';if(file){queueAccountMealPhoto(file);setTab('snap');}}}/></div>
      :<div className="cc-quick" role="group" aria-label="Quick actions"><button className="cc-primary" onClick={()=>setTab('talk')}><Headphones size={18}/>Let's talk</button><button className="cc-secondary" onClick={()=>setTab('record')}><Mic size={18}/><span>Record</span></button><button className="cc-secondary" onClick={()=>{try{personalStorage('sessionStorage').setItem('cupcake-food-capture','1');}catch{/* Capture remains reachable from Food. */}setTab('snap');}}><Camera size={18}/><span>Food photo</span></button><button className="cc-secondary cc-quick-pill" onClick={()=>setLogExerciseRequest(n=>n+1)}><Dumbbell size={18}/><span>Log exercise</span></button><button className="cc-secondary cc-quick-pill" onClick={()=>setQuickAction('tip')}><Lightbulb size={18}/><span>Quick tip</span></button></div>}</div>
    <SectionBoundary label="Saves"><SavesHero todayItems={items} nutrition={nutrition} onOpenWins={()=>setTab('week')} onTalkAbout={it=>openTalkAbout(toEntry(it,0))} onOpenItem={openItem}/></SectionBoundary>
    {needs>0&&<button type="button" className="cc-card cc-needs-ok" onClick={()=>{try{personalStorage('sessionStorage').setItem('cupcake-food-review','1');}catch{/* The food screen still lists meals that need a decision. */}setTab('snap');}}>{needs===1?'1 food photo needs attention':`${needs} food photos need attention`}</button>}
    {nextUp&&<div className="cc-card cc-next-up" role="note" aria-label="Next up"><div><span className="cc-eyebrow">Next up · {nextUp}</span><p><strong>{nextUp} time.</strong> Snap your plate when it lands and it’s logged for you.</p></div><button type="button" className="cc-primary" onClick={()=>mealCamera.current?.click()}><Camera size={18}/>Meal photo</button></div>}
    <div className="cc-today-grid">
    {ACCOUNT_SESSIONS&&<h3 className="cc-notyet-head">Not logged yet</h3>}
    {ACCOUNT_SESSIONS&&<SectionBoundary label="Apple Health uploads"><AccountHealthSyncCard/></SectionBoundary>}
    <SectionBoundary label="Food today"><NutritionTodayCard {...nutrition} onRetry={()=>void nutrition.reload()} onOpenMeal={setSelectedMeal} onOpenCalendar={()=>setTab('snap')}/></SectionBoundary>
    <section className="cc-card cc-signals"><div className="cc-heading-row"><h3 className="cc-card-title"><ToneIcon tone="summary"/>Timeline</h3><button className="cc-text-button" onClick={()=>setTab('week')}>All signals</button></div>
      {err?<div className="cc-signal-error"><p role="alert">{ACCOUNT_SESSIONS?ACCOUNT_UNAVAILABLE:'Cupcake couldn’t load your latest signals. Check your connection.'}</p><button type="button" className="cc-secondary" onClick={load}>Retry</button></div>:!timelineItems?<Spinner/>:!timelineItems.length?<Empty text={ACCOUNT_SESSIONS?"No saved account entries returned for today. See coverage below for sources that are unavailable.":"Nothing yet today. Purchases, calls, meals and workouts show up here as they happen. Older history is in Wins & losses."}/>:<Timeline items={timelineItems} onOpen={openItem} onAll={()=>setTab('week')} formatClock={it=>it.time?signalClock(it.time,it.date,it.ts):''}/>}
      {ACCOUNT_SESSIONS&&coverage&&<p className="cc-muted cc-small">{coverage}</p>}
      {!ACCOUNT_SESSIONS&&!err&&timelineItems&&(exercise.status==='error'||exercise.status==='unavailable')&&<p className="cc-muted cc-small" role="status">{exercise.status==='error'?'Workouts couldn’t load, so any logged today are missing from this timeline.':'Workouts are not available from the library, so they are not shown here.'}</p>}
    </section>
    <SectionBoundary label="Energy"><TodayEnergy items={items} nutrition={nutrition} exercise={exerciseWithRefresh} openLogRequest={logExerciseRequest}/></SectionBoundary>
    <SignalSheet open={!!selected} label={selected?.type==='intervention'?'Call details':'Details'} onClose={()=>setSelected(null)}>{selected&&<SignalDetail entry={selected} backLabel="Back to Today" onBack={()=>setSelected(null)} loadMeal={loadMeal} updateIntervention={updateIntervention} onUpdated={()=>{setSelected(null);load();}} onTalkAbout={entry=>{setSelected(null);openTalkAbout(entry);}}/>}</SignalSheet>
    <SavedMealDialog mealId={selectedMeal} meals={nutrition.history?.meals||[]} onSelect={setSelectedMeal} onClose={()=>setSelectedMeal(null)}/>
    <SectionBoundary label="Weight"><TodayWeight onOpen={()=>setTab('week')}/></SectionBoundary>
    <SectionBoundary label="Body assessment"><BodyAssessmentCard/></SectionBoundary>
    </div>
  </>;
}

// ---------- CHAT ----------
const ChatView = QuickChat;

// ---------- SNAP (food photo) ----------
const SnapView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const nutrition = useNutritionData();
  const reloadNutrition = nutrition.reload;
  const [selectedSavedMeal,setSelectedSavedMeal] = useState<string|null>(()=>new URLSearchParams(window.location.search).get('meal'));
  const [captureOpen,setCaptureOpen] = useState(()=>{try{const open=personalStorage('sessionStorage').getItem('cupcake-food-capture')==='1';personalStorage('sessionStorage').removeItem('cupcake-food-capture');return open;}catch{return false;}});
  const captureSection = useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(captureOpen)captureSection.current?.scrollIntoView({block:'start'});},[captureOpen]);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoTime, setPhotoTime] = useState('');
  const [reviewBeforeLog, setReviewBeforeLog] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mealTrigger = useRef<HTMLElement | null>(null);
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

  const loadRecentMeals = useCallback(async () => { try { const data = await libraryRequest<{ meals: FoodMeal[] }>({ action: 'food_list', limit: 200 }); setRecentMeals(data.meals || []); void reloadNutrition(); } catch (e) { setError(e instanceof Error ? e.message : 'Recent food photos are unavailable.'); } }, [reloadNutrition]);
  useEffect(() => { void loadRecentMeals(); }, [loadRecentMeals]);

  const onFile = (f: File) => {
    if (ACCOUNT_SESSIONS || busy) return;
    setError(''); setBusy(true);
    setConfirmedConsumed(false); setConsumedAt(''); setPortionNote('');
    const at = new Date(f.lastModified >= 946684800000 && f.lastModified <= Date.now() ? f.lastModified : Date.now()).toISOString();
    setPhotoTime(at); setDetailsOpen(true); setResult(null);
    void prepareFoodImage(f).then(async image => { setPreview(image); await analyze(image, at); }).catch(e => setError(e instanceof Error ? e.message : 'Could not prepare that image.')).finally(() => setBusy(false));
  };

  const analyze = async (photo?: string, at = photoTime) => {
    if (ACCOUNT_SESSIONS) return;
    const image = photo || preview;
    if (!image || (busy && !photo)) return;
    setDetailsOpen(true); setConsumedAt(at);
    setBusy(true); setResult(null); setError(''); setConfirmedConsumed(false); setPortionNote('');
    try { const data = await libraryRequest<FoodResult>({ action: 'food_analyze', image, note, estimateVisiblePortion: true, reviewOnly: true, autoLog: !reviewBeforeLog, confirmConsumed: !reviewBeforeLog, consumedAt: at }, { foodGesture: true }); setResult(data); if (data.logError) setError(data.logError); void loadRecentMeals(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Food analysis failed. The original image remains on this device.'); }
    finally { setBusy(false); }
  };

  const retry = async () => { const mealId = result?.meal?.id; if (ACCOUNT_SESSIONS || !mealId || busy) return; setBusy(true); setError(''); try { setResult(await libraryRequest<FoodResult>({ action: 'food_retry', mealId }, { foodGesture: true })); void loadRecentMeals(); } catch (e) { setError(e instanceof Error ? e.message : 'Retry failed.'); } finally { setBusy(false); } };
  const refine = async () => { const mealId = result?.meal?.id; if (ACCOUNT_SESSIONS || !mealId || !portionNote.trim() || busy) return; setBusy(true); setError(''); setConfirmedConsumed(false); try { setResult(await libraryRequest<FoodResult>({ action: 'food_refine', mealId, note: portionNote.trim(), consumedPortions: { note: portionNote.trim() }, reviewOnly: true, autoLog: false }, { foodGesture: true })); setPortionNote(''); void loadRecentMeals(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the portion estimate.'); } finally { setBusy(false); } };
  const openMeal = async (mealId: string) => { if (busy) return; setBusy(true); setError(''); try { const data = await libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId }); setResult({ meal: data.meal }); setPreview(null); setPortionNote(''); setConfirmedConsumed(false); setConsumedAt(data.meal.pendingConsumedAt || data.meal.photoTakenAt || data.meal.createdAt || ''); setDetailsOpen(true); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load that saved meal.'); } finally { setBusy(false); } };

  const logMeal = async () => {
    if (ACCOUNT_SESSIONS) return;
    const meal = result?.meal; if (!meal || busy || portionNote.trim() || !confirmedConsumed || (!consumedAt && !meal.pendingConsumedAt)) return;
    setBusy(true); setError('');
    let attemptedAt = meal.pendingConsumedAt || '';
    try {
      const timestamp = Date.parse(meal.pendingConsumedAt || consumedAt);
      if (!Number.isFinite(timestamp) || timestamp > Date.now()) throw new Error('Choose a valid time when you ate this meal, no later than now.');
      const at = new Date(timestamp).toISOString();
      attemptedAt = at;
      setResult(current => current?.meal ? { ...current, meal: { ...current.meal, pendingConsumedAt: at } } : current);
      setResult(await libraryRequest<FoodResult>({ action: 'food_log', mealId: meal.id, confirmConsumed: true, consumedAt: at }, { foodGesture: true }));
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

  const suggestedPhotoTime = photoConsumedAt(result?.meal?.photoTakenAt || result?.meal?.createdAt);
  const pendingMeals = recentMeals.filter(meal => !meal.sheetLoggedAt);
  const mealRow = (meal: FoodMeal) => <button type="button" className="cc-snap-recent-item" key={meal.id} disabled={busy} aria-expanded={detailsOpen && result?.meal?.id === meal.id} onClick={event => { mealTrigger.current = event.currentTarget; if (detailsOpen && result?.meal?.id === meal.id) setDetailsOpen(false); else void openMeal(meal.id); }}><span><strong>{meal.description || 'Food photo'}</strong><small>{meal.createdAt ? new Date(meal.consumedAt || meal.photoTakenAt || meal.createdAt).toLocaleString() : 'Saved meal'} · {recentMealStatus(meal)}{meal.sheetLoggedAt ? '' : ' · not in calorie totals'}</small></span><span>{meal.total?.calories ?? '—'} kcal</span></button>;
  const mealQueue = pendingMeals.length ? <section className="cc-snap-queue" aria-label="Photos to check"><div className="cc-heading-row"><h3>{pendingMeals.length} {pendingMeals.length === 1 ? 'photo' : 'photos'} to check</h3><button className="cc-text-button" disabled={busy} onClick={() => void loadRecentMeals()}>Refresh</button></div><p className="cc-muted cc-small">These photos need a nutrition estimate or a logging retry. Open one to see what is missing.</p>{pendingMeals.map(mealRow)}</section> : null;
  const cameraBlock = <>
    <div className="cc-food-default"><p><strong>Full photo = full meal</strong><br/><small>Photos log automatically at the photo file’s time. Unknown nutrition stays marked as missing.</small></p><label><input aria-label="Review before logging" type="checkbox" disabled={busy} checked={reviewBeforeLog} onChange={e => setReviewBeforeLog(e.target.checked)}/>Review portions or change the time before logging</label><input aria-label="Food note" value={note} disabled={busy} onChange={e => setNote(e.target.value)} placeholder="Optional: half the rice, sugar-free drink…" className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm"/></div>
    <div className="cc-food-capture"><Camera size={30}/><div><p>Take a photo of what you ate</p><small>Calories and nutrients are estimates.</small></div></div>
    <div className="cc-snap-actions"><button type="button" className="cc-primary" disabled={busy} onClick={event => { mealTrigger.current = event.currentTarget; cameraRef.current?.click(); }}><Camera size={17}/>Take photo</button><button type="button" className="cc-secondary" disabled={busy} onClick={event => { mealTrigger.current = event.currentTarget; fileRef.current?.click(); }}>Choose existing photo</button></div>
    {busy && <p role="status">Preparing your meal and saving its estimate…</p>}
  </>;

  return (
    <div className="space-y-4">
      <div className="cc-snap-head">
        <button type="button" className="cc-text-button" onClick={() => onBack?.()}><ArrowLeft size={17}/>Back to Today</button>
        <h2 className="cc-snap-title">Food</h2>
      </div>
      <AccountFoodSections>
      {reviewFirst && mealQueue}
      {ACCOUNT_SESSIONS ? <AccountPhotoMeal onSaved={()=>void loadRecentMeals()} onOpenMeal={setSelectedSavedMeal}/> : <details className="cc-card cc-food-capture-panel" ref={captureSection} open={captureOpen} onToggle={event=>setCaptureOpen(event.currentTarget.open)}><summary>Log a food photo</summary>{cameraBlock}</details>}
      {ACCOUNT_SESSIONS && <AccountManualMeal onSaved={()=>void loadRecentMeals()}/>}
      <NutritionWorkspace {...nutrition} onOpenMeal={setSelectedSavedMeal} onSaveSettings={nutrition.saveSettings} onRetry={()=>void nutrition.reload()} onOpenCapture={ACCOUNT_SESSIONS ? undefined : ()=>{setCaptureOpen(true); requestAnimationFrame(()=>captureSection.current?.scrollIntoView({behavior:'smooth',block:'start'}));}}/>
      <SavedMealDialog mealId={selectedSavedMeal} meals={nutrition.history?.meals||[]} onSelect={setSelectedSavedMeal} onClose={()=>setSelectedSavedMeal(null)}/>
      {!reviewFirst && mealQueue}
      {!ACCOUNT_SESSIONS && <><input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.currentTarget.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.currentTarget.value = ''; }} /></>}
      {error && !detailsOpen && <p className="text-sm text-rose-200" role="alert">{error}</p>}

      {preview && !result && !busy && (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…"
            className="cc-food-note w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm placeholder:text-white/30" />
          <button onClick={() => void analyze()} disabled={busy}
            className="cc-food-retry w-full py-3.5 rounded-full font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <><Loader2 className="animate-spin" size={18} /> Preparing…</> : 'Retry food analysis'}
          </button>
        </>
      )}

      <MealDialog returnFocus={mealTrigger} open={detailsOpen} onClose={() => setDetailsOpen(false)}>
      {busy && !result && <p role="status">Estimating and saving your meal… You can close this window while it finishes.</p>}
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      {preview && <img src={preview} alt="Your food photo" className="cc-snap-preview"/>}
      {result && (
        <div className="cc-food-result border rounded-2xl p-4">
          <p className="cc-food-result-accent font-semibold">{result.meal?.description || result.Description || result.description || 'Food photo'}</p>
          <p className="text-xs text-white/60 mt-2">Estimated nutrition for the portions below.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
            <Stat label="Calories" value={result.meal?.total?.calories ?? result.Calories ?? result.calories} />
            <Stat label="Total carbs (g)" value={result.meal?.total?.carbs_g ?? result.Carbs ?? result.carbs_g} />
            <Stat label="Sugar (g)" value={result.meal?.total?.sugar_g ?? result.Sugar ?? result.sugar_g} />
            <Stat label="Protein (g)" value={result.meal?.total?.protein_g ?? result.Protein ?? result.protein_g} />
          </div>
          {result.meal?.calorieRange && <p className="cc-food-result-accent text-xs mt-3">Estimated range: {result.meal.calorieRange.low}–{result.meal.calorieRange.high} kcal. Photo estimates depend on portion size and ingredients.</p>}
          {result.meal?.lookupWarnings?.map(warning => <p className="text-xs text-amber-200 mt-3" key={warning}>Variant warning: {warning}</p>)}
          {!ACCOUNT_SESSIONS && result.meal?.status === 'ready' && !result.meal.sheetLoggedAt && !result.meal.pendingConsumedAt && <>{result.meal.needsClarification && <p className="text-xs text-amber-200 mt-3">Review needed: {result.meal.clarification || 'Some portions were unclear.'}</p>}<p className="text-xs text-white/60 mt-3">The photo estimate already uses the visible portions. Correct an item, amount, or product below, then review the updated estimate.</p><input aria-label="Portion corrections" disabled={busy} value={portionNote} onChange={e => { setPortionNote(e.target.value); setConfirmedConsumed(false); }} placeholder="e.g. Half the rice; the drink is sugar-free…" className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm mt-3" /><button className="cc-secondary mt-3" disabled={busy || !portionNote.trim()} onClick={() => void refine()}>Apply correction & re-estimate</button></>}
          {!ACCOUNT_SESSIONS && result.meal?.status === 'analysis_failed' && <button className="cc-secondary mt-3" disabled={busy} onClick={() => void retry()}>Retry analysis</button>}
          {!!result.meal?.items?.length && <div className="cc-snap-items"><strong>Saved item estimates</strong>{result.meal.items.map(item => <div key={item.id}><span>{item.name}{item.quantity != null ? ` · ${item.quantity} ${item.unit || 'portion(s)'}` : ''}</span><small>{item.nutrition?.calories ?? '—'} kcal · {item.nutrition?.carbs_g ?? '—'} g total carbs · {item.nutrition?.sugar_g ?? '—'} g sugar · {item.provenance || 'estimate'}{item.variantWarning ? ` · ${item.variantWarning}` : ''}{item.calculation ? ` · ${item.calculation}` : ''}{item.portionAssumption ? ` · Assumes ${item.portionAssumption}` : ''}{item.sourceCitations?.map(source => /^https?:\/\//.test(source.url) ? <a key={source.url} href={source.url} target="_blank" rel="noreferrer"> · {source.title}</a> : null)}</small></div>)}</div>}
          {(result.meal?.totalIsPartial || (result.meal?.total && Object.values(result.meal.total).some(value => value == null))) && <p className="text-xs text-amber-200 mt-3">Partial estimate: some items or nutrients could not be estimated. Unknown values show —.</p>}
          {result.meal?.sheetLoggedAt && <button className="cc-secondary mt-3" onClick={()=>{setDetailsOpen(false);setSelectedSavedMeal(result.meal!.id);}}>Browse saved meal &amp; photo</button>}
          {result.meal?.sheetLoggedAt ? <p className="text-xs text-emerald-300 mt-3" role="status">✓ Added to your food log · eaten {new Date(result.meal.consumedAt || result.meal.photoTakenAt || result.meal.createdAt || '').toLocaleString()} · included in that day’s calories{result.duplicate ? ' · already counted once' : ''}</p> : result.meal && (ACCOUNT_SESSIONS ? <p className="cc-muted mt-3">This saved photo is not in your calorie totals. Photo analysis and confirming photo estimates are not available for account sign-in yet.</p> : <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <p className="text-sm text-amber-100" role="status">{result.meal.status === 'analysis_failed' ? 'Photo saved. Analysis failed—retry to get an estimate.' : result.meal.autoLogRequested && result.meal.needsClarification ? 'Meal photo saved as eaten. Nutrition is missing; it is not counted as zero calories.' : 'Photo saved privately. Not counted in your calorie totals yet.'}</p>
            {result.meal.status !== 'analysis_failed' && <p className="text-xs text-white/60">To give your OK: set when you ate it, check the box, then add it to your food log.</p>}
            {result.meal.total?.calories != null && !result.meal.needsClarification && !!result.meal.items?.length && result.meal.items.every(item => item.nutrition?.calories != null) && <>
              {suggestedPhotoTime && !result.meal.pendingConsumedAt && <button type="button" className="cc-secondary" disabled={busy} onClick={() => { setConsumedAt(suggestedPhotoTime); setConfirmedConsumed(false); }}>Use the photo time</button>}
              {result.meal.pendingConsumedAt ? <p className="text-xs text-white/60">Retrying the same meal time: {new Date(result.meal.pendingConsumedAt).toLocaleString()}</p> : <MealTimeInput key={result.meal.id} value={consumedAt} disabled={busy} onChange={value => { setConsumedAt(value); setConfirmedConsumed(false); }} />}
              <label className="cc-meal-consent"><input aria-label="Confirm consumed portions" type="checkbox" disabled={busy || !!portionNote.trim()} checked={confirmedConsumed} onChange={e => setConfirmedConsumed(e.target.checked)} />I ate these portions. Add this estimate to my calorie totals.</label>{portionNote.trim() && <p className="text-xs text-amber-200">Apply your correction, or clear it, before confirming these portions.</p>}
              <button type="button" className="cc-primary" disabled={busy || !!portionNote.trim() || !confirmedConsumed || (!consumedAt && !result.meal.pendingConsumedAt)} onClick={() => void logMeal()}>{busy ? 'Saving…' : 'Add to food log'}</button>
            </>}
          </div>)}

        </div>
      )}
      </MealDialog>
      </AccountFoodSections>
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
  <p className="cc-timeline-empty">{text}</p>
);

export { SnapView };
export default function CupcakeEntry() { useAccountInstallMetadata(); return ACCOUNT_SESSIONS ? <AccountSessionGate>{identity=><CupcakeGPT accountIdentity={identity}/>}</AccountSessionGate> : <CupcakeGPT/>; }
