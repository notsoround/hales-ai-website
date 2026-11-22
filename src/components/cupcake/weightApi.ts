import { libraryRequest } from './library';
import * as dataChanges from './dataChanges';
import type { DashboardEntry, DashboardRange } from './DashboardView';
export type WeightCorrection={operation:'replace'|'exclude';originalLb:number;reportedLb?:number;reason:string;recordedAt:string};
export type WeightRecord={id:string;kind:'measurement';weightLb:number;measuredAt:string;source:string;recordId:string;basis?:'owner_corrected'|'health_connect'|'owner_reported';correction?:WeightCorrection;note?:string;recordedAt?:string;provenance?:{type:'owner-request';reference:string;description:string}};
export type WeightPage={measurements:WeightRecord[];latestMeasurement:WeightRecord|null;excludedMeasurements?:WeightRecord[];excludedTotal?:number;nextCursor:string|null;total:number;coverage:{initialSince:string|null;lastSyncAt:string|null;lastObservedAt:string|null;resetCount:number}};
export type BodyWeightReading={value:number;date:string;source:string;label:string;previous?:{value:number;date:string;change:number}|null};
export type BodyWeightSummary={weight:BodyWeightReading|null;weight_others?:BodyWeightReading[]};
export type HeadlineWeight={
  valueLb:number;
  dateIso:string;
  measuredAtMs:number|null;
  source:'scale'|string;
  label:string;
  isScale:boolean;
  scaleRecord:WeightRecord|null;
  latestScale:WeightRecord|null;
  deltaLb:number|null;
  deltaRef:string|null;
  others:string[];
};
const chicagoDayFmt=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const shortUtcDate=(iso:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(iso+'T12:00:00Z'));

/** Merge latestMeasurement + measurements, dedupe by id, and sort ascending by measuredAt. */
export function normalizeWeightMeasurements(page:WeightPage|null|undefined):WeightRecord[]{
  if(!page)return [];
  const byId=new Map<string,WeightRecord>();
  for(const m of page.measurements||[])if(m?.id&&Number.isFinite(Date.parse(m.measuredAt))&&Number.isFinite(m.weightLb))byId.set(m.id,m);
  if(page.latestMeasurement?.id&&Number.isFinite(Date.parse(page.latestMeasurement.measuredAt))&&Number.isFinite(page.latestMeasurement.weightLb))byId.set(page.latestMeasurement.id,page.latestMeasurement);
  return [...byId.values()].sort((a,b)=>Date.parse(a.measuredAt)-Date.parse(b.measuredAt));
}

/** Single unified headline weight rule shared across TodayDashboard & TodayWeight:
 *  latest dated reading wins; a non-scale assessment/check-in wins on a same-day tie or when newer,
 *  while a strictly newer scale/owner weigh-in always surfaces immediately instead of hiding behind an older assessment. */
export function resolveHeadlineWeight(page:WeightPage|null|undefined,body:BodyWeightSummary|null|undefined):HeadlineWeight|null{
  const scale=normalizeWeightMeasurements(page);
  const latestScale=scale.length?scale[scale.length-1]:null;
  const scaleMs=latestScale?Date.parse(latestScale.measuredAt):null;
  const scaleDay=scaleMs&&Number.isFinite(scaleMs)?chicagoDayFmt(scaleMs):null;
  const hb=body?.weight&&body.weight.source!=='scale'&&Number.isFinite(body.weight.value)?body.weight:null;
  const useBody=!!hb&&(!scaleDay||hb.date>=scaleDay);
  const weekAgo=latestScale&&scale.length>1?[...scale].reverse().find(m=>{const d=Date.parse(latestScale.measuredAt)-Date.parse(m.measuredAt);return d>=6.5*864e5&&d<=10*864e5;}):undefined;
  const fallbackWeekAgo=!weekAgo&&latestScale&&scale.length>1?[...scale].reverse().find(m=>Date.parse(latestScale.measuredAt)-Date.parse(m.measuredAt)>=6.5*864e5):undefined;
  const refScale=weekAgo||fallbackWeekAgo;
  if(useBody&&hb){
    const others=[
      ...(latestScale?[`Scale ${latestScale.weightLb.toFixed(1)} lb (${shortUtcDate(scaleDay!)})`]:[]),
      ...(body?.weight_others||[]).filter(o=>o.source!=='scale'&&o.source!==hb.source).map(o=>`${o.label} ${o.value.toFixed(1)} lb (${shortUtcDate(o.date)})`),
    ];
    return {
      valueLb:hb.value, dateIso:hb.date, measuredAtMs:Date.parse(`${hb.date}T12:00:00Z`),
      source:hb.source, label:hb.label, isScale:false, scaleRecord:null, latestScale,
      deltaLb:hb.previous?hb.previous.change:null, deltaRef:hb.previous?shortUtcDate(hb.previous.date):null, others,
    };
  }
  if(latestScale&&scaleDay){
    const others=[
      ...(hb?[`${hb.label} ${hb.value.toFixed(1)} lb (${shortUtcDate(hb.date)})`]:[]),
      ...(body?.weight_others||[]).filter(o=>o.source!=='scale'&&(!hb||o.source!==hb.source)).map(o=>`${o.label} ${o.value.toFixed(1)} lb (${shortUtcDate(o.date)})`),
    ];
    return {
      valueLb:latestScale.weightLb, dateIso:scaleDay, measuredAtMs:scaleMs,
      source:'scale', label:weightProvenanceLabel(latestScale.basis,latestScale.source),
      isScale:true, scaleRecord:latestScale, latestScale,
      deltaLb:refScale?Math.round((latestScale.weightLb-refScale.weightLb)*10)/10:null,
      deltaRef:refScale?'this week':null, others,
    };
  }
  return null;
}

/** Save an explicit owner-entered weigh-in via weight_add and broadcast to all weight listeners. */
export async function recordQuickWeight(weightLb:number,observedAt=new Date().toISOString()){
  const id=crypto.randomUUID();
  const result=await libraryRequest<{entry?:{id:string};replayed?:boolean}>({
    action:'weight_add',
    requestId:id,
    value:Math.round(weightLb*10)/10,
    unit:'lb',
    observedAt,
    source:{type:'owner-request',reference:`cupcake-web:${id}`,description:'Explicitly entered by the owner in Cupcake’s weigh-in sheet.'},
  });
  dataChanges.notifyDataChanged?.('weight');
  return result;
}
export function centralMidnight(date:string){let ms=Date.parse(date+'T00:00:00Z');for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);ms+=Date.parse(date+'T00:00:00Z')-represented;}return new Date(ms).toISOString();}
export function weightBounds(range:DashboardRange){if(range.preset==='all')return {};const end=new Date(range.end+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);return {start:centralMidnight(range.start),end:centralMidnight(end.toISOString().slice(0,10))};}
export async function loadWeightPage(range?:DashboardRange,cursor?:string){return libraryRequest<WeightPage>({action:'weight_list',limit:200,...(range?weightBounds(range):{}),...(cursor?{cursor}:{})});}
export function weightProvenanceLabel(basis:unknown,source?:unknown){const manual=basis==='owner_reported'||source==='owner-reported-weight';return basis==='owner_corrected'?`Corrected by you · ${manual?'owner-reported':'scale record'}`:manual?'Reported by you':'Scale measurement';}
export function weightEntry(r:WeightRecord):DashboardEntry {
 const excluded=r.correction?.operation==='exclude',corrected=r.basis==='owner_corrected'&&r.correction?.operation==='replace';
 const manual=r.basis==='owner_reported'||r.source==='owner-reported-weight';
 const original=r.correction?.originalLb;
 const body=excluded?`${r.weightLb.toFixed(1)} lb · excluded by you. This original ${manual?'owner-reported weight':'reading'} is preserved but does not affect your weight graph or totals.`:corrected?`${r.weightLb.toFixed(1)} lb · corrected by you. Original ${manual?'owner-reported weight':'scale reading'}: ${typeof original==='number'&&Number.isFinite(original)?original.toFixed(1):'unavailable'} lb. The original measurement time is unchanged.`:manual?`${r.weightLb.toFixed(1)} lb · reported by you. This was entered manually, not synced from Health Connect.`:`${r.weightLb.toFixed(1)} lb · measured`;
 const correctionNote=r.correction?[r.correction.reason?`Reason: ${r.correction.reason}`:'',r.correction.recordedAt?`Correction saved: ${r.correction.recordedAt}`:''].filter(Boolean).join('\n'):'';
 return {id:'weight:'+r.id,type:'activity',date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.measuredAt)),title:excluded?'Excluded weight reading':corrected?'Corrected weigh-in':manual?'Owner-reported weight':'Weight measurement',body:[body,correctionNote,r.note].filter(Boolean).join('\n'),amount:r.weightLb,details:{weightKind:excluded?'excluded':'measurement',weightLb:r.weightLb,measuredAt:r.measuredAt,recordId:r.recordId,source:r.source,weightBasis:r.basis||'health_connect',weightCorrection:r.correction,originalWeightLb:original}};
}
