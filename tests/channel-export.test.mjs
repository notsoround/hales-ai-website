import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const exportedAt = '2026-09-20T12:00:00.000Z';
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [exportedAt])); }
}
const context = {
  exports: {}, Date: FixtureDate,
  require(name) {
    assert.equal(name, './libraryApproval');
    return { confirmedLibraryRequest() { throw Error('Export must remain offline'); } };
  },
  fetch() { throw Error('Export must remain offline'); },
};
vm.createContext(context);
const source = readFileSync(new URL('../src/components/cupcake/library.ts', import.meta.url), 'utf8');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
const { conversationPacket, printDocument } = context.exports;
const footer = '\n\nSource text may contain transcription errors. AI analysis is separate from the source and does not authorize actions.';
const hash = character => character.repeat(64);
function channel(role = 'owner', channel = 'telegram') {
  return {
    id: 'doc_synthetic', title: 'Synthetic channel message', createdAt: '2026-09-20T11:01:00Z', status: 'ready',
    kind: 'conversation', sourceApp: `Cupcake ${channel} conversation`, text: 'Complete synthetic original.\n  Spaces stay.\n',
    evidenceType: 'committed-session-message', sourceKey: hash('a'), sourceVersion: hash('b'),
    sourceState: 'current', isCurrentSourceVersion: true, supersededByDocumentId: null,
    provenance: {
      eventType: 'openclaw.conversation_message.v1', eventId: `openclaw-conversation:v1:${hash('c')}`,
      ownerId: 'synthetic-owner', sourceSystem: 'openclaw-conversation', sourceObjectId: hash('c'), sourceVersion: hash('b'),
      channel, evidenceType: 'committed-session-message', occurredAt: '2026-09-20T11:00:00Z', recordedAt: '2026-09-20T11:01:00Z',
      citation: `cupcake-source:openclaw-conversation:${hash('c')}`, sessionId: `session:${hash('d')}`,
      attribution: {
        speakerRole: role, identityBasis: role === 'assistant' ? 'assistant-session-record' : 'verified-channel-policy',
        captureBasis: 'openclaw-committed-session', deliveryState: 'not-observed', accountIdHash: hash('e'),
        conversationIdHash: hash('f'), sessionIdHash: hash('d'), entryIdHash: hash('1'), sourceRecordHash: hash('2'), policyId: hash('3'),
      },
    },
  };
}
function metadata(packet, format) {
  const start = packet.indexOf('Exact source metadata (JSON):\n') + 'Exact source metadata (JSON):\n'.length;
  const value = packet.slice(start);
  return JSON.parse(format === 'markdown' ? value.slice('```json\n'.length, value.indexOf('\n```')) : value.slice(0, value.indexOf('\n\n')));
}
function original(packet, format) {
  const marker = `${format === 'markdown' ? '## ' : ''}Original transcript / imported text\n\n`;
  return packet.slice(packet.indexOf(marker) + marker.length, -footer.length);
}

for (const [role, label, transport] of [['owner', 'Matt (owner)', 'telegram'], ['trusted-coach', 'Robyn (trusted coach)', 'whatsapp'], ['assistant', 'Cupcake (AI assistant)', 'telegram']]) {
  for (const format of ['markdown', 'text']) test(`${format} exports exact ${role} source provenance and original`, () => {
    const record = channel(role, transport), before = structuredClone(record);
    const packet = conversationPacket(record, format), saved = metadata(packet, format);
    assert.deepEqual(saved.provenance, record.provenance);
    for (const key of ['sourceKey', 'sourceVersion', 'evidenceType', 'sourceState', 'isCurrentSourceVersion', 'supersededByDocumentId']) assert.deepEqual(saved[key], record[key]);
    assert.equal(saved.documentId, record.id);
    assert.ok(packet.includes(`Speaker: ${label}`));
    assert.ok(packet.includes(`Channel: ${transport}`));
    assert.match(packet, /Delivery state: not-observed/);
    assert.match(packet, /not a complete chat or provider edit\/delete archive; recipient delivery is not proven/);
    assert.equal(original(packet, format), record.text);
    assert.deepEqual(record, before, 'Export may not mutate the source');
  });
}
test('long Unicode text, original headings, code fences and CRLF survive both exports', () => {
  const record = channel('assistant');
  record.text = '# Original heading\r\n## Nested heading\n### Literal heading\n```json\n{"value":"<tag> & 🧁"}\n```\n' + '🧁 café 漢字\t'.repeat(7000) + '\n  FINAL SOURCE LINE  \n';
  record.transcript = 'A stale derived transcript must not replace channel source text.';
  for (const format of ['markdown', 'text']) {
    const packet = conversationPacket(record, format);
    assert.equal(original(packet, format), record.text);
    assert.equal(Buffer.from(original(packet, format)).compare(Buffer.from(record.text)), 0);
    assert.doesNotMatch(packet, /A stale derived transcript/);
  }
  const printable = printDocument(record.title, conversationPacket(record));
  assert.ok(printable.includes('&lt;tag&gt; &amp; 🧁'));
  assert.ok(printable.includes('FINAL SOURCE LINE'));
});
test('superseded revision exports its exact lineage and does not relabel it current', () => {
  const record = channel('trusted-coach', 'whatsapp');
  Object.assign(record, { sourceState: 'superseded', isCurrentSourceVersion: false, supersedesVersion: hash('4'), supersedesDocumentId: 'doc_original', supersededByDocumentId: 'doc_newer' });
  record.provenance.eventId += `:revision:${record.sourceVersion}`;
  const saved = metadata(conversationPacket(record), 'markdown');
  for (const key of ['sourceState', 'isCurrentSourceVersion', 'supersedesVersion', 'supersedesDocumentId', 'supersededByDocumentId']) assert.deepEqual(saved[key], record[key]);
  assert.deepEqual(saved.provenance, record.provenance);
  assert.match(conversationPacket(record), /Source state at export: superseded/);
});
test('incomplete channel metadata stays explicit and is not inferred from a list-row role', () => {
  const record = channel();
  record.provenance = { sourceSystem: 'openclaw-conversation' };
  delete record.sourceVersion; delete record.sourceState;
  record.speakerRole = 'owner';
  const packet = conversationPacket(record);
  assert.match(packet, /Speaker: Not recorded/);
  assert.match(packet, /Source version: Not recorded/);
  assert.match(packet, /Delivery state: Not recorded/);
  assert.deepEqual(metadata(packet, 'markdown').provenance, record.provenance);
});

const legacy = {
  id: 'legacy', title: 'Saved recording', createdAt: '2026-09-19T12:00:00Z', status: 'ready', kind: 'recording',
  project: 'Test project', tags: ['one', 'two'], summary: 'Saved summary', analysisModel: 'summary-fixture', transcriptionModel: 'transcript-fixture',
  keyPoints: ['Point one'], commitments: [{ text: 'Review the draft', owner: 'You', dueDate: 'Tomorrow', evidence: 'A recorded commitment' }],
  chat: [{ role: 'user', text: 'Question?' }, { role: 'assistant', content: 'Answer.', model: 'answer-fixture', sources: [{ title: 'Source', startSeconds: 63, url: 'https://example.invalid/source' }] }],
  analyses: [{ question: 'Strategy', reply: 'Saved analysis.', model: 'strategy-fixture' }], transcript: '# Original recording\nAll original words.', text: 'Other text',
};
const legacyGolden = `# Saved recording

Private Cupcake conversation packet
Created: 2026-09-19T12:00:00Z
Exported: ${exportedAt}
Source: Audio recording
Status: ready
Project: Test project
Topics: one, two
Summary model: summary-fixture
Transcription model: transcript-fixture

## Summary

Saved summary

## Key points

- Point one

## Commitments to review

- Review the draft
  Owner: You; Due: Tomorrow
  Evidence: A recorded commitment

## Questions and answers

### You

Question?


### Cupcake
Model: answer-fixture

Answer.

- Source: Source · 1:03 · https://example.invalid/source


## Saved strategic analyses

## Strategy


Model: strategy-fixture

Saved analysis.


## Original transcript / imported text

# Original recording
All original words.${footer}`;
test('recording and imported-conversation exports retain the complete pre-change format', () => {
  assert.equal(conversationPacket(legacy), legacyGolden);
  assert.equal(conversationPacket(legacy, 'text'), legacyGolden.replace(/^#{1,3} /gm, ''));
  const imported = { ...legacy, kind: 'conversation', sourceApp: 'Claude', transcript: '', text: 'Full import.', provenance: { sourceSystem: 'synthetic-other' } };
  assert.equal(conversationPacket(imported), legacyGolden.replace('Source: Audio recording', 'Source: Claude').replace('# Original recording\nAll original words.', 'Full import.'));
  assert.doesNotMatch(conversationPacket(imported), /Exact source metadata/);
});
