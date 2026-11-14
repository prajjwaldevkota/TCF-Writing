import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url = source => 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile = path => ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const crosscheckUrl=url(compile('src/utils/nclcComparison.ts'));
const gemini={model:'gemini-fixture',prompt_hash:'same',rubric_version:'v5',pedagogical:{feedback_language:'en',mock_projection:{lower:6,upper:8,rationale:'Full mock evidence'}}};
let geminiCalls=0,groqCalls=0;
globalThis.__dualFixture={
  getGeminiApiKey:()=> 'fixture',getGroqApiKey:()=> 'fixture',getActiveEvaluatedTasks:()=>['task1','task2','task3'],
  buildEvaluationInstructions:()=>({systemPrompt:'rubric',userPrompt:'answers',rubricVersion:'v5'}),
  instructionFingerprint:async()=> 'same',
  evaluateTcfSubmissionWithGemini:async()=>{geminiCalls++;return gemini;},
  evaluateTcfSubmissionWithGroq:async()=>{groqCalls++;throw new Error('Quota Groq atteint');},
};
const oldStorage=globalThis.localStorage;
globalThis.localStorage={getItem:()=> 'en'};
const source=compile('src/services/dualEvaluator.ts').replace(/^import .*;\n/gm,'');
const setup=`import {crosscheckedPrimary} from ${JSON.stringify(crosscheckUrl)};
const {getGeminiApiKey,getGroqApiKey,getActiveEvaluatedTasks,buildEvaluationInstructions,instructionFingerprint,evaluateTcfSubmissionWithGemini,evaluateTcfSubmissionWithGroq}=globalThis.__dualFixture;
`;
try {
  const {evaluateDual}=await import(url(setup+source));
  const prior={gemini,groq:null,primary:gemini,groqError:'old error',geminiError:null};
  const review=await evaluateDual({},prior);
  assert.equal(geminiCalls,0,'Do not regenerate a matching successful Gemini review');
  assert.equal(groqCalls,1);
  assert.equal(review.gemini,gemini);
  assert.deepEqual(review.primary.pedagogical.mock_projection,gemini.pedagogical.mock_projection);
  assert.equal(review.primary.nclc_crosscheck.status,'single');
  await evaluateDual({}, {...prior,gemini:{...gemini,prompt_hash:'different'}});
  assert.equal(geminiCalls,1,'Changed inputs require a new review');
  await evaluateDual({}, {...prior,gemini:{...gemini,rubric_version:'older'}});
  assert.equal(geminiCalls,2,'Changed instructions require a new review');
} finally {globalThis.localStorage=oldStorage;delete globalThis.__dualFixture;}
console.log('PASS: retry only missing review, preserve Gemini/NCLC on Groq quota failure, invalidate stale reviews.');

const proxySource=compile('api/groq.ts');
const {default:handler}=await import(url(proxySource));
const oldFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async()=>{calls++;return new Response('{"error":"quota"}',{status:429,headers:{'Retry-After':'3600'}});};
try {
  const response=await handler(new Request('https://fixture/api/groq',{method:'POST',headers:{Authorization:'Bearer fixture'},body:'{}'}));
  assert.equal(response.status,429);
  assert.equal(response.headers.get('Retry-After'),'3600');
  assert.equal(calls,1);
} finally {globalThis.fetch=oldFetch;}
console.log('PASS: proxy preserves rate-limit status and Retry-After without replaying the request.');
