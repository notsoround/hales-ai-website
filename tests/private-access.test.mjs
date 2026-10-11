import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const keyName = 'cupcake-private-access';
const fixtureKey = 'synthetic-owner-key';
const source = ts.transpileModule(readFileSync('src/components/cupcake/privateAccess.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function client(localStorage = storage(), sessionStorage = storage()) {
  const context = { exports: {}, window: { localStorage, sessionStorage } };
  vm.runInNewContext(source, context);
  return context.exports;
}

test('accepted sign-in survives a new client runtime without a tab session', () => {
  const local = storage(), first = client(local);
  assert.equal(first.savePrivateAccess(fixtureKey), true);
  assert.equal(client(local).privateAccessHeaders()['X-Cupcake-Key'], fixtureKey);
});
test('legacy tab sign-in is available and migrated when accepted', () => {
  const local = storage(), session = storage();
  session.setItem(keyName, fixtureKey);
  const access = client(local, session);
  assert.equal(access.readPrivateAccess(), fixtureKey);
  assert.equal(local.getItem(keyName), null);
  assert.equal(access.savePrivateAccess(access.readPrivateAccess()), true);
  assert.equal(local.getItem(keyName), fixtureKey);
  assert.equal(session.getItem(keyName), null);
});
test('Lock clears persistent, legacy and in-memory access', () => {
  const local = storage(), session = storage(), access = client(local, session);
  access.savePrivateAccess(fixtureKey);
  session.setItem(keyName, fixtureKey);
  assert.equal(access.clearPrivateAccess(), true);
  assert.equal(access.readPrivateAccess(), '');
  assert.equal(client(local, session).readPrivateAccess(), '');
});
test('unavailable browser storage still permits this open page and Lock', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  const access = client(denied, denied);
  assert.equal(access.readPrivateAccess(), '');
  assert.equal(access.savePrivateAccess(fixtureKey), false);
  assert.equal(access.readPrivateAccess(), fixtureKey);
  assert.equal(access.clearPrivateAccess(), false);
  assert.equal(access.readPrivateAccess(), '');
});
test('blocked local persistence falls back to the current tab and reports no durable save', () => {
  const local = storage(); local.setItem = () => { throw Error('quota'); };
  const session = storage(), access = client(local, session);
  assert.equal(access.savePrivateAccess(fixtureKey), false);
  assert.equal(session.getItem(keyName), fixtureKey);
  assert.equal(client(local, session).readPrivateAccess(), fixtureKey);
});
test('a failed persistent removal is reported rather than promising sign-out', () => {
  const local = storage(), access = client(local);
  access.savePrivateAccess(fixtureKey);
  local.removeItem = () => { throw Error('denied'); };
  assert.equal(access.clearPrivateAccess(), false);
});
