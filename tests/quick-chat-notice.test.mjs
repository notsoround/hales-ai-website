import {test} from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function load(){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/components/cupcake/quickChatRecovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({})});return exports;}
test('names the sources that could not be read',()=>{const {unavailableNotice}=load();
  assert.equal(unavailableNotice({recordsUnavailable:true,unavailableSources:['Plaid posted outflows']}),"Couldn't read Plaid posted outflows for this answer, so it doesn't include that data.");
  assert.equal(unavailableNotice({recordsUnavailable:true,unavailableSources:['Food log','Private library search']}),"Couldn't read Food log and Private library search for this answer, so it doesn't include that data.");});
test('falls back for older answers and stays quiet when nothing was missing',()=>{const {unavailableNotice}=load();
  assert.match(unavailableNotice({recordsUnavailable:true}),/couldn't be read/);assert.equal(unavailableNotice({}),null);assert.equal(unavailableNotice({recordsUnavailable:false,unavailableSources:[]}),null);});
