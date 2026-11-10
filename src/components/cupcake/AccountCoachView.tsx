import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountCoach, accountCoachPhoto, type AccountIdentity } from './accountSession';
import './account-coach.css';
import { personalAssistantLabel } from './assistantBrand';
import { AccountPilotWorkspace } from './AccountPilotWorkspace';

type Row = Record<string, unknown>;
type Scope = 'clean-report' | 'meal-photo';
type Grant = { id:string; owner_id:string; subject_id:string; scopes:Scope[]; created:number; expires:number; revoked:number|null; ownerDisplayName?:string|null; subjectDisplayName?:string|null };
type Coverage = { queryComplete:boolean; rowsRead:number; invalidRows:number };
type ReportKey = 'weight'|'bodyMeasurements'|'manualGlucose'|'exercise'|'outcomes'|'steps'|'ringconnNight'|'nutrition';
type Report = { version:1; scope:'clean-report'; source:'owned_local_ledgers'; grantId:string; ownerId:string; period:{start:string;end:string;timezone:string}; generatedAt:string; data:Record<ReportKey,Row|null>; coverage:Record<ReportKey,Coverage> };
type Period = {start:string;end:string};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const record = (value:unknown):Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value:unknown):Row[] => Array.isArray(value) ? value.filter(value=>value && typeof value === 'object' && !Array.isArray(value)) : [];
const numeric = (value:unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const number = (value:unknown) => numeric(value)?.toLocaleString('en-US',{maximumFractionDigits:2}) ?? '—';
const day = (value:unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '—';
const savedTime = (value:unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago'})+' CT' : 'Time unavailable';
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const label = (name:unknown,fallback='Authorized owner') => typeof name === 'string' && name.trim() ? name.trim() : fallback;
const scopeLabel = (scope:Scope) => scope === 'clean-report' ? 'Health report' : 'Meal photos';
const failure = (error:unknown) => error instanceof Error ? error.message : 'The authorized view could not load.';
function periodFor(end:string,days:7|30):Period|null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end>today()) return null;
  const date = new Date(end+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===end ? {start:new Date(date.getTime()-(days-1)*86400000).toISOString().slice(0,10),end} : null;
}
function grants(value:unknown,identity:AccountIdentity,owned=false):Grant[] {
  return rows(value).filter((g):g is Row & Grant=>typeof g.id==='string' && uuid.test(g.id) && typeof g.owner_id==='string' && typeof g.subject_id==='string'
    && g.owner_id!==g.subject_id && (owned ? g.owner_id===identity.account_id : g.subject_id===identity.account_id)
    && Array.isArray(g.scopes) && g.scopes.length>0 && g.scopes.every(scope=>scope==='clean-report'||scope==='meal-photo')
    && numeric(g.created)!==null && numeric(g.expires)!==null && (g.revoked===null||numeric(g.revoked)!==null));
}
const activeGrant = (grant:Grant) => grant.revoked===null && grant.created<=Date.now()/1000 && grant.expires>Date.now()/1000;

export function AccountCoachView({identity,onPersonal,assistantName='Cupcake'}:{identity:AccountIdentity;onPersonal:()=>void;assistantName?:string}) {
  const [received,setReceived]=useState<Grant[]>([]),[selected,setSelected]=useState<Grant|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [days,setDays]=useState<7|30>(7),[end,setEnd]=useState(today);
  const epoch=useRef(0);
  const cancel=useCallback(()=>{epoch.current++;},[]);
  const reload=useCallback(async()=>{
    const attempt=++epoch.current;setReceived([]);setSelected(null);setLoading(true);setError('');
    try { const result=await accountCoach<{grants:unknown}>('grants/received',{});if(attempt!==epoch.current)return;
      setReceived(grants(result.grants,identity).filter(activeGrant));
    } catch(reason){if(attempt===epoch.current)setError(failure(reason));}
    finally{if(attempt===epoch.current)setLoading(false);}
  },[identity]);
  useEffect(()=>{void reload();return cancel;},[reload,cancel]);
  useEffect(()=>{
    if(!selected)return;
    const timer=setTimeout(()=>{setSelected(null);setReceived(current=>current.filter(activeGrant));setError('This authorization expired. Reload to check your available reports.');},Math.min(2147483647,Math.max(0,selected.expires*1000-Date.now())));
    return()=>clearTimeout(timer);
  },[selected]);
  const period=useMemo(()=>periodFor(end,days),[end,days]);
  return <section className="cc-coach" aria-label="Authorized reports">
    <div className="cc-coach-context"><div><span className="cc-eyebrow">AUTHORIZED VIEW</span><h2>{selected?`Report — ${label(selected.ownerDisplayName)}`:'Reports shared with you'}</h2><p>Signed in as {identity.name||identity.email}. Your personal {assistantName} stays separate from these authorized views.</p></div><button className="cc-secondary" onClick={onPersonal}>{personalAssistantLabel(assistantName,identity.name||identity.email)}</button></div>
    <AccountPilotWorkspace identity={identity} onSharingChanged={()=>void reload()}/>
    <div className="cc-coach-controls"><label className="cc-label">Whose data<select aria-label="Authorized owner" value={selected?.id||''} disabled={loading} onChange={event=>setSelected(received.find(grant=>grant.id===event.target.value&&activeGrant(grant))||null)}><option value="">Choose an authorized owner</option>{received.map(grant=><option key={grant.id} value={grant.id}>{label(grant.ownerDisplayName)} · {grant.scopes.map(scopeLabel).join(' + ')}</option>)}</select></label><button className="cc-text-button" onClick={()=>void reload()} disabled={loading}>Reload authorizations</button></div>
    {loading&&<p role="status">Checking active authorizations…</p>}{error&&<p role="alert">{error}</p>}
    {!loading&&!error&&!received.length&&<p>No active reports have been shared with this account. The owner must authorize your existing account before a report can appear. There is no public account search here.</p>}
    {selected&&<><div className="cc-coach-lens" role="note" aria-label="Whose information is shown"><span className="cc-coach-lens-who"><strong>{label(selected.ownerDisplayName)}</strong> shared this with you</span><span className="cc-coach-lens-scopes">{selected.scopes.map(scope=><span key={scope}>{scopeLabel(scope)}</span>)}</span><p className="cc-muted">Authorized for {selected.scopes.map(scopeLabel).join(' and ')} until {new Date(selected.expires*1000).toLocaleString()}. Each permission is checked separately, and the owner can revoke it at any time.</p></div><div className="cc-coach-period"><div role="group" aria-label="Report period">{([7,30] as const).map(value=><button className="cc-secondary" key={value} aria-pressed={days===value} onClick={()=>setDays(value)}>{value} days</button>)}</div><label className="cc-label">Through<input type="date" aria-label="Report end date" max={today()} value={end} onChange={event=>setEnd(event.target.value)}/></label></div>
      {!period?<p role="alert">Choose a valid past or current Chicago date.</p>:<GrantView key={`${selected.id}:${period.start}:${period.end}`} grant={selected} period={period}/>}
    </>}
    <OwnedGrants identity={identity}/>
  </section>;
}
function GrantView({grant,period}:{grant:Grant;period:Period}) {
  return <><p>{period.start} – {period.end} · America/Chicago. Missing data stays unknown.</p>
    {grant.scopes.includes('clean-report')?<CleanReport grant={grant} period={period}/>:<p>Health report access was not shared. A meal-photo permission does not include health numbers.</p>}
    {grant.scopes.includes('meal-photo')?<MealPhotos grant={grant} period={period}/>:<p>Meal-photo access was not shared. Health report access does not include original images.</p>}
  </>;
}
function CleanReport({grant,period}:{grant:Grant;period:Period}) {
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;setData(null);setError('');setLoading(true);
    void accountCoach<{report:Report}>('report',{grant_id:grant.id,...period}).then(({report})=>{
      if(report?.version!==1||report.scope!=='clean-report'||report.source!=='owned_local_ledgers'||report.grantId!==grant.id||report.ownerId!==grant.owner_id||report.period?.start!==period.start||report.period?.end!==period.end||report.period?.timezone!=='America/Chicago'||!report.data||!report.coverage)throw Error('The report context was not confirmed.');
      for(const key of ['weight','bodyMeasurements','manualGlucose','exercise','outcomes','steps','ringconnNight','nutrition'] as const){
        const value=report.data[key],coverage=report.coverage[key];
        if(!(value===null||(value&&typeof value==='object'&&!Array.isArray(value)))||!coverage||typeof coverage.queryComplete!=='boolean'
          ||!Number.isSafeInteger(coverage.rowsRead)||coverage.rowsRead<0||!Number.isSafeInteger(coverage.invalidRows)||coverage.invalidRows<0)throw Error('The report coverage was not confirmed.');
      }
      if(alive)setData(report);
    }).catch(reason=>{if(alive)setError(failure(reason));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};
  },[grant,period,retry]);
  if(loading)return <p role="status">Loading authorized health numbers…</p>;
  if(error)return <div role="alert"><p>{error} No earlier report is shown.</p><button className="cc-secondary" onClick={()=>setRetry(value=>value+1)}>Retry health report</button></div>;
  if(!data)return null;
  const d=data.data;
  return <section aria-label="Clean health report"><h3>Health numbers</h3><p>Owned local ledgers only. This view excludes private notes, messages, purchase details and inferred meals. A query covering this period does not prove complete tracking.</p><div className="cc-coach-grid">
    <MetricSection title="Weight" data={d.weight} coverage={data.coverage.weight} provenance="Scale / Health Connect and explicit owner entries or corrections"><Summary data={d.weight} fields={['firstLb','latestLb','changeLb','samples']} labels={['First lb','Latest lb','Change lb','Readings']}/><NumbersTable data={rows(d.weight?.daily)} fields={['meanLb','minLb','maxLb','samples']} labels={['Mean lb','Min lb','Max lb','Readings']}/></MetricSection>
    <MetricSection title="Body measurements" data={d.bodyMeasurements} coverage={data.coverage.bodyMeasurements} provenance="Owned body check-ins; flagged measurements stay missing"><NumbersTable data={rows(d.bodyMeasurements?.measurements)} fields={['weight_lb','body_fat_pct','neck_in','waist_in','hips_in']} labels={['Weight lb','Body fat %','Neck in','Waist in','Hips in']} source/></MetricSection>
    <MetricSection title="Manual glucose" data={d.manualGlucose} coverage={data.coverage.manualGlucose} provenance="Owner-reported manual glucose; not sensor readings"><NumbersTable data={rows(d.manualGlucose?.daily)} fields={['meanMgDl','minMgDl','maxMgDl','samples']} labels={['Mean mg/dL','Min mg/dL','Max mg/dL','Readings']}/></MetricSection>
    <MetricSection title="Exercise" data={d.exercise} coverage={data.coverage.exercise} provenance="Owner-reported exercise estimates; omitted duration stays unknown"><NumbersTable data={rows(d.exercise?.daily)} fields={['entries','minutes','knownDurationEntries','missingDurationEntries','energyKcal']} labels={['Entries','Known min','With duration','Missing duration','Est. kcal']}/></MetricSection>
    <MetricSection title="Outcomes" data={d.outcomes} coverage={data.coverage.outcomes} provenance="Explicit owner-reported outcomes only"><Summary data={record(d.outcomes?.counts)} fields={['wins','losses','unscored','total']} labels={['Wins','Setbacks','Unscored','Total']}/><NumbersTable data={rows(d.outcomes?.daily)} fields={['wins','losses','unscored']} labels={['Wins','Setbacks','Unscored']}/></MetricSection>
    <MetricSection title="Steps" data={d.steps} coverage={data.coverage.steps} provenance="Owned local steps ledger"><NumbersTable data={rows(d.steps?.daily)} fields={['count']} labels={['Steps']}/></MetricSection>
    <MetricSection title="RingConn nights" data={d.ringconnNight} coverage={data.coverage.ringconnNight} provenance="RingConn provider estimates; missing metrics stay unknown"><NumbersTable data={rows(d.ringconnNight?.nights)} fields={['asleepMinutes','sessionMinutes','averageHeartRateBpm','restingHeartRateBpm','meanSpo2Percent']} labels={['Asleep min','Session min','Avg HR bpm','Resting HR bpm','Mean SpO₂ %']}/></MetricSection>
    <MetricSection title="Confirmed nutrition" data={d.nutrition} coverage={data.coverage.nutrition} provenance="Confirmed local food ledger; photos and purchases alone never establish eating"><NutritionTable data={rows(d.nutrition?.daily)}/><p>Totals include known values only. Missing nutrients and unlogged meals remain gaps; this is not complete intake.</p></MetricSection>
  </div></section>;
}
function MetricSection({title,data,coverage,provenance,children}:{title:string;data:Row|null;coverage?:Coverage;provenance:string;children:ReactNode}) {
  const source=<p className="cc-coach-provenance">{provenance}</p>;
  const query=<p className="cc-coach-coverage">{coverage?`${coverage.queryComplete===true?'Query covered the requested range':'Query was limited'} · ${number(coverage.rowsRead)} rows checked · ${number(coverage.invalidRows)} invalid rows omitted`:'Query coverage is unavailable.'}</p>;
  if (!data) return <details className="cc-card cc-coach-empty cc-coach-empty-row">
    <summary><strong>{title}</strong><span>Unknown{coverage?.queryComplete===false?' · Limited query':''}{coverage&&coverage.invalidRows>0?' · Invalid rows omitted':''}</span></summary>
    <p>No local data for this period. This is unknown, not zero.</p>{source}{query}
  </details>;
  return <section className="cc-card"><h4>{title}</h4>{source}{children}{query}</section>;
}
function Summary({data,fields,labels}:{data:Row|null;fields:string[];labels:string[]}) {return <dl className="cc-coach-summary">{fields.map((field,index)=><div key={field}><dt>{labels[index]}</dt><dd>{number(data?.[field])}</dd></div>)}</dl>;}
function NumbersTable({data,fields,labels,source=false}:{data:Row[];fields:string[];labels:string[];source?:boolean}) {
  const sources:Record<string,string>={robyn_assessment:'Coach assessment',robyn_peck_app:'Owner-entered coach app',ihome_scale:'Scale',manual:'Manual'};
  return data.length?<div className="cc-coach-table"><table><thead><tr><th>Date</th>{source&&<th>Source</th>}{labels.map(name=><th key={name}>{name}</th>)}</tr></thead><tbody>{data.map((row,index)=><tr key={index}><th>{day(row.date)}</th>{source&&<td>{sources[String(row.source)]||'Unknown source'}</td>}{fields.map(field=><td key={field}>{number(row[field])}</td>)}</tr>)}</tbody></table></div>:null;
}
function NutritionTable({data}:{data:Row[]}) {
  const nutrients=[['calories','kcal'],['protein_g','Protein g'],['carbs_g','Carbs g'],['fat_g','Fat g'],['sugar_g','Sugar g']];
  return <div className="cc-coach-table"><table><thead><tr><th>Date</th><th>Confirmed meals</th><th>Partial meals</th>{nutrients.map(([key,name])=><th key={key}>{name}</th>)}</tr></thead><tbody>{data.map((row,index)=><tr key={index}><th>{day(row.date)}</th><td>{number(row.confirmedMeals)}</td><td>{number(row.partialMeals)}</td>{nutrients.map(([key])=>{const value=record(record(row.knownTotals)[key]);return <td key={key}>{number(value.sum)}<small>{number(value.mealsWithValue)} known · {number(value.missingMeals)} missing</small></td>;})}</tr>)}</tbody></table></div>;
}
function MealPhotos({grant,period}:{grant:Grant;period:Period}) {
  const [entries,setEntries]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[limit,setLimit]=useState(12),[retry,setRetry]=useState(0),[coverage,setCoverage]=useState<Coverage|null>(null);
  useEffect(()=>{let alive=true;setEntries([]);setError('');setLoading(true);
    void accountCoach<{mealPhotos:{entries:unknown;coverage:Coverage;dateBasis:string;source:string}}>('meal-list',{grant_id:grant.id,...period}).then(({mealPhotos})=>{
      if(mealPhotos?.dateBasis!=='saved_at'||mealPhotos.source!=='owned_saved_meal_originals')throw Error('The meal-photo context was not confirmed.');
      if(alive){setEntries(rows(mealPhotos.entries).filter(row=>typeof row.mealId==='string'&&typeof row.savedAt==='string'));setCoverage(mealPhotos.coverage);}
    }).catch(reason=>{if(alive)setError(failure(reason));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};
  },[grant,period,retry]);
  return <section aria-label="Authorized meal photos"><h3>Meal photos</h3><p>Saved originals shared separately from health numbers. A saved photo or its timestamp does not confirm that a meal was eaten.</p>{loading?<p role="status">Loading authorized photo references…</p>:error?<div role="alert"><p>{error} No earlier photos are shown.</p><button className="cc-secondary" onClick={()=>setRetry(value=>value+1)}>Retry meal photos</button></div>:<><p className="cc-muted">{coverage?.queryComplete===true?'Photo query covered the requested range.':'Photo query coverage is limited or unavailable.'} {entries.length?`${entries.length} saved references.`:'No saved photo references in this period.'}</p><div className="cc-coach-photos">{entries.slice(0,limit).map(entry=><MealPhoto key={String(entry.mealId)} grant={grant} entry={entry}/>)}</div>{entries.length>limit&&<button className="cc-secondary" onClick={()=>setLimit(value=>value+12)}>Show more photo references</button>}</>}</section>;
}
function MealPhoto({grant,entry}:{grant:Grant;entry:Row}) {
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const alive=useRef(true),held=useRef(''),timer=useRef<ReturnType<typeof setTimeout>>();
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current);if(held.current)URL.revokeObjectURL(held.current);};},[]);
  const load=async()=>{
    setBusy(true);setError('');if(held.current){URL.revokeObjectURL(held.current);held.current='';setUrl('');}clearTimeout(timer.current);
    try{const result=await accountCoach<{url:string;expires_at:number}>('meal-photo-url',{grant_id:grant.id,meal_id:entry.mealId});
      if(!alive.current)return;
      if(typeof result.url!=='string'||numeric(result.expires_at)===null||result.expires_at<=Date.now()/1000)throw Error('The photo authorization was not confirmed.');
      const blob=await accountCoachPhoto(result.url);if(!alive.current)return;
      if(result.expires_at<=Date.now()/1000)throw Error('The photo authorization expired. Load it again to recheck access.');
      held.current=URL.createObjectURL(blob);setUrl(held.current);
      timer.current=setTimeout(()=>{if(held.current)URL.revokeObjectURL(held.current);held.current='';if(alive.current){setUrl('');setError('Photo authorization expired. Load it again to recheck access.');}},Math.min(2147483647,Math.max(0,result.expires_at*1000-Date.now())));
    }catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}
  };
  return <article className="cc-card"><p>Saved photo · {savedTime(entry.savedAt)}</p>{url&&<img src={url} alt="Authorized saved meal original"/>}<button className="cc-secondary" disabled={busy} onClick={()=>void load()}>{busy?'Checking photo access…':url?'Reload photo':'Load photo'}</button>{error&&<p role="alert">{error}</p>}</article>;
}
function OwnedGrants({identity}:{identity:AccountIdentity}) {
  const [open,setOpen]=useState(false),[items,setItems]=useState<Grant[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const load=async()=>{setBusy(true);setError('');setItems([]);try{const result=await accountCoach<{grants:unknown}>('grants/list',{});if(alive.current)setItems(grants(result.grants,identity,true));}catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}};
  const revoke=async(grant:Grant)=>{if(!confirm(`Revoke sharing with ${label(grant.subjectDisplayName,'Authorized account')}?`))return;setBusy(true);setError('');try{await accountCoach('grants/revoke',{grant_id:grant.id});if(alive.current)await load();}catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}};
  return <section className="cc-card"><button className="cc-text-button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load();}}>Sharing you authorized</button>{open&&<><p>All authorizations for your data. Use Sharing controls above to choose an accepted connection and create a permission.</p>{busy&&<p role="status">Checking your sharing…</p>}{error&&<p role="alert">{error}</p>}{!busy&&!error&&!items.length&&<p>You have not shared data with another account.</p>}{items.map(grant=>{const state=grant.revoked!==null?'Revoked':activeGrant(grant)?'Active':'Expired';return <article key={grant.id} className="cc-grant-card" data-state={state.toLowerCase()}><div className="cc-grant-head"><h4>{label(grant.subjectDisplayName,'Authorized account')}</h4><span className="cc-grant-state">{state}</span></div><p className="cc-grant-scopes">{grant.scopes.map(scope=><span key={scope}>{scopeLabel(scope)}</span>)}</p><p className="cc-sr-only">{grant.scopes.map(scopeLabel).join(' + ')} · Until {new Date(grant.expires*1000).toLocaleString()} · {state}</p><p className="cc-muted cc-small" aria-hidden="true">Until {new Date(grant.expires*1000).toLocaleString()}</p><button className="cc-secondary" disabled={busy||!activeGrant(grant)} onClick={()=>void revoke(grant)}>Revoke sharing</button></article>;})}{error&&<button className="cc-secondary" onClick={()=>void load()} disabled={busy}>Retry sharing list</button>}</>}</section>;
}
