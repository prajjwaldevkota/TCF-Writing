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

const rateLimitUrl = moduleUrl(compile('src/services/providerRateLimit.ts'));
const {retryDeadline} = await import(rateLimitUrl);
const now=Date.parse('2026-11-13T12:00:00Z');
assert.equal(retryDeadline('120',now),now+120000);
assert.equal(retryDeadline('Fri, 13 Nov 2026 12:05:00 GMT',now),now+300000);
assert.equal(retryDeadline(null,now),now+60000);
assert.equal(retryDeadline('invalid',now),now+60000);
assert.equal(retryDeadline('-1',now),now+60000);
console.log('PASS: Retry-After seconds, dates and missing/invalid header fallback.');
