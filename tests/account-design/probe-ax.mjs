// Chrome's own accessibility tree (what TalkBack reads, in order) for Today, then with the assistant open, then Reports.
// Fails (exit 1) on the reading-order, background-reachability and unnamed-panel bugs fixed in v2026.11.10-9.
// Usage: W=390 ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/probe-ax.mjs
import assert from 'node:assert/strict';
import {signedIn,nav,browser,server} from './lib.mjs';
const v=await signedIn(Number(process.env.W||390),process.env.T||'caribbean'),{p}=v;await p.waitForTimeout(500);
const cdp=await v.c.newCDPSession(p);
const tree=async()=>{const {nodes}=await cdp.send('Accessibility.getFullAXTree');const by=new Map(nodes.map(n=>[n.nodeId,n]));const out=[];
  const walk=id=>{const n=by.get(id);if(!n)return;const r=n.role?.value,nm=n.name?.value;if(!n.ignored&&['heading','region','button','tab','tabpanel','textbox','combobox','checkbox','navigation','dialog'].includes(r))out.push(`${r} "${nm}"${n.properties?.find(x=>x.name==='level')?' L'+n.properties.find(x=>x.name==='level').value.value:''}`);(n.childIds||[]).forEach(walk);};
  walk(nodes[0].nodeId);return out.join('\n');};
const today=await tree();console.log('=== Today\n'+today);
if(Number(process.env.W||390)<900)assert.ok(today.indexOf('Not logged yet')>today.indexOf('Libre CGM'),'Not logged yet is read after the cards above it');
assert.match(today,/heading "Food today" L3/,'Food today is a heading like the other cards');
await nav(p,'Assistant');await p.waitForTimeout(500);const sheet=await tree();console.log('=== Assistant open\n'+sheet);
if(Number(process.env.W||390)<=600){assert.doesNotMatch(sheet,/Good afternoon|Open calendar|Sign out/,'the page behind the phone assistant is not reachable');assert.match(sheet,/navigation "Cupcake"/,'the tab bar stays reachable');}
await nav(p,'Reports');await p.waitForTimeout(600);const reports=await tree();console.log('=== Reports\n'+reports);
assert.doesNotMatch(reports,/tabpanel ""/,'every Reports tab panel is named');
await p.getByRole('tab',{name:/Shared with me/}).focus();await p.keyboard.press('ArrowRight');
assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'My sharing & clients','arrow keys move between Reports tabs');
console.log('PASS: screen-reader order, phone assistant containment, Reports tabs');
await v.c.close();await browser.close();await server.close();
