import assert from 'node:assert/strict';
import { importCupcakeSource } from './cupcake-source-fixture.mjs';
const { phoneTranscriptForCards, voiceCardsRequest, VOICE_INTRO, wrapMessage, shownMessage, MAX_WRAPPED_INPUT, ACTIONS_MARK, suggestionsFrom } = await importCupcakeSource('assistantActionsModel.ts');
const { LABS } = await importCupcakeSource('labsFlags.ts');

// Synthetic transcript only.
const short = 'You: I had a synthetic turkey sandwich at noon.\nCupcake: Nice, about 500 calories.\nYou: Log that please.';
const request = voiceCardsRequest(short);
assert.ok(request.startsWith(VOICE_INTRO));
assert.ok(request.endsWith(short));
assert.ok(request.length <= MAX_WRAPPED_INPUT);

// Too long: assistant lines are dropped first, the owner's lines are kept.
const long = Array.from({ length: 40 }, (_, i) => `You: synthetic line ${i} ${'x'.repeat(20)}\nCupcake: ${'y'.repeat(60)}`).join('\n');
const clipped = voiceCardsRequest(long);
assert.ok(clipped.length <= MAX_WRAPPED_INPUT);
assert.ok(!clipped.includes('Cupcake: '));
assert.ok(clipped.includes('synthetic line 39'));

// Still too long with only the owner's lines: the oldest go first.
const huge = Array.from({ length: 200 }, (_, i) => `You: synthetic ${i} ${'z'.repeat(30)}`).join('\n');
const tail = voiceCardsRequest(huge);
assert.ok(tail.length <= MAX_WRAPPED_INPUT && tail.includes('synthetic 199') && !tail.includes('synthetic 0 '));
// One enormous line is cut from the front.
assert.ok(voiceCardsRequest('You: ' + 'q'.repeat(5000)).length <= MAX_WRAPPED_INPUT);

// It rides the same suggestion wrapper as typed chat, within the server's 8000-character limit.
const wrapped = wrapMessage(request, { recentMeals: [{ mealId: 'meal_synthetic', what: 'Synthetic oats' }] });
assert.ok(wrapped.startsWith(ACTIONS_MARK) && wrapped.length <= 8000);
assert.equal(shownMessage(wrapped), request);

// Replies parse into the same Save cards.
const reply = 'Found one meal.\n```cupcake-action\n{"type":"log_meal","description":"Synthetic turkey sandwich","when":"2026-01-05T12:00","calories":500}\n```';
const found = suggestionsFrom(reply, Date.parse('2026-01-05T13:00:00'));
assert.equal(found.length, 1); assert.equal(found[0].proposal?.type, 'log_meal');

// Behind Labs, off by default.
assert.ok(LABS.some(l => l.key === 'voice-save-cards'));
// Phone transcripts map to the same form; no caller line means no card.
assert.equal(phoneTranscriptForCards('AI: Hi, synthetic.\nUser: I walked 20 minutes.\nCustomer: And weighed 180 pounds.'),
  'Cupcake: Hi, synthetic.\nYou: I walked 20 minutes.\nYou: And weighed 180 pounds.');
assert.equal(phoneTranscriptForCards('AI: Voicemail greeting only.'), '');
assert.equal(phoneTranscriptForCards(''), '');
console.log('voice-save-cards: ok');
