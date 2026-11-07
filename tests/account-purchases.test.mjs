import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparedPurchases} from '../src/components/cupcake/purchases.ts';

// An account day-only timestamp is a sort key, never an observed purchase time.

test('account purchase markers require explicit currency and observed time', () => {
  const since=Date.parse('2026-11-06T06:00:00Z'),at=since+3600000;
  const base={type:'transaction',title:'Synthetic cafe',amount:14,ts:at,time:'01:00',currency:'USD'};
  assert.deepEqual(preparedPurchases([{...base,currency:null},{...base,time:'',details:{dateOnly:true}}],since,at+1,true),[]);
  assert.equal(preparedPurchases([base],since,at+1,true)[0].currency,'USD');
  assert.equal(preparedPurchases([{...base,currency:null}],since)[0].currency,'USD','legacy behavior is unchanged');
});
