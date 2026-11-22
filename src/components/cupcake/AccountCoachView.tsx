import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountCoach, accountCoachPhoto, type AccountIdentity } from './accountSession';
import './account-coach.css';
import { appConfirm } from './appConfirm';
import { personalAssistantLabel } from './assistantBrand';
import { AccountPilotWorkspace } from './AccountPilotWorkspace';
import type { ChartScrub, OnChartScrub } from './noir/NoirCharts';
import { ClientRoster } from './reports/ClientRoster';
import { DailyBars, ExerciseBars, Figures, GlucosePoints, NutritionBars, ReportGlance, SleepBars, WeightTrend } from './reports/ReportCharts';
import { exerciseDays, foodDays, periodDates, stepDays, summarize } from './reports/reportModel';

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
const rangeText = (period:Period) => {
  const label=(value:string,year:boolean)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',...(year?{year:'numeric'}:{})});
  return `${label(period.start,period.start.slice(0,4)!==period.end.slice(0,4))} – ${label(period.end,true)}`;
};
const day = (value:unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '—';
const savedTime = (value:unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago'})+' CT' : 'Time unavailable';
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const label = (name:unknown,fallback='Authorized owner') => typeof name === 'string' && name.trim() ? name.trim() : fallback;
const scopeLabel = (scope:Scope) => scope === 'clean-report' ? 'Health report' : 'Meal photos';
const until = (expires:number) => new Date(expires*1000).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
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
  const [received,setReceived]=useState<Grant[]>([]),[selected,setSelected]=useState<Grant|null>(null),[lastOpened,setLastOpened]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [days,setDays]=useState<7|30>(7),[end,setEnd]=useState(today);
  const epoch=useRef(0),heading=useRef<HTMLHeadingElement>(null);
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
  // Two clear jobs: reading what others shared with you, and managing what you share.
  const [view,setView]=useState<'received'|'mine'|null>(null);
  const [sharingVersion,setSharingVersion]=useState(0);
  const shown=view??(received.length?'received':'mine');
  const open=(grant:Grant|null)=>{const next=grant&&received.find(item=>item.id===grant.id&&activeGrant(item))||null;setSelected(next);if(next){setLastOpened(next.id);requestAnimationFrame(()=>heading.current?.focus());}};
  const reading=shown==='received'&&selected;
  return <section className="cc-coach" aria-label="Authorized reports">
    {reading?<div className="cc-coach-context cc-rep-head">
      <div className="cc-rep-bar"><button type="button" className="cc-rep-back" onClick={()=>setSelected(null)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>All clients</button>
        <div className="cc-rep-seg" role="group" aria-label="Report period">{([7,30] as const).map(value=><button type="button" key={value} aria-pressed={days===value} onClick={()=>setDays(value)}>{value} days</button>)}</div></div>
      <div className="cc-rep-title"><h2 ref={heading} tabIndex={-1}><span className="cc-sr-only">Report — </span>{label(selected.ownerDisplayName)}</h2>{period&&<span>{rangeText(period)}</span>}</div>
      <div className="cc-rep-range-row"><p className="cc-rep-lens" role="note" aria-label="Whose information is shown">{selected.scopes.map(scopeLabel).join(' · ')} · until {until(selected.expires)} CT</p><label className="cc-rep-through">Through<input type="date" aria-label="Report end date" max={today()} value={end} onChange={event=>setEnd(event.target.value)}/></label></div>
    </div>:<div className="cc-coach-context"><div><span className="cc-eyebrow">{shown==='mine'?'SHARING & CLIENTS':'SHARED REPORTS'}</span>
      <h2 ref={heading} tabIndex={-1}>{shown==='mine'?'Your sharing & clients':'Reports shared with you'}</h2>
      <p>Signed in as {identity.name||identity.email} · Separate from your personal {assistantName}.</p>
    </div><button className="cc-secondary" onClick={onPersonal}>{personalAssistantLabel(assistantName,identity.name||identity.email)}</button></div>}
    <div className="cc-coach-views" role="tablist" hidden={!!reading} aria-label="Reports sections" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'received':event.key==='End'?'mine':shown==='received'?'mine':'received';setView(next);document.getElementById(`cc-reports-tab-${next}`)?.focus();}}><button type="button" role="tab" id="cc-reports-tab-received" aria-controls="cc-reports-panel-received" tabIndex={shown==='received'?0:-1} aria-selected={shown==='received'} onClick={()=>setView('received')}>Shared with me{received.length?` · ${received.length}`:''}</button><button type="button" role="tab" id="cc-reports-tab-mine" aria-controls="cc-reports-panel-mine" tabIndex={shown==='mine'?0:-1} aria-selected={shown==='mine'} onClick={()=>setView('mine')}>My sharing &amp; clients</button></div>
    <div className="cc-coach-view" role="tabpanel" id="cc-reports-panel-mine" aria-labelledby="cc-reports-tab-mine" hidden={shown!=='mine'}><p className="cc-muted">Manage who can view your reports and meal photos, or invite clients.</p><OwnedGrants identity={identity} active={shown==='mine'} version={sharingVersion}/><AccountPilotWorkspace identity={identity} onSharingChanged={()=>{setSharingVersion(v=>v+1);void reload();}}/></div>
    <div className="cc-coach-view" role="tabpanel" id="cc-reports-panel-received" aria-labelledby="cc-reports-tab-received" hidden={shown!=='received'}>
    {!selected&&<>
      <div className="cc-rep-roster-head"><span className="cc-eyebrow">Clients{received.length?` · ${received.length}`:''}</span><button className="cc-text-button cc-rep-quiet" onClick={()=>void reload()} disabled={loading} aria-label="Reload authorizations">Reload</button></div>
      {loading&&<p role="status" className="cc-rep-quiet-line">Checking active authorizations…</p>}{error&&<p role="alert">{error}</p>}
      {!loading&&!error&&!received.length&&<p className="cc-rep-quiet-line">No active reports have been shared with this account. Ask the owner to authorize you first.</p>}
      {received.length>0&&<ClientRoster grants={received} name={grant=>label(grant.ownerDisplayName)} scopeLabel={scope=>scopeLabel(scope as Scope)} onOpen={grant=>open(grant as Grant)} focusId={lastOpened}/>}
    </>}
    {selected&&<>
      {!period?<p role="alert">Choose a valid past or current Chicago date.</p>:<GrantView key={`${selected.id}:${period.start}:${period.end}`} grant={selected} period={period}/>}
      <div className="cc-rep-footnote"><p>Chicago time · Permissions checked per view · Private from your personal {assistantName}.</p><button className="cc-secondary" onClick={onPersonal}>{personalAssistantLabel(assistantName,identity.name||identity.email)}</button></div>
    </>}
    </div>
  </section>;
}
function GrantView({grant,period}:{grant:Grant;period:Period}) {
  return <>
    {grant.scopes.includes('clean-report')?<CleanReport grant={grant} period={period}/>:<p className="cc-rep-quiet-line">Health report not shared. Meal-photo access does not include health numbers.</p>}
    {grant.scopes.includes('meal-photo')?<MealPhotos grant={grant} period={period}/>:<p className="cc-rep-quiet-line">Meal photos not shared. Health report access does not include original images.</p>}
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
  const dates=useMemo(()=>periodDates(period.start,period.end),[period]);
  const insight=useMemo(()=>data?summarize(data.data,dates):null,[data,dates]);
  if(loading)return <p role="status" className="cc-rep-quiet-line">Loading authorized health numbers…</p>;
  if(error)return <div role="alert" className="cc-rep-error"><p>{error} No earlier report is shown.</p><button className="cc-secondary" onClick={()=>setRetry(value=>value+1)}>Retry health report</button></div>;
  if(!data||!insight)return null;
  const d=data.data,c=data.coverage;
  const exerciseMissing=rows(d.exercise?.daily).reduce((sum,row)=>sum+(numeric(row.missingDurationEntries)??0),0);
  const counts=record(d.outcomes?.counts),latestBody=rows(d.bodyMeasurements?.measurements).slice(-1)[0];
  const sections:{key:ReportKey;title:string;node:ReactNode}[]=[
    {key:'weight',title:'Weight',node:<MetricSection title="Weight" data={d.weight} coverage={c.weight} stat={numeric(d.weight?.latestLb)!==null?`${number(d.weight?.latestLb)} lb latest`:undefined} provenance="Scale / Health Connect and explicit owner entries or corrections"
      chart={onScrub=>d.weight&&<WeightTrend onScrub={onScrub} dates={dates} weight={d.weight}/>}><Summary data={d.weight} fields={['firstLb','latestLb','changeLb','samples']} labels={['First lb','Latest lb','Change lb','Readings']}/><NumbersTable data={rows(d.weight?.daily)} fields={['meanLb','minLb','maxLb','samples']} labels={['Mean lb','Min lb','Max lb','Readings']}/></MetricSection>},
    {key:'nutrition',title:'Confirmed nutrition',node:<MetricSection title="Confirmed nutrition" data={d.nutrition} coverage={c.nutrition} stat={d.nutrition?`${foodDays(d.nutrition).length} of ${dates.length} days`:undefined} provenance="Confirmed local food ledger; photos and purchases alone never establish eating"
      chart={onScrub=>d.nutrition&&<NutritionBars onScrub={onScrub} dates={dates} nutrition={d.nutrition}/>} note="Totals include known values only. Missing nutrients and unlogged meals remain gaps; this is not complete intake."><NutritionTable data={rows(d.nutrition?.daily)}/></MetricSection>},
    {key:'steps',title:'Steps',node:<MetricSection title="Steps" data={d.steps} coverage={c.steps} stat={d.steps?`${stepDays(d.steps).length} days with data`:undefined} provenance="Owned local steps ledger"
      chart={onScrub=>d.steps&&<DailyBars onScrub={onScrub} dates={dates} rows={rows(d.steps.daily)} value={row=>numeric(row.count)} unit="steps" label="Daily steps"/>}><NumbersTable data={rows(d.steps?.daily)} fields={['count']} labels={['Steps']}/></MetricSection>},
    {key:'exercise',title:'Exercise',node:<MetricSection title="Exercise" data={d.exercise} coverage={c.exercise} stat={d.exercise?`${exerciseDays(d.exercise).length} active days`:undefined} provenance="Owner-reported exercise estimates; omitted duration stays unknown"
      chart={onScrub=>d.exercise&&<ExerciseBars onScrub={onScrub} dates={dates} exercise={d.exercise}/>} note={exerciseMissing?`${exerciseMissing} ${exerciseMissing===1?'entry has':'entries have'} an unknown duration and ${exerciseMissing===1?'is':'are'} not counted in minutes.`:undefined}><NumbersTable data={rows(d.exercise?.daily)} fields={['entries','minutes','knownDurationEntries','missingDurationEntries','energyKcal']} labels={['Entries','Known min','With duration','Missing duration','Est. kcal']}/></MetricSection>},
    {key:'manualGlucose',title:'Manual glucose',node:<MetricSection title="Manual glucose" data={d.manualGlucose} coverage={c.manualGlucose} stat={d.manualGlucose?`${number(d.manualGlucose.samples)} readings`:undefined} provenance="Owner-reported manual glucose; not sensor readings. Shaded band: 70–140 mg/dL"
      chart={onScrub=>d.manualGlucose&&<GlucosePoints onScrub={onScrub} dates={dates} glucose={d.manualGlucose}/>}><NumbersTable data={rows(d.manualGlucose?.daily)} fields={['meanMgDl','minMgDl','maxMgDl','samples']} labels={['Mean mg/dL','Min mg/dL','Max mg/dL','Readings']}/></MetricSection>},
    {key:'ringconnNight',title:'RingConn nights',node:<MetricSection title="RingConn nights" data={d.ringconnNight} coverage={c.ringconnNight} stat={d.ringconnNight?`${rows(d.ringconnNight.nights).length} nights`:undefined} provenance="RingConn provider estimates; missing metrics stay unknown"
      chart={onScrub=>d.ringconnNight&&<SleepBars onScrub={onScrub} dates={dates} nights={rows(d.ringconnNight.nights)}/>}><NumbersTable data={rows(d.ringconnNight?.nights)} fields={['asleepMinutes','sessionMinutes','averageHeartRateBpm','restingHeartRateBpm','meanSpo2Percent']} labels={['Asleep min','Session min','Avg HR bpm','Resting HR bpm','Mean SpO₂ %']}/></MetricSection>},
    {key:'outcomes',title:'Outcomes',node:<MetricSection title="Outcomes" data={d.outcomes} coverage={c.outcomes} provenance="Explicit owner-reported outcomes only"
      chart={()=>d.outcomes&&<Figures items={[{label:'Wins',value:number(counts.wins)},{label:'Setbacks',value:number(counts.losses)},{label:'Unscored',value:number(counts.unscored)}]}/>}><Summary data={counts} fields={['wins','losses','unscored','total']} labels={['Wins','Setbacks','Unscored','Total']}/><NumbersTable data={rows(d.outcomes?.daily)} fields={['wins','losses','unscored']} labels={['Wins','Setbacks','Unscored']}/></MetricSection>},
    {key:'bodyMeasurements',title:'Body measurements',node:<MetricSection title="Body measurements" data={d.bodyMeasurements} coverage={c.bodyMeasurements} stat={latestBody?`Latest ${day(latestBody.date)}`:undefined} provenance="Owned body check-ins; flagged measurements stay missing"
      chart={()=>latestBody&&<Figures items={([['weight_lb','Weight lb'],['body_fat_pct','Body fat %'],['waist_in','Waist in'],['hips_in','Hips in']] as const).filter(([key])=>numeric(latestBody[key])!==null).map(([key,name])=>({label:name,value:number(latestBody[key])}))}/>}><NumbersTable data={rows(d.bodyMeasurements?.measurements)} fields={['weight_lb','body_fat_pct','neck_in','waist_in','hips_in']} labels={['Weight lb','Body fat %','Neck in','Waist in','Hips in']} source/></MetricSection>},
  ];
  const filled=sections.filter(item=>d[item.key]),empty=sections.filter(item=>!d[item.key]);
  return <section aria-label="Clean health report" className="cc-rep">
    <ReportGlance insight={insight}/>
    <div className="cc-rep-section-head"><h3>Health numbers</h3><p className="cc-coach-provenance">Saved numbers only. Private notes and missing days stay excluded.</p></div>
    <div className="cc-coach-grid cc-rep-grid">
    {filled.map(item=><Fragment key={item.key}>{item.node}</Fragment>)}
    {empty.length>0&&<section className="cc-card cc-coach-empty-group" aria-label="No data this period"><h4>Nothing saved this period</h4>{empty.map(item=><Fragment key={item.key}>{item.node}</Fragment>)}</section>}
  </div></section>;
}
function MetricSection({title,data,coverage,provenance,stat,chart,note,children}:{title:string;data:Row|null;coverage?:Coverage;provenance:string;stat?:string;chart?:(onScrub:OnChartScrub)=>ReactNode;note?:string;children:ReactNode}) {
  const [scrub,setScrub]=useState<ChartScrub|null>(null);
  const source=<p className="cc-coach-provenance">{provenance}</p>;
  const query=<p className="cc-coach-coverage">{coverage?`${coverage.queryComplete===true?'Query covered the requested range':'Query was limited'} · ${number(coverage.rowsRead)} rows checked · ${number(coverage.invalidRows)} invalid rows omitted`:'Query coverage is unavailable.'}</p>;
  const clean=coverage?.queryComplete===true&&coverage.invalidRows===0;
  if (!data) return <details className="cc-card cc-coach-empty cc-coach-empty-row">
    <summary><strong>{title}</strong><span>No entries in this period{coverage?.queryComplete===false?' · Limited query':''}{coverage&&coverage.invalidRows>0?' · Invalid rows omitted':''}</span></summary>
    <p>No local data for this period. This is unknown, not zero.</p>{source}{query}
  </details>;
  return <section className="cc-card cc-rep-card"><header className="cc-rep-card-head"><h4>{title}</h4>{scrub?<span>{scrub.title} · {scrub.value}{scrub.unit && ` ${scrub.unit}`}</span>:stat&&<span>{stat}</span>}</header>
    {chart?.(setScrub)}{note&&<p className="cc-rep-note">{note}</p>}
    {/* A clean, complete query needs no footnote on screen: its source and row counts sit with the numbers. Anything limited or dropped stays visible. */}
    <details className="cc-rep-numbers"><summary>{clean?'Numbers & source':'Numbers'}</summary>{children}{clean&&<div className="cc-rep-foot">{source}{query}</div>}</details>
    {!clean&&<div className="cc-rep-foot">{source}{query}</div>}</section>;
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
  return <section aria-label="Authorized meal photos" className="cc-rep-photos"><h3>Meal photos</h3><p>Saved meal originals shared separately from health numbers.</p>{loading?<p role="status">Loading authorized photo references…</p>:error?<div role="alert"><p>{error} No earlier photos are shown.</p><button className="cc-secondary" onClick={()=>setRetry(value=>value+1)}>Retry meal photos</button></div>:<><p className="cc-muted">{entries.length?`${entries.length} saved`:'No saved photos in this period'}{coverage?.queryComplete===true?' · full range':' · partial range'}</p><div className="cc-coach-photos">{entries.slice(0,limit).map(entry=><MealPhoto key={String(entry.mealId)} grant={grant} entry={entry}/>)}</div>{entries.length>limit&&<button className="cc-secondary" onClick={()=>setLimit(value=>value+12)}>Show more photo references</button>}</>}</section>;
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
function OwnedGrants({identity,active,version}:{identity:AccountIdentity;active:boolean;version:number}) {
  const [open,setOpen]=useState(false),[items,setItems]=useState<Grant[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const alive=useRef(true),req=useRef(0);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const load=useCallback(async()=>{const id=++req.current;setBusy(true);setError('');try{const result=await accountCoach<{grants:unknown}>('grants/list',{});if(alive.current&&id===req.current){setItems(grants(result.grants,identity,true));setLoaded(true);}}catch(reason){if(alive.current&&id===req.current)setError(failure(reason));}finally{if(alive.current&&id===req.current)setBusy(false);}},[identity]);
  useEffect(()=>{if(active)void load();},[active,version,load]);
  const revoke=async(grant:Grant)=>{if(!await appConfirm(`Revoke sharing with ${label(grant.subjectDisplayName,'Authorized account')}?`,{title:'Stop sharing?',yes:'Revoke',danger:true}))return;setBusy(true);setError('');try{await accountCoach('grants/revoke',{grant_id:grant.id});if(alive.current)await load();}catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}};
  const activeItems=items.filter(activeGrant);
  return <section className="cc-card cc-owned-grants">
    <div className="cc-owned-grants-head">
      <div className="cc-owned-grants-title">
        <span className="cc-eyebrow">ACTIVE AUTHORIZATIONS</span>
        <span className={`cc-grant-pill${activeItems.length?' is-active':''}`}>{!loaded&&busy?'Checking…':activeItems.length?`${activeItems.length} active`:'None active'}</span>
      </div>
      <button className="cc-text-button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load();}}>Sharing you authorized</button>
    </div>
    {loaded&&!open&&activeItems.length>0&&<ul className="cc-grant-summary" aria-label="Active sharing summary">{activeItems.map(grant=><li key={grant.id}><strong>{label(grant.subjectDisplayName,'Authorized account')}</strong><span>{grant.scopes.map(scopeLabel).join(' · ')}</span><small>Until {until(grant.expires)} CT</small></li>)}</ul>}
    {loaded&&!open&&!activeItems.length&&!error&&<p className="cc-muted cc-small">Not sharing with anyone right now.</p>}
    {open&&<>{busy&&<p role="status">Checking your sharing…</p>}{error&&<p role="alert">{error}</p>}{!busy&&!error&&!items.length&&<p className="cc-muted cc-small">You have not shared data with another account.</p>}<div className="cc-grant-list">{items.map(grant=>{const state=grant.revoked!==null?'Revoked':activeGrant(grant)?'Active':'Expired';return <article key={grant.id} className="cc-grant-card" data-state={state.toLowerCase()}><div className="cc-grant-head"><h4>{label(grant.subjectDisplayName,'Authorized account')}</h4><span className="cc-grant-state">{state}</span></div><p className="cc-grant-scopes">{grant.scopes.map(scope=><span key={scope}>{scopeLabel(scope)}</span>)}</p><p className="cc-sr-only">{grant.scopes.map(scopeLabel).join(' + ')} · Until {new Date(grant.expires*1000).toLocaleString()} · {state}</p><p className="cc-muted cc-small" aria-hidden="true">Until {until(grant.expires)} CT</p><button className="cc-secondary" disabled={busy||!activeGrant(grant)} onClick={()=>void revoke(grant)}>Revoke sharing</button></article>;})}</div>{error&&<button className="cc-secondary" onClick={()=>void load()} disabled={busy}>Retry sharing list</button>}</>}
  </section>;
}
