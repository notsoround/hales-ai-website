import {readChatStorage,writeChatStorage} from './quickChatRecovery';
export type PendingReset={id:string;message:string;mode:'tip'|'reset'};
const key='cupcake-reset-pending-v1';
export const selectedResetKey='cupcake-reset-selected-v1';
export const resetDraftKey=(mode:string)=>`cupcake-reset-draft-${mode}`;
export function pendingReset():PendingReset|null{const raw=readChatStorage(key);if(!raw)return null;let value;try{value=JSON.parse(raw);}catch{throw Error('The saved request could not be read. Keep this browser data; do not submit a replacement until you check saved plans.');}if(!value||typeof value.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.id)||!['tip','reset'].includes(value.mode)||typeof value.message!=='string'||!value.message.trim()||value.message.length>2000)throw Error('The saved request is invalid. Check saved plans before starting another.');return value;}
export function savePendingReset(value:PendingReset){if(!writeChatStorage(key,JSON.stringify(value)))throw Error('Browser storage is unavailable. Your request was not sent; keep your draft and try again.');}
export function clearPendingReset(id:string){const saved=pendingReset();if(saved&&saved.id!==id)throw Error('Another saved request needs recovery.');if(!writeChatStorage(key,''))throw Error('The server saved your request, but browser recovery could not be cleared. Reopen the saved plan before retrying.');}
export {readChatStorage,writeChatStorage};
