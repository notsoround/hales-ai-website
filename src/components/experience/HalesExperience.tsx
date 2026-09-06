import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDown, AudioLines, Globe2, Workflow, Menu, X } from 'lucide-react';
import { VoiceButton } from '../VoiceButton';
import './experience.css';

const worlds = [
  { name: 'Enterprise', label: '01 / ENTERPRISE SYSTEMS', title: 'Give complexity a clear next step.', text: 'Intake, vendor intelligence, portfolio prioritization, and governed customer review. Built around the way teams actually work.', icon: Workflow },
  { name: 'Field', label: '02 / AI IN THE FIELD', title: 'Meet people where the work happens.', text: 'From fire-safety tools to a WhatsApp-first mentor for mining communities. Useful intelligence, delivered through familiar tools.', icon: Globe2 },
  { name: 'Voice', label: '03 / CONVERSATIONAL AI', title: 'A conversation that goes somewhere.', text: 'Phone and chat agents connected to real workflows, with clear handoffs and people in control.', icon: AudioLines },
];

export function HalesMark() { return <svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M7 7h8v12h14V7h8v30h-8V25H15v12H7V7Z" fill="currentColor"/><path d="m29 19 8-8v8h-8Z" fill="#79eaff"/><circle cx="34" cy="7" r="3" fill="#79eaff"/></svg>; }

export default function HalesExperience({ openChat }: { openChat: () => void }) {
  const [world, setWorld] = useState(0);
  const [menu, setMenu] = useState(false);
  const selected = worlds[world];
  const Icon = selected.icon;
  return <div className="hx">
    <a className="hx-skip" href="#work">Skip to selected work</a>
    <header className="hx-header">
      <a href="/" className="hx-brand" aria-label="Hales AI home"><HalesMark/><span>hales<span className="hx-brand-dot">.</span>ai</span></a>
      <nav aria-label="Main navigation" className={menu ? 'hx-nav is-open' : 'hx-nav'}>
        {[['Work', 'work'], ['In the field', 'field'], ['The studio', 'studio'], ['Play', 'lab']].map(([label,id]) => <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>{label}</a>)}
        <a className="hx-nav-cta" href="/contact-us">Let’s build <ArrowUpRight size={16}/></a>
      </nav>
      <button className="hx-mobile" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button>
    </header>
    <main>
      <section className="hx-hero" aria-labelledby="hero-title">
        <div className="hx-hero-art" aria-hidden="true"/>
        <div className="hx-hero-topline"><span><i/> INDEPENDENT AI STUDIO · TEXAS / THE FIELD</span><span>BUILT BY MATT HALES + TEAM</span></div>
        <div className="hx-hero-copy"><p className="hx-eyebrow">INTELLIGENCE, PUT TO WORK.</p><h1 id="hero-title">Out of the demo.<br/>Into the <em>real world.</em></h1><p className="hx-hero-description">We build AI that answers the phone, connects the dots, and works in the field. From enterprise operations to mining communities.</p><div className="hx-actions"><a href="#work" className="hx-button">Explore the work <ArrowDown size={18}/></a><button onClick={openChat} className="hx-text-button">Ask our AI <ArrowUpRight size={18}/></button></div></div>
        <div className="hx-world-panel"><div className="hx-world-tabs" role="tablist" aria-label="Explore our work">{worlds.map((w,i)=><button key={w.name} id={`world-tab-${i}`} role="tab" aria-selected={world===i} aria-controls="world-panel" onClick={()=>setWorld(i)} onKeyDown={e=>{const next=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(next!==null){e.preventDefault();setWorld(next);document.getElementById(`world-tab-${next}`)?.focus();}}} tabIndex={world===i?0:-1}>{w.name}<span>0{i+1}</span></button>)}</div><div id="world-panel" role="tabpanel" aria-labelledby={`world-tab-${world}`} className="hx-world-content"><Icon size={24}/><p className="hx-eyebrow">{selected.label}</p><h2>{selected.title}</h2><p>{selected.text}</p><a href={world===1?'#field':world===2?'#voice':'#work'}>Follow the signal <ArrowUpRight size={16}/></a></div></div>
        <div className="hx-hero-bottom"><span>LESS THEATER. MORE WORKING SYSTEMS.</span><a href="#work">SCROLL TO EXPLORE <ArrowDown size={15}/></a></div>
      </section>
      <section className="hx-proof-strip" aria-label="Our practice"><span>ENTERPRISE OPERATIONS</span><span>FIELD INTELLIGENCE</span><span>VOICE + WORKFLOWS</span><span>BUILT WITH GUARDRAILS</span></section>
      <section id="work" className="hx-section"><div className="hx-section-heading"><p className="hx-eyebrow">01 / SELECTED WORK</p><h2>Different worlds.<br/><span>The same insistence on useful.</span></h2><p>Real projects. Clear boundaries. A link to the work wherever it can be shared.</p></div>
        <div className="hx-work-grid"><article className="hx-work-card hx-work-feature"><div className="hx-card-label"><span>FIELD OPERATIONS</span><span>01</span></div><div className="hx-work-visual"><Workflow size={74} strokeWidth={1}/><span>CAPTURE → UNDERSTAND → ACT</span></div><h3>TagQuest</h3><p>AI-assisted fire-safety scanning and inspection-date capture. A field tool built for the people doing the work.</p><a href="https://tagquest.pyebarkerfs.com" target="_blank" rel="noreferrer">Visit TagQuest <ArrowUpRight size={18}/></a><small>Pye-Barker Fire & Safety · company sign-in required</small></article>
        <article className="hx-work-card"><div className="hx-card-label"><span>ENTERPRISE AI</span><span>02</span></div><h3>Make the operation<br/>make sense.</h3><p>Selected work in project intake, portfolio prioritization, vendor intelligence, and customer-record review for a national fire-safety operator.</p><ul><li>Governed data, usable interfaces</li><li>Review before consequential changes</li><li>Systems designed for changing backends</li></ul><a href="#studio">Meet the builder <ArrowUpRight size={18}/></a><small>Selected experience · internal systems are private</small></article>
        <article className="hx-work-card"><div className="hx-card-label"><span>COMMUNITY AI</span><span>03</span></div><h3>Dr. Mining<br/>Manhattan.</h3><p>A WhatsApp-first AI mentor for mining communities. Built around a simple idea: useful knowledge should reach the people who need it.</p><a href="#field">See the field story <ArrowUpRight size={18}/></a><small>Global Community Miners Forum</small></article></div>
      </section>
      <section id="voice" className="hx-section hx-voice"><div><p className="hx-eyebrow">02 / HEAR IT FOR YOURSELF</p><h2>Your next interface<br/>could be a <em>conversation.</em></h2><p>Phone agents, web chat, multilingual experiences, and the workflows behind them. Start with a conversation, then connect the useful next step.</p><button className="hx-text-button" onClick={openChat}>Prefer typing? Open chat <ArrowUpRight size={18}/></button></div><div className="hx-voice-console"><span className="hx-eyebrow">HALES AI / VOICE DEMO</span><a href="#lab" className="hx-button">Meet Sentinel <ArrowDown size={18}/></a><p>A character with a voice.<br/>Meet it in the Signal Lab below.</p></div></section>
      <section id="field" className="hx-section hx-field"><div className="hx-section-heading"><p className="hx-eyebrow">03 / FROM THE FIELD</p><h2>Before the AI.<br/><span>There were people.</span></h2><p>Years in artisanal mining communities shaped the work: listen first, understand the constraints, build something people can actually use.</p></div><div className="hx-field-body"><div className="hx-field-story"><span className="hx-field-coordinate">LOLGORIAN, KENYA / A CONTINUING STORY</span><h3>Technology should<br/>cross the last mile.</h3><p>Matt co-founded Farmers of Gold and co-chairs the Global Community Miners Forum. Dr. Mining Manhattan brings that field experience into a familiar interface: WhatsApp.</p><div className="hx-actions"><a href="https://gcmf.site" target="_blank" rel="noreferrer">Explore GCMF <ArrowUpRight size={16}/></a><a href="https://farmersofgold.com" target="_blank" rel="noreferrer">Farmers of Gold <ArrowUpRight size={16}/></a></div></div><div className="hx-media"><p className="hx-eyebrow">WATCH THE COVERAGE</p>{[{outlet:'NTV Kenya',title:'AI meets artisanal mining',date:'JAN 2024',url:'https://www.youtube.com/watch?v=1_8AlX4Flpw'},{outlet:'KBC Channel 1',title:'The Dr. Mining Manhattan story',date:'JAN 2024',url:'https://www.youtube.com/watch?v=2oPZEzFOaHs'},{outlet:'SABC News',title:'A conversation from the field',date:'DEC 2023',url:'https://www.youtube.com/watch?v=_LQUa3jdUhU'},{outlet:'Newzroom Afrika',title:'Mining communities in focus',date:'JAN 2025',url:'https://www.youtube.com/watch?v=Y0L4XTOFuto'}].map(m=><a key={m.outlet} href={m.url} target="_blank" rel="noreferrer"><div><span>{m.outlet} <small>{m.date}</small></span><h4>{m.title}</h4></div><ArrowUpRight size={22}/></a>)}<small>Linked broadcast coverage · descriptions are editorial summaries</small></div></div></section>
      <section id="studio" className="hx-section hx-studio"><div><p className="hx-eyebrow">04 / THE STUDIO</p><h2>Small team.<br/>Deep in the work.</h2></div><div><p className="hx-large-copy">Hales.ai is an independent AI studio founded by Matt Hales. We turn complicated operations into tools people can use.</p><p>Matt is Director of AI at Pye-Barker Fire & Safety, founder of Hales.ai, and a builder with roots in film and mining communities. His work connects enterprise systems, conversational agents, and life outside the boardroom.</p><p>We scope the actual problem, build alongside the people using it, and keep permissions and human handoffs in the design.</p><a href="https://www.linkedin.com/in/matt-hales-06578552/" target="_blank" rel="noreferrer">Meet Matt on LinkedIn <ArrowUpRight size={18}/></a></div></section>
      <SentinelLab/>
      <section className="hx-section hx-contact" id="contact"><p className="hx-eyebrow">YOUR WORLD IS NEXT.</p><h2>Bring us the<br/><em>messy problem.</em></h2><div><p>A missed call. A disconnected workflow. Knowledge nobody can find. Let’s make the next step useful.</p><a className="hx-button" href="mailto:matt@hales.ai">matt@hales.ai <ArrowUpRight size={20}/></a></div></section>
    </main><footer className="hx-footer"><a href="/" className="hx-brand"><HalesMark/><span>hales.ai</span></a><span>INDEPENDENT MINDS. CONNECTED SYSTEMS.</span><div><a href="https://github.com/notsoround" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://x.com/hales_ai" target="_blank" rel="noreferrer">X ↗</a><a href="/cupcake">Cupcake ↗</a><a href="/elite-ops">Elite Ops ↗</a></div><small>© {new Date().getFullYear()} Hales AI · Built in Texas. Connected to the field.</small></footer>
  </div>;
}

function SentinelLab() {
  const iframe = useRef<HTMLIFrameElement>(null);
  const host = useRef<HTMLElement>(null);
  const visible = useRef(false);
  const voice = useRef({ active: false, level: 0 });
  useEffect(() => {
    const post = (value: object) => iframe.current?.contentWindow?.postMessage(value, window.location.origin);
    const observer = new IntersectionObserver(entries => {
      visible.current = entries[0].isIntersecting;
      post({ type: 'hales:visibility', visible: visible.current });
    }, { threshold: 0.05 });
    if (host.current) observer.observe(host.current);
    const audio = (event: Event) => {
      const data = (event as CustomEvent<{ active: boolean; level: number }>).detail;
      if (!data || !Number.isFinite(data.level)) return;
      voice.current = { active: data.active === true, level: Math.max(0, Math.min(1, data.level)) };
      if (visible.current) post({ type: 'hales:voice-state', ...voice.current });
    };
    const ready = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow || event.data?.type !== 'hales:sentinel-ready') return;
      post({ type: 'hales:visibility', visible: visible.current });
      post({ type: 'hales:voice-state', ...voice.current });
    };
    window.addEventListener('hales:voice-level', audio);
    window.addEventListener('message', ready);
    return () => { observer.disconnect(); window.removeEventListener('hales:voice-level', audio); window.removeEventListener('message', ready); };
  }, []);
  return <section ref={host} id="lab" className="hx-sentinel" aria-label="Sentinel interactive signal lab">
    <iframe ref={iframe} src="/lab/sentinel/index.html" title="Sentinel: an interactive mechanical eye. Press Pulse to send a signal." loading="lazy" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"/>
    <div className="hx-sentinel-bar"><div><span className="hx-eyebrow">GIVE THE CHARACTER A VOICE.</span><p>Its eye reacts to the live audio. Starts only when you choose.</p></div><VoiceButton compact/><a href="/lab/sentinel/index.html" target="_blank" rel="noreferrer">Open experiment <ArrowUpRight size={16}/></a></div>
  </section>;
}
