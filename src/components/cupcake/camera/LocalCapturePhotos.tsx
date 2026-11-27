import { useEffect, useRef, useState } from 'react';
import { captureStorageScope } from '../personalStorage';
import { labelCapture, LOCAL_PHOTOS_CHANGED, queueAccountMealPhoto } from '../accountMealPhotoHandoff';
import { listReviewPhotos, readReviewFile, removeReviewPhoto, type ReviewPhoto } from './localCaptureReview';

function ReviewItem({ row, scope }: { row:ReviewPhoto; scope:ReturnType<typeof captureStorageScope> }) {
  const [url,setUrl]=useState(''), [error,setError]=useState('');
  const mounted=useRef(true);
  useEffect(()=>{
    mounted.current=true;
    let image='';
    void readReviewFile(row,scope).then(file=>{
      if(mounted.current){image=URL.createObjectURL(file);setUrl(image);}
    }).catch(()=>{if(mounted.current)setError('Could not open the saved photo.');});
    return ()=>{mounted.current=false;if(image)URL.revokeObjectURL(image);};
  },[row,scope]);
  async function fileAs(kind:'meal'|'receipt'){
    try {
      const file=await readReviewFile(row,scope);
      if(!mounted.current)return;
      labelCapture(file,kind,row.id);queueAccountMealPhoto(file);
    } catch {setError('Could not open the saved photo.');}
  }
  return <article>
    {url && <img src={url} alt="Saved photo to review" style={{maxWidth:'9rem',maxHeight:'7rem',objectFit:'contain'}}/>}
    <p>{new Date(row.modified || row.savedAt).toLocaleString()}</p><div className="cc-action-row">
    <button type="button" className="cc-secondary" onClick={()=>void fileAs('meal')}>Estimate and log meal</button>
    <button type="button" className="cc-secondary" onClick={()=>void fileAs('receipt')}>Read as receipt</button>
    <button type="button" className="cc-text-button" onClick={()=>void removeReviewPhoto(row.id,scope).catch(()=>setError('Could not remove the photo.'))}>Remove</button>
    </div>{error&&<p role="alert">{error}</p>}</article>;
}
export function LocalCapturePhotos() {
  const [scope] = useState(captureStorageScope);
  const [rows,setRows]=useState<ReviewPhoto[]>([]),[open,setOpen]=useState(false),[selected,setSelected]=useState('');
  useEffect(()=>{
    let active=true;
    const load=()=>{void listReviewPhotos(scope).then(values=>{if(active)setRows(values.sort((a,b)=>b.savedAt-a.savedAt));}).catch(()=>undefined);};
    load();window.addEventListener(LOCAL_PHOTOS_CHANGED,load);
    return ()=>{active=false;window.removeEventListener(LOCAL_PHOTOS_CHANGED,load);};
  },[scope]);
  if(!rows.length)return null;
  const photo=rows.find(row=>row.id===selected)||rows[0];
  return <details className="cc-card" onToggle={ev=>setOpen(ev.currentTarget.open)}>
    <summary>Photos on this device ({rows.length})</summary>
    {open&&<>{rows.length>1?<label>Photo <select value={photo.id} onChange={ev=>setSelected(ev.target.value)}>{rows.map(row=><option key={row.id} value={row.id}>{row.name} · {new Date(row.savedAt).toLocaleString()}</option>)}</select></label>:<strong>{photo.name}</strong>}
    <ReviewItem key={photo.id} row={photo} scope={scope}/></>}
  </details>;
}
