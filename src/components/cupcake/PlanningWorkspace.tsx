import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, ExternalLink, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { libraryRequest, saveFile, safeFilename, type Source } from './library';
import './planning.css';

type Candidate = { id: string; title: string; createdAt: string; kind?: string };
type Closeout = { id?: string; date: string; reply: string; model?: string; sources?: Source[]; coverage?: { selectedSourceIds?: string[]; representedSourceIds?: string[]; inputCharacters?: number; inputLimitCharacters?: number; cautions?: string[] } | string; createdAt?: string; mode?: string };
type DecisionType = 'decision' | 'commitment' | 'question' | 'priority';
type DecisionStatus = 'open' | 'done' | 'dismissed';
type Decision = { id?: string; text: string; type: DecisionType; status: DecisionStatus; sourceIds?: string[]; createdAt?: string; updatedAt?: string };

const MAX_SOURCES = 12;
const decisionTypes: DecisionType[] = ['decision', 'commitment', 'question', 'priority'];

function chicagoDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function asError(error: unknown) { return error instanceof Error ? error.message : 'Cupcake could not complete that request. Try again.'; }
function sourceLabel(source: Source) { return source.title || source.documentId || source.id || 'Source'; }

export default function PlanningWorkspace({ active, onWork }: { active: boolean; onWork?: (busy: boolean) => void }) {
  const [date, setDate] = useState(chicagoDate);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [closeout, setCloseout] = useState<Closeout | null>(null);
  const [savedCloseouts, setSavedCloseouts] = useState<Closeout[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decisionText, setDecisionText] = useState('');
  const [decisionType, setDecisionType] = useState<DecisionType>('decision');
  const [decisionSources, setDecisionSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestGeneration = useRef(0);

  const busy = loading || generating || savingDecision;
  useEffect(() => { onWork?.(busy); }, [busy, onWork]);

  const refresh = useCallback(async (nextDate = date) => {
    const generation = ++requestGeneration.current;
    setLoading(true); setError(''); setNotice(''); setCandidates(null); setSelectedIds([]); setCloseout(null);
    try {
      const [preview, saved, decisionResponse] = await Promise.all([
        libraryRequest<{ candidates: Candidate[]; date: string; note?: string }>({ action: 'closeout_preview', date: nextDate }),
        libraryRequest<{ analyses?: Closeout[]; closeouts?: Closeout[] }>({ action: 'analysis_list', mode: 'closeout' }),
        libraryRequest<{ decisions: Decision[] }>({ action: 'decision_list' }),
      ]);
      if (generation !== requestGeneration.current) return;
      setCandidates(preview.candidates || []);
      setSavedCloseouts((saved.closeouts || saved.analyses || []).filter(item => item.mode === 'closeout'));
      setDecisions(decisionResponse.decisions || []);
    } catch (e) {
      if (generation === requestGeneration.current) setError(asError(e));
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [date]);

  useEffect(() => { if (active) void refresh(); }, [active, refresh]);

  const closeoutSources = closeout?.sources || [];

  function toggleSource(id: string, target: 'closeout' | 'decision') {
    if (busy) return;
    if (target === 'decision') { setDecisionSources(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= MAX_SOURCES ? current : [...current, id]); return; }
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= MAX_SOURCES ? current : [...current, id]);
  }

  async function generateCloseout() {
    if (!selectedIds.length || busy) return;
    setGenerating(true); setError(''); setNotice('');
    try {
      const response = await libraryRequest<{ closeout: Closeout }>({ action: 'closeout_generate', date, documentIds: selectedIds.slice(0, MAX_SOURCES) });
      setCloseout(response.closeout); setNotice('Daily closeout ready. Review it before you act on anything.');
      const saved = await libraryRequest<{ analyses?: Closeout[]; closeouts?: Closeout[] }>({ action: 'analysis_list', mode: 'closeout' });
      setSavedCloseouts((saved.closeouts || saved.analyses || []).filter(item => item.mode === 'closeout'));
    } catch (e) { setError(asError(e)); } finally { setGenerating(false); }
  }

  async function reloadCloseout(id: string) {
    if (busy) return;
    setLoading(true); setError('');
    try { const response = await libraryRequest<{ analysis?: Closeout; closeout?: Closeout }>({ action: 'analysis_get', id, mode: 'closeout' }); setCloseout(response.closeout || response.analysis || null); }
    catch (e) { setError(asError(e)); } finally { setLoading(false); }
  }

  async function saveDecision(status: DecisionStatus = 'open', existing?: Decision) {
    const text = (existing?.text ?? decisionText).trim(); if (!text || busy) return;
    setSavingDecision(true); setError(''); setNotice('');
    try {
      const response = await libraryRequest<{ decision: Decision }>({ action: 'decision_save', id: existing?.id, text, type: existing?.type || decisionType, status, sourceIds: existing?.sourceIds || decisionSources });
      setDecisions(current => existing?.id ? current.map(item => item.id === existing.id ? response.decision : item) : [response.decision, ...current]);
      if (!existing) { setDecisionText(''); setDecisionSources([]); }
      setNotice(status === 'open' ? 'Decision saved for your review.' : `Marked ${status}.`);
    } catch (e) { setError(asError(e)); } finally { setSavingDecision(false); }
  }

  function exportCloseout() {
    if (!closeout) return;
    const sourceLines = closeoutSources.length ? `\n\nSources\n${closeoutSources.map(source => `- ${sourceLabel(source)}${source.url ? `: ${source.url}` : ''}`).join('\n')}` : '';
    const coverage = typeof closeout.coverage === 'string' ? closeout.coverage : closeout.coverage?.cautions?.join('; ');
    saveFile(`# Daily closeout — ${closeout.date}\n\n${closeout.reply}${closeout.model ? `\n\nModel: ${closeout.model}` : ''}${coverage ? `\nCoverage: ${coverage}` : ''}${sourceLines}\n`, safeFilename(`Cupcake closeout ${closeout.date}`) + '.md');
  }

  function changeDate(nextDate: string) {
    requestGeneration.current += 1;
    setDate(nextDate); setCandidates(null); setSelectedIds([]); setDecisionSources([]); setCloseout(null); setError(''); setNotice('');
  }

  return <div className="cc-planning-workspace">
    <div className="cc-heading-row"><div><span className="cc-eyebrow">TODAY REVIEW</span><h2>Close the loop.<br /><em>Choose what carries forward.</em></h2></div><button className="cc-secondary" aria-label="Refresh today review" disabled={busy} onClick={() => void refresh()}><RefreshCw className={loading ? 'cc-spin' : ''} size={18} /></button></div>
    <p className="cc-muted">Select the conversations that belong to this day, review Cupcake&apos;s synthesis, then record decisions yourself.</p>
    {error && <div role="alert" className="cc-error">{error}<button onClick={() => setError('')} aria-label="Dismiss planning error"><X size={16} /></button></div>}
    {notice && <div className="cc-notice" role="status"><Check size={18} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss confirmation"><X size={16} /></button></div>}

    <section className="cc-card cc-planning-card"><div className="cc-heading-row"><div><span className="cc-eyebrow">DAILY CLOSEOUT</span><h3>What happened on</h3></div><label className="cc-date-label"><span className="sr-only">Closeout date</span><input type="date" value={date} disabled={busy} onChange={event => changeDate(event.target.value)} /></label></div>
      <p className="cc-muted cc-small">Candidates are matched by upload/import date. Meeting date is not used here.</p>
      {loading && !candidates ? <p className="cc-thinking"><Loader2 className="cc-spin" size={17} />Finding conversations for this date…</p> : candidates?.length ? <>
        <div className="cc-planning-candidates">{candidates.map(candidate => <label className={`cc-planning-candidate ${selectedIds.includes(candidate.id) ? 'is-selected' : ''}`} key={candidate.id}><input type="checkbox" disabled={busy} checked={selectedIds.includes(candidate.id)} onChange={() => toggleSource(candidate.id, 'closeout')} /><span><strong>{candidate.title}</strong><small>{candidate.kind || 'Conversation'} · {new Date(candidate.createdAt).toLocaleString()}</small></span></label>)}</div>
        <div className="cc-action-row"><span className="cc-muted cc-small">{selectedIds.length}/{MAX_SOURCES} selected</span><button className="cc-primary" disabled={!selectedIds.length || busy} onClick={() => void generateCloseout()}>{generating ? <Loader2 className="cc-spin" size={17} /> : <Sparkles size={17} />}Generate closeout</button></div>
      </> : <p className="cc-muted">No uploaded or imported conversations match this date. Choose another day or add a source first.</p>}
    </section>

    {closeout && <section className="cc-card cc-planning-result"><div className="cc-heading-row"><div><span className="cc-eyebrow">AI SYNTHESIS · REVIEW FIRST</span><h3>{closeout.date} closeout</h3></div><button className="cc-secondary" disabled={busy} onClick={exportCloseout}><Download size={16} />Download</button></div><div className="cc-answer-text">{closeout.reply}</div>{closeoutSources.length > 0 && <div className="cc-planning-sources"><strong>Sources</strong>{closeoutSources.map((source, index) => <a key={`${source.id || source.documentId || index}`} href={source.url || (source.documentId ? `?document=${encodeURIComponent(source.documentId)}` : '#')} target={source.url ? '_blank' : undefined} rel={source.url ? 'noreferrer' : undefined}><ExternalLink size={14} />{sourceLabel(source)}</a>)}</div>}<small className="cc-muted">{closeout.model ? `Model: ${closeout.model}` : ''}{typeof closeout.coverage === 'string' ? ` · ${closeout.coverage}` : closeout.coverage?.cautions?.length ? ` · ${closeout.coverage.cautions.join('; ')}` : ''}</small></section>}

    {savedCloseouts.length > 0 && <section className="cc-card"><div className="cc-heading-row"><h3>Saved closeouts</h3><span className="cc-muted cc-small">Reload a prior synthesis</span></div><div className="cc-planning-saved">{savedCloseouts.map(saved => <button key={saved.id || `${saved.date}-${saved.createdAt}`} disabled={busy} onClick={() => saved.id && void reloadCloseout(saved.id)}><strong>{saved.date}</strong><span>{saved.reply.slice(0, 100)}{saved.reply.length > 100 ? '…' : ''}</span></button>)}</div></section>}

    <section className="cc-card cc-planning-decisions"><span className="cc-eyebrow">REVIEWED DECISIONS</span><h3>What are you carrying forward?</h3><p className="cc-muted">Cupcake will not turn suggestions into commitments. Write and review each item yourself.</p><label className="cc-label">Decision, commitment, question, or priority<textarea disabled={busy} value={decisionText} maxLength={2000} rows={3} onChange={event => setDecisionText(event.target.value)} placeholder="I will… / We decided… / I need to answer…" /></label><div className="cc-action-row"><select disabled={busy} aria-label="Decision type" value={decisionType} onChange={event => setDecisionType(event.target.value as DecisionType)}>{decisionTypes.map(type => <option key={type}>{type}</option>)}</select><button className="cc-primary" disabled={!decisionText.trim() || busy} onClick={() => void saveDecision()}>{savingDecision ? <Loader2 className="cc-spin" size={17} /> : <Check size={17} />}Save decision</button></div>{candidates?.length ? <div className="cc-planning-source-picker"><span className="cc-muted cc-small">Link sources (optional)</span>{candidates.map(candidate => <label key={`decision-${candidate.id}`}><input type="checkbox" disabled={busy} checked={decisionSources.includes(candidate.id)} onChange={() => toggleSource(candidate.id, 'decision')} />{candidate.title}</label>)}</div> : null}
      <div className="cc-planning-decision-list">{decisions.length ? decisions.map(decision => <article key={decision.id || decision.text}><div><span className="cc-kind">{decision.type} · {decision.status}</span><p>{decision.text}</p></div><div className="cc-action-row"><button className="cc-text-button" disabled={busy || decision.status === 'done'} onClick={() => void saveDecision('done', decision)}>Done</button><button className="cc-text-button" disabled={busy || decision.status === 'dismissed'} onClick={() => void saveDecision('dismissed', decision)}>Dismiss</button>{decision.status !== 'open' && <button className="cc-text-button" disabled={busy} onClick={() => void saveDecision('open', decision)}>Reopen</button>}</div></article>) : <p className="cc-muted">No saved decisions yet.</p>}</div>
    </section>
  </div>;
}
