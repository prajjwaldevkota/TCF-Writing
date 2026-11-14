import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createHash } from 'node:crypto';
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const parserUrl = moduleUrl(compile('src/services/aiJson.ts'));
const {safeParseGeminiJson:parse} = await import(parserUrl);
const fixture = {tasks:{task1:{feedback:'Une citation {avec accolades}, et "guillemets".',mistakes:[]}},mock_projection:{lower:6,upper:8}};
const json = JSON.stringify(fixture);
for (const text of [json, '```json\n'+json+'\n```', 'Voici le résultat : '+json+'\nFin.', json+'}', json+'\n}}']) {
  assert.deepEqual(parse(text), fixture);
}
assert.deepEqual(parse('{"text":"l\\\'ami",}'), {text:"l'ami"});
assert.deepEqual(parse('{"text":"un\ndeux"}'), {text:'un\ndeux'});
assert.throws(()=>parse(json+'\n'+json), /Plusieurs objets JSON/);
assert.throws(()=>parse(json+'\n[]'), /Plusieurs objets JSON/);
const oldError = console.error;
console.error = () => {};
try { assert.throws(()=>parse(json.slice(0,-3)), /format JSON/); } finally { console.error = oldError; }
console.log('PASS: nested/quoted braces, fences, trailing text/braces, French escapes, truncated and ambiguous JSON.');

// Exercise the actual Groq provider flow with mocked HTTP, never a real API key.
const providerSource = compile('src/services/groqEvaluator.ts')
  .replace(/^import .*;\n/gm, '')
  .replaceAll('import.meta.env', '({})');
const rateLimitUrl = moduleUrl(compile('src/services/providerRateLimit.ts'));
const dependencies = `import {getRateLimitDeadline,recordRateLimit,rateLimitMessage} from ${JSON.stringify(rateLimitUrl)};
import {safeParseGeminiJson} from ${JSON.stringify(parserUrl)};
const {buildEvaluationInstructions,instructionFingerprint,validatePedagogicalAssessment,getActiveEvaluatedTasks} = globalThis.__groqFixture;
`;
let validationCalls = 0;
globalThis.__groqFixture = {
  buildEvaluationInstructions:()=>({systemPrompt:'rubric',userPrompt:'answers',rubricVersion:'test'}),
  instructionFingerprint:async text=>createHash('sha256').update(text).digest('hex'),
  getActiveEvaluatedTasks:()=>[],
  validatePedagogicalAssessment:raw=>{validationCalls++; if(raw.invalid) throw new Error('Invalid evidence'); return {...raw,feedback_language:'fr'};},
};
const {evaluateTcfSubmissionWithGroq:evaluate} = await import(moduleUrl(dependencies+providerSource));
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const stored = new Map();
globalThis.localStorage = {getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
let calls;
function responses(items) {
  calls = [];
  globalThis.fetch = async (url,options) => {
    calls.push({url,options});
    const next = items.shift();
    assert.ok(next, 'No unexpected retry');
    return new Response(JSON.stringify(next),{status:200});
  };
}
const choice = (content,reason='stop')=>({choices:[{message:{content},finish_reason:reason}]});
try {
  responses([choice(json+'}')]);
  const result = await evaluate({},'fixture-key');
  assert.equal(calls.length,1);
  assert.deepEqual(result.pedagogical.mock_projection,{lower:6,upper:8});
  responses([choice(json+json)]);
  await assert.rejects(evaluate({},'fixture-key'), /Plusieurs objets/);
  assert.equal(calls.length,1);
  responses([choice(json,'length')]);
  await assert.rejects(evaluate({},'fixture-key'), /tronquée/);
  assert.equal(calls.length,1);
  responses([choice('{"invalid":true}')]);
  await assert.rejects(evaluate({},'fixture-key'), /Invalid evidence/);
  assert.equal(calls.length,1);
  responses([choice(json)]);
  const [first,second] = await Promise.all([evaluate({},'fixture-key'),evaluate({},'fixture-key')]);
  assert.equal(calls.length,1);
  assert.equal(first.id,second.id);
  calls = [];
  globalThis.fetch = async url=> {calls.push(url);throw new Error('Timeout after upstream accepted request');};
  await assert.rejects(evaluate({},'fixture-key'), /Timeout/);
  assert.equal(calls.length,1, 'Timeout must not trigger another upstream call');
  calls = [];
  globalThis.fetch = async url=> {calls.push(url);return calls.length===1 ? new Response('',{status:404}) : new Response(JSON.stringify(choice(json)));};
  await evaluate({},'fixture-key');
  assert.equal(calls.length,2, 'Missing local endpoint still supports static hosting');
  calls = [];
  globalThis.fetch = async url=> {calls.push(url);return new Response('{}',{status:429,headers:{'Retry-After':'120'}});};
  await assert.rejects(evaluate({},'fixture-key'), /Quota Groq atteint/);
  assert.equal(calls.length,1);
  await assert.rejects(evaluate({},'fixture-key'), /Quota Groq atteint/);
  assert.equal(calls.length,1, 'Cooldown must block repeat requests');
  assert.equal(stored.size,1);
  assert.ok(![...stored.keys()][0].includes('fixture-key'));
  responses([choice(json)]);
  await evaluate({},'different-fixture-key');
  assert.equal(calls.length,1, 'A different key has independent quota state');
  assert.ok(validationCalls > 0);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
  delete globalThis.__groqFixture;
}
console.log('PASS: Groq preserves projection, single-attempt generation, duplicate suppression, safe static fallback, timeout handling, quota cooldown and separate keys.');

const {retryDeadline} = await import(rateLimitUrl);
const now=Date.parse('2026-11-13T12:00:00Z');
assert.equal(retryDeadline('120',now),now+120000);
assert.equal(retryDeadline('Fri, 13 Nov 2026 12:05:00 GMT',now),now+300000);
assert.equal(retryDeadline(null,now),now+60000);
assert.equal(retryDeadline('invalid',now),now+60000);
assert.equal(retryDeadline('-1',now),now+60000);
console.log('PASS: Retry-After seconds, dates and missing/invalid header fallback.');
