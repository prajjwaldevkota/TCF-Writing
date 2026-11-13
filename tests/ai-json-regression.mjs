import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
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
const dependencies = `import {safeParseGeminiJson} from ${JSON.stringify(parserUrl)};
const {buildEvaluationInstructions,instructionFingerprint,validatePedagogicalAssessment,getActiveEvaluatedTasks} = globalThis.__groqFixture;
`;
let validationCalls = 0;
globalThis.__groqFixture = {
  buildEvaluationInstructions:()=>({systemPrompt:'rubric',userPrompt:'answers',rubricVersion:'test'}),
  instructionFingerprint:async()=> 'same-inputs',
  getActiveEvaluatedTasks:()=>[],
  validatePedagogicalAssessment:raw=>{validationCalls++; if(raw.invalid) throw new Error('Invalid evidence'); return {...raw,feedback_language:'fr'};},
};
const {evaluateTcfSubmissionWithGroq:evaluate} = await import(moduleUrl(dependencies+providerSource));
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
globalThis.localStorage = {getItem:()=>null};
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
  responses([choice(json+json),choice(json)]);
  await evaluate({},'fixture-key');
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.body,calls[1].options.body);
  responses([choice(json,'length'),choice(json)]);
  await evaluate({},'fixture-key');
  assert.equal(calls.length,2);
  responses([choice(json+json),choice(json+json)]);
  await assert.rejects(evaluate({},'fixture-key'), /Plusieurs objets/);
  assert.equal(calls.length,2);
  responses([choice('{"invalid":true}')]);
  await assert.rejects(evaluate({},'fixture-key'), /Invalid evidence/);
  assert.equal(calls.length,1);
  assert.ok(validationCalls > 0);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
  delete globalThis.__groqFixture;
}
console.log('PASS: Groq retains projection, retries malformed/truncated output once, preserves instructions, and does not retry evidence validation.');
