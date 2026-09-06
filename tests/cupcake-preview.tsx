import React from 'react';
import { createRoot } from 'react-dom/client';
import LibraryWorkspace from '../src/components/cupcake/LibraryWorkspace';
import '../src/components/cupcake/studio.css';
if (!import.meta.env.DEV) throw new Error('Synthetic preview is development only.');
const documents = [
  { id: 'doc_example', title: 'A better way to connect the pieces', createdAt: '2026-09-06T12:00:00Z', status: 'ready', kind: 'conversation', sourceApp: 'Claude', project: 'Cupcake', tags: ['strategy', 'next steps'], summary: 'Compare existing tools before building another one.', text: 'You: Should I make another app?\nAssistant: Start by inventorying what already works.', chat: [], analyses: [] },
  { id: 'doc_recording', title: 'Sunday design conversation', createdAt: '2026-09-06T11:20:00Z', status: 'ready', kind: 'recording', sourceApp: 'Recording', project: 'Cupcake', tags: ['design'], summary: 'A synthetic recording summary for layout testing.', transcript: 'Speaker 1 [00:10]: I will test the design on a phone tomorrow.', commitments: [{ text: 'Test the design on a phone', owner: 'Speaker 1', dueDate: 'tomorrow', evidence: 'I will test the design on a phone tomorrow.' }], chat: [{ role: 'user', text: 'What is the next move?' }, { role: 'assistant', text: 'Test one useful path end to end. Start with the import, ask one strategic question, then export the answer.\n\nThe biggest risk is multiplying interfaces before the shared context works.', model: 'Synthetic strategist', createdAt: '2026-09-06T12:10:00Z' }] },
  { id: 'doc_upload', title: 'A long conversation is safely arriving', createdAt: '2026-09-06T10:00:00Z', status: 'uploading', kind: 'recording', sourceApp: 'Recording', receivedBytes: 100700000, totalBytes: 147600000 },
];
const projects = [{ id: 'p1', name: 'Cupcake', description: 'A private companion that connects recordings, conversations, decisions, and projects.', status: 'active' }];
const answer = { reply: 'Extend the shared library before adding another app.\n\n1. Reuse the existing recording pipeline.\n2. Keep every strategic answer linked to its source.\n3. Test a connector with one project first.\n\nThis is synthetic test output, not an analysis of private data.', model: 'Synthetic strategist', sources: [{ documentId: 'doc_example', title: 'A better way to connect the pieces', text: 'Start by inventorying what already works.' }], analysisId: 'synthetic-analysis' };
window.fetch = async (_url, init) => {
  const b = JSON.parse(String(init?.body || '{}'));
  let data: object = {};
  if (b.action === 'list') data = { documents, projects };
  else if (b.action === 'search') data = { results: [{ id: 'passage', documentId: 'doc_example', title: documents[0].title, text: documents[0].text, sourceApp: 'Claude', project: 'Cupcake' }] };
  else if (b.action === 'fetch') data = { document: documents.find(d => d.id === b.id) };
  else if (b.action === 'ask' || b.action === 'triage') { await new Promise(resolve => setTimeout(resolve, 1800)); data = answer; }
  else if (b.action === 'analysis_list') data = { analyses: [{ ...answer, message: 'Where am I duplicating work?', createdAt: '2026-09-06T12:30:00Z' }] };
  else if (b.action === 'connector_list') data = { connectors: [], url: 'https://automate.hales.ai/cupcake-mcp' };
  else if (b.action === 'import') data = { document: { ...b, id: 'doc_synthetic' }, duplicate: false };
  else if (b.action === 'project_save') data = { project: { ...b, id: 'project_synthetic' } };
  else throw new Error('External networking is disabled in this synthetic preview.');
  return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
createRoot(document.getElementById('root')!).render(<React.StrictMode><div className="cc-app" style={{ fontFamily: 'system-ui, sans-serif' }}><header className="cc-top"><img src="/cupcake-avatar.jpg" alt="" /><div><strong>Cupcake</strong><small>Synthetic layout check · no private data</small></div></header><main className="cc-shell"><section className="cc-studio"><LibraryWorkspace active onOpenRecording={() => {}} onWork={() => {}} /></section></main></div></React.StrictMode>);
