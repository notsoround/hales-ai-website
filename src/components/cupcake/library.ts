export type Source = { id?: string; documentId?: string; title?: string; text?: string; url?: string; startSeconds?: number | null; sourceApp?: string };
export type Exchange = { role: string; text?: string; content?: string; model?: string; createdAt?: string; sources?: Source[] };
export type Analysis = { id?: string; message?: string; question?: string; reply?: string; model?: string; createdAt?: string; sources?: Source[] };
export type Conversation = {
  id: string; title: string; createdAt: string; updatedAt?: string; status: string; kind?: string; sourceApp?: string;
  error?: string; durationSeconds?: number; progress?: { completed: number; total: number }; phase?: string;
  receivedBytes?: number; totalBytes?: number; expectedBytes?: number; transcript?: string; text?: string; summary?: string;
  analysisModel?: string; summaryModel?: string; transcriptionModel?: string; chatModel?: string; models?: Record<string, string>;
  keyPoints?: string[]; commitments?: { text: string; owner?: string; dueDate?: string; evidence?: string }[];
  chat?: Exchange[]; analyses?: Analysis[]; project?: string; tags?: string[]; url?: string;
};
export type Project = { id: string; name: string; description?: string; status?: string; tags?: string[]; sourceUrl?: string; updatedAt?: string };
export type ImportCandidate = { title: string; text: string; sourceApp: string };
export const accessHeaders = () => ({ 'X-Cupcake-Key': sessionStorage.getItem('cupcake-private-access') || '' });
export async function libraryRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('https://automate.hales.ai/cupcake-library', {
    method: 'POST', headers: { ...accessHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(['ask', 'triage', 'closeout_generate', 'receipt_extract','receipt_retry'].includes(String(body.action)) ? 300000 : 60000), cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.ok === false) throw new Error(response.status === 401 || response.status === 403
    ? 'Your private access expired. Lock and unlock Cupcake to reconnect.'
    : data?.error || 'Cupcake could not complete that request. Your original is unchanged. Try again.');
  return data as T;
}
export function safeFilename(title: string) { return (Array.from(title).filter(c => c.charCodeAt(0) >= 32).join('').replace(/[<>:"/\\|?*]/g, ' ').trim().slice(0, 100) || 'Cupcake conversation'); }
export function saveFile(text: string, filename: string, mime = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function byteLabel(n: number) { return n >= 1000000 ? `${(n / 1000000).toFixed(1)} MB` : `${Math.ceil(n / 1000)} KB`; }
export function uploadLabel(received: number, total: number) {
  return `${byteLabel(Math.min(received, total))} / ${byteLabel(total)} received · ${Math.min(100, Math.floor(received / Math.max(1, total) * 100))}%`;
}
export function sourceText(s: Source) {
  const time = typeof s.startSeconds === 'number' ? ` · ${Math.floor(s.startSeconds / 60)}:${Math.floor(s.startSeconds % 60).toString().padStart(2, '0')}` : '';
  return `${s.title || 'Source conversation'}${time}${s.url ? ` · ${s.url}` : ''}`;
}
export function analysisPacket(a: Analysis) {
  return [`## ${a.message || a.question || 'Analysis'}`, '', a.createdAt ? `Saved: ${a.createdAt}` : '', a.model ? `Model: ${a.model}` : 'Model: not recorded', '', a.reply || '', '', ...(a.sources?.length ? ['### Sources', ...a.sources.map(s => `- ${sourceText(s)}`)] : [])].filter(x => x !== undefined).join('\n');
}
export function conversationPacket(r: Conversation, format: 'markdown' | 'text' = 'markdown') {
  const lines = [
    `# ${r.title}`, '', 'Private Cupcake conversation packet', `Created: ${r.createdAt || 'Not recorded'}`, `Exported: ${new Date().toISOString()}`,
    `Source: ${r.sourceApp || (r.kind === 'recording' || r.transcript ? 'Audio recording' : 'Imported conversation')}`, `Status: ${r.status}`,
    r.project ? `Project: ${r.project}` : '', r.tags?.length ? `Topics: ${r.tags.join(', ')}` : '',
    `Summary model: ${r.analysisModel || r.summaryModel || r.models?.summary || 'Not recorded for this item'}`,
    `Transcription model: ${r.transcriptionModel || r.models?.transcription || 'Not recorded for this item'}`,
    '', '## Summary', '', r.summary || 'No summary saved.', '', ...(r.keyPoints?.length ? ['## Key points', '', ...r.keyPoints.map(x => `- ${x}`), ''] : []),
    '## Commitments to review', '', ...(r.commitments?.length ? r.commitments.flatMap(c => [`- ${c.text}`, `  Owner: ${c.owner || 'Unclear'}; Due: ${c.dueDate || 'Not stated'}`, ...(c.evidence ? [`  Evidence: ${c.evidence}`] : [])]) : ['No explicit commitments saved.']),
    '', '## Questions and answers', '', ...(r.chat?.length ? r.chat.flatMap(m => [
      `### ${m.role === 'user' ? 'You' : 'Cupcake'}${m.createdAt ? ` · ${m.createdAt}` : ''}`, ...(m.role !== 'user' ? [`Model: ${m.model || 'Not recorded for this answer'}`] : []), '', m.text || m.content || '', '', ...(m.sources?.length ? m.sources.map(s => `- Source: ${sourceText(s)}`) : []), '',
    ]) : ['No follow-up exchange saved.']),
    '', ...(r.analyses?.length ? ['## Saved strategic analyses', '', ...r.analyses.map(analysisPacket), ''] : []),
    '## Original transcript / imported text', '', r.transcript || r.text || 'No transcript available.', '',
    'Source text may contain transcription errors. AI analysis is separate from the source and does not authorize actions.',
  ];
  const packet = lines.join('\n');
  return format === 'text' ? packet.replace(/^#{1,3} /gm, '') : packet;
}
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function printDocument(title: string, packet: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px/1.65 system-ui,sans-serif;color:#17131b;max-width:850px;margin:40px auto;padding:0 24px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}button{font:inherit;padding:12px 20px;margin-bottom:24px;background:#17131b;color:white;border:0;border-radius:8px}@media print{body{margin:0;max-width:none;padding:0}button{display:none}pre{font-size:11pt}@page{margin:18mm}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><pre>${escapeHtml(packet)}</pre></body></html>`;
}
export function openPrint(title: string, packet: string) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow a popup for Cupcake, then choose PDF again. You can still download Markdown or text.');
  popup.opener = null; popup.document.open(); popup.document.write(printDocument(title, packet)); popup.document.close();
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (v.type && !['text', 'input_text', 'output_text'].includes(String(v.type))) return '';
    return contentText(v.text || v.parts || v.content || '');
  }
  return '';
}
function messageText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const m = value as Record<string, unknown>; const author = m.author as { role?: string } | undefined;
  const role = String(author?.role || m.role || m.sender || '');
  if (!['user', 'assistant', 'human', 'grok', 'model'].includes(role.toLowerCase())) return '';
  const text = contentText(m.content || m.text || m.message || '');
  return text ? `${['user', 'human'].includes(role.toLowerCase()) ? 'You' : 'Assistant'}:\n${text}` : '';
}
export function parseConversationImport(raw: string, filename: string): ImportCandidate[] {
  if (!filename.toLowerCase().endsWith('.json')) return [{ title: filename.replace(/\.[^.]+$/, ''), text: raw, sourceApp: 'Other' }];
  const data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : Array.isArray(data.conversations) ? data.conversations : [data];
  return items.flatMap((item: Record<string, unknown>, index: number) => {
    let messages: unknown[] = []; let sourceApp = 'Other';
    if (item.mapping && typeof item.mapping === 'object') {
      sourceApp = 'ChatGPT'; const mapping = item.mapping as Record<string, { parent?: string; message?: unknown }>;
      const visited = new Set<string>(); let node = typeof item.current_node === 'string' ? item.current_node : Object.keys(mapping).find(k => !Object.values(mapping).some(n => n.parent === k));
      while (node && mapping[node] && !visited.has(node)) { visited.add(node); messages.unshift(mapping[node].message); node = mapping[node].parent; }
    } else if (Array.isArray(item.chat_messages)) { sourceApp = 'Claude'; messages = item.chat_messages; }
    else if (Array.isArray(item.messages)) messages = item.messages;
    else if (Array.isArray(item.responses)) { sourceApp = 'Grok'; messages = item.responses; }
    const text = messages.map(messageText).filter(Boolean).join('\n\n');
    return text ? [{ title: String(item.title || item.name || `Conversation ${index + 1}`), text, sourceApp }] : [];
  });
}
