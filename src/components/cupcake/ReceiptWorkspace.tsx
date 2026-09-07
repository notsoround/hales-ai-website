import { useCallback, useEffect, useState } from 'react';
import { libraryRequest } from './library';

type LineItem={description:string;quantity:number|null;amount:number|null};
type Receipt={id:string;status:'extracting'|'extraction_failed'|'extracted'|'matched';createdAt:string;merchant:string|null;date:string|null;currency:string|null;total:number|null;tax:number|null;tip:number|null;lineItems:LineItem[];matchedTransactionId:string|null;extractionError?:string};
type Candidate={transactionId:string;merchant:string|null;date:string|null;amount:number|null;currency:string|null;pending:boolean;score:number};
type Props={active?:boolean;onWork?:(busy:boolean)=>void};

const money=(amount:number|null,currency:string|null)=>amount==null?'Uncertain':currency?new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amount):`${new Intl.NumberFormat(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount)} · currency uncertain`;

async function imageData(file:File):Promise<{url:string;preview:string}> {
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Choose a JPEG, PNG, or WebP image.');
  const source=URL.createObjectURL(file);
  try{
    const image=new Image(); image.src=source; await image.decode();
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d'); if(!context)throw new Error('This browser could not prepare the image.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    let quality=.86,url=canvas.toDataURL('image/jpeg',quality);
    while(url.length>1_700_000&&quality>.45){quality-=.08;url=canvas.toDataURL('image/jpeg',quality);}
    if(url.length>1_700_000)throw new Error('This image is still too large. Crop the receipt and try again.');
    return {url,preview:URL.createObjectURL(await (await fetch(url)).blob())};
  }finally{URL.revokeObjectURL(source);}
}

export default function ReceiptWorkspace({active=true,onWork}:Props){
  const [receipts,setReceipts]=useState<Receipt[]>([]),[selected,setSelected]=useState<Receipt|null>(null),[candidates,setCandidates]=useState<Candidate[]>([]);
  const [choice,setChoice]=useState(''),[preview,setPreview]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const work=useCallback((value:boolean)=>{setBusy(value);onWork?.(value)},[onWork]);
  const refresh=useCallback(async()=>{try{const data=await libraryRequest<{receipts:Receipt[]}>({action:'receipt_list'});setReceipts(data.receipts||[])}catch(e){setError((e as Error).message)}},[]);
  useEffect(()=>{if(active)void refresh()},[active,refresh]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

  async function choose(file?:File){if(!file||busy)return;work(true);setError('');setCandidates([]);setChoice('');setStatus('Preparing image…');
    try{const ready=await imageData(file);setPreview(old=>{if(old)URL.revokeObjectURL(old);return ready.preview});setStatus('Reading merchant, date, and totals…');
      const data=await libraryRequest<{receipt:Receipt;duplicate:boolean}>({action:'receipt_extract',image:ready.url,filename:file.name});setSelected(data.receipt);setStatus(data.duplicate?'This receipt was already saved.':'Receipt saved privately.');await refresh();
    }catch(e){const message=(e as Error).message;setError(message);setStatus(/Receipt saved as receipt_[a-f0-9]{32}/.test(message)?'The original is saved privately. Retry from Saved receipts below.':'Check Saved receipts below before trying again.');await refresh()}finally{work(false)}}
  async function retry(receipt=selected){if(!receipt||busy)return;work(true);setError('');setStatus('Reading the saved original again…');
    try{const data=await libraryRequest<{receipt:Receipt}>({action:'receipt_retry',receiptId:receipt.id});setSelected(data.receipt);setStatus('Receipt extraction completed.');await refresh()}
    catch(e){setError((e as Error).message);setStatus('The saved original is still private. You can retry later.')}finally{work(false)}}
  async function findMatches(receipt=selected){if(!receipt||busy)return;work(true);setError('');setStatus('Checking a narrow bank transaction window…');setChoice('');
    try{const data=await libraryRequest<{receipt:Receipt;candidates:Candidate[]}>({action:'receipt_match_candidates',receiptId:receipt.id});setCandidates(data.candidates||[]);setStatus(data.candidates?.length?'Review the possible matches below.':'No close transaction matches found.');}
    catch(e){setError((e as Error).message);setStatus('Receipt is saved. You can retry matching.')}finally{work(false)}}
  async function confirm(){if(!selected||!choice||busy)return;work(true);setError('');setStatus('Saving your confirmed match…');
    try{const data=await libraryRequest<{receipt:Receipt}>({action:'receipt_confirm_match',receiptId:selected.id,transactionId:choice});setSelected(data.receipt);setCandidates([]);setChoice('');setStatus('Receipt matched. Bank history was left unchanged.');await refresh();}
    catch(e){setError((e as Error).message)}finally{work(false)}}

  return <section className="cc-studio cc-library-workspace" aria-busy={busy}>
    <span className="cc-eyebrow">Receipts</span><h2>Match a receipt to a purchase</h2>
    <p className="cc-muted">Take a photo or choose one. Cupcake saves the original privately, reads the receipt, then offers close transaction matches for you to confirm.</p>
    {error&&<div className="cc-error" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
    <div className="cc-card cc-import-card">
      <div className="cc-action-row"><label className="cc-primary cc-file">Choose image<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void choose(e.target.files?.[0]);e.currentTarget.value=''}} /></label><label className="cc-secondary cc-file">Take photo<input disabled={busy} type="file" accept="image/*" capture="environment" onChange={e=>{void choose(e.target.files?.[0]);e.currentTarget.value=''}} /></label></div>
      {preview&&<img src={preview} alt="Receipt ready for extraction" style={{display:'block',width:'100%',maxHeight:360,objectFit:'contain',marginTop:16,borderRadius:14,background:'#fff'}}/>}
      {status&&<p className={busy?'cc-thinking':'cc-notice'} role="status" aria-live="polite">{status}</p>}
    </div>
    {selected&&<div className="cc-card">
      <span className="cc-kind">Saved receipt</span><h3>{selected.merchant||'Merchant uncertain'}</h3>
      <p className="cc-muted">{selected.date||'Date uncertain'} · {money(selected.total,selected.currency)}{selected.tax!=null?` · tax ${money(selected.tax,selected.currency)}`:''}{selected.tip!=null?` · tip ${money(selected.tip,selected.currency)}`:''}</p>
      {!!selected.lineItems?.length&&<details><summary>Line items ({selected.lineItems.length})</summary><ul>{selected.lineItems.map((x,i)=><li key={i}>{x.description}{x.quantity!=null&&x.quantity!==1?` × ${x.quantity}`:''}{x.amount!=null?` — ${money(x.amount,selected.currency)}`:''}</li>)}</ul></details>}
      {selected.status==='extraction_failed'?<><p className="cc-notice">The original is saved. Extraction needs another try.</p><button className="cc-primary" disabled={busy} onClick={()=>void retry()}>Retry saved receipt</button></>:selected.matchedTransactionId?<p className="cc-notice">Matched to the transaction you confirmed.</p>:<><button className="cc-primary" disabled={busy||selected.total==null||!selected.date||!selected.currency} onClick={()=>void findMatches()}>Find transaction matches</button>{!selected.currency&&<p className="cc-muted">A known receipt currency is required before matching.</p>}</>}
    </div>}
    {!!candidates.length&&<fieldset className="cc-card" style={{border:'1px solid #ffffff18'}}><legend>Possible transactions</legend>
      {candidates.map(item=><label key={item.transactionId} className="cc-library-item" style={{cursor:item.pending||busy?'not-allowed':'pointer',opacity:item.pending?.6:1}}><span><input disabled={item.pending||busy} type="radio" name="receipt-match" checked={choice===item.transactionId} onChange={()=>setChoice(item.transactionId)} /> <strong>{item.merchant||'Merchant unavailable'}</strong><small>{item.date||'Date unavailable'}{item.pending?' · pending — available after it settles':''} · similarity score {item.score}/100</small></span><span>{money(item.amount,item.currency)}</span></label>)}
      <button className="cc-primary" disabled={!choice||busy} onClick={()=>void confirm()}>Confirm selected match</button>
    </fieldset>}
    <h3>Saved receipts</h3>{!receipts.length?<p className="cc-muted">No receipts saved yet.</p>:receipts.map(receipt=><button disabled={busy} className="cc-library-item" key={receipt.id} onClick={()=>{setSelected(receipt);setCandidates([]);setChoice('');setStatus('')}}><span><strong>{receipt.merchant||'Merchant uncertain'}</strong><small>{receipt.date||new Date(receipt.createdAt).toLocaleDateString()} · {receipt.status==='matched'?'Matched':receipt.status==='extraction_failed'?'Needs extraction retry':'Ready to match'}</small></span><span>{money(receipt.total,receipt.currency)}</span></button>)}
  </section>
}
