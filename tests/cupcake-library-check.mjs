import ts from 'typescript';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync('src/components/cupcake/library.ts', 'utf8');
const exports = {};
const scope = { exports, Date, Blob, URL, setTimeout, JSON };
vm.createContext(scope);
vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, scope);
const r = {
  id: 'synthetic', title: 'Synthetic <script>alert(1)</script>', createdAt: '2026-09-06T12:00:00Z', status: 'ready',
  summary: 'Compare the options.', transcript: 'Speaker 1 [00:01]: I will review the design tomorrow.',
  commitments: [{ text: 'Review the design', owner: 'Speaker 1', dueDate: 'tomorrow', evidence: 'I will review the design tomorrow.' }],
  chat: [{ role: 'user', text: 'What should I do?', createdAt: '2026-09-06T12:05:00Z' }, { role: 'assistant', text: 'Test the smallest version.', model: 'synthetic-model', createdAt: '2026-09-06T12:05:10Z' }],
  analyses: [{ message: 'Is this a duplicate?', reply: 'Compare the existing prototype.', model: 'synthetic-strategy', sources: [{ title: 'Prototype', startSeconds: 125 }] }],
};
const packet = exports.conversationPacket(r);
for (const evidence of ['Review the design', 'I will review the design tomorrow.', 'What should I do?', 'Test the smallest version.', 'synthetic-model', '2026-09-06T12:05:10Z', 'synthetic-strategy', 'Prototype · 2:05', r.transcript]) assert.ok(packet.includes(evidence), evidence);
const html = exports.printDocument(r.title, packet);
assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Print / Save as PDF'));
assert.ok(!exports.safeFilename('../wrong\\path\u0000.mp3').includes('/')); assert.ok(!exports.safeFilename('a\u0001b').includes('\u0001'));
assert.equal(exports.uploadLabel(8388608, 16777216), '8.4 MB / 16.8 MB received · 50%');
assert.equal(exports.uploadLabel(200, 100), '1 KB / 1 KB received · 100%');
const chatgpt = [{ title: 'Chosen branch', current_node: 'c', mapping: {
  a: { parent: null, message: { author: { role: 'system' }, content: { parts: ['Do not import system scaffolding'] } } },
  b: { parent: 'a', message: { author: { role: 'user' }, content: { parts: ['The selected question'] } } },
  c: { parent: 'b', message: { author: { role: 'assistant' }, content: { parts: ['The selected answer'] } } },
  d: { parent: 'b', message: { author: { role: 'assistant' }, content: { parts: ['An abandoned branch'] } } },
} }, { title: 'Another conversation', current_node: 'z', mapping: { z: { message: { author: { role: 'user' }, content: { parts: ['Keep separately selectable'] } } } } }];
const choices = exports.parseConversationImport(JSON.stringify(chatgpt), 'conversations.json');
assert.equal(choices.length, 2); assert.ok(choices[0].text.includes('The selected answer')); assert.ok(!choices[0].text.includes('abandoned')); assert.ok(!choices[0].text.includes('scaffolding')); assert.ok(!choices[0].text.includes('separately'));
const claude = exports.parseConversationImport(JSON.stringify([{ name: 'Claude example', chat_messages: [{ sender: 'human', text: 'Question' }, { sender: 'assistant', content: [{ type: 'text', text: 'Answer' }, { type: 'tool_use', text: 'Private tool scaffolding' }] }] }]), 'claude.json');
assert.ok(claude[0].text.includes('Answer')); assert.ok(!claude[0].text.includes('scaffolding'));
assert.equal(exports.parseConversationImport('# My note', 'note.md')[0].text, '# My note');
assert.equal(exports.parseConversationImport('{"unsupported":true}', 'other.json').length, 0);
const source = readFileSync('src/components/cupcake/CupcakeStudio.tsx', 'utf8');
const ast = ts.createSourceFile('studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let ask; function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'ask') ask = n.getText(ast); ts.forEachChild(n, visit); } visit(ast);
async function questionCase(fail = false, close = false) {
  const updates = []; let release;
  let selected = { id: 'test', status: 'ready', chat: [] };
  const wait = new Promise((resolve, reject) => { release = () => fail ? reject(Error('Network failure')) : resolve({ reply: 'Synthetic reply', model: 'test-model', createdAt: '2026-09-06T00:00:00Z' }); });
  const s = { selected, asking: false, setAsking: v => updates.push(['asking', v]), setQuestionError: v => updates.push(['error', v]), request: () => wait, setSelected: fn => { selected = fn(selected); }, AbortSignal, Date };
  vm.createContext(s); vm.runInContext(ts.transpileModule(ask, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, s);
  const pending = s.ask('Synthetic question'); assert.deepEqual(updates[0], ['asking', true]); if (close) selected = null; release(); await pending.catch(() => {});
  assert.deepEqual(updates.at(-1), ['asking', false]);
  if (fail) assert.ok(updates.some(x => x[0] === 'error' && x[1] === 'Network failure'));
  else if (close) assert.equal(selected, null);
  else { assert.equal(selected.chat[1].model, 'test-model'); assert.equal(selected.chat[1].text, 'Synthetic reply'); }
}
await questionCase(); await questionCase(true); await questionCase(false, true);
console.log('PASS: complete source/answer exports; safe printable document; selective JSON imports and branch handling; acknowledged byte progress; visible pending/failure state; closed-dialog race guard; model attribution.');
