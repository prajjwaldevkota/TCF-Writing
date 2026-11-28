import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'tcf-calibration-'));
try {
  const data = join(directory, 'cases.json');
  const mock = join(directory, 'provider.mjs');
  const task = { id:'test', source:'synthetic test fixture', examiner_rationale:'local-only-marker', gold:'B2',
    task:'task1', requirement:{instruction:'Invite a friend', minWords:60,maxWords:120}, answer:'Bonjour Zoé, viens avec moi !' };
  await writeFile(data, JSON.stringify([task,{...task,id:'other',split:'development',answer:'development-only-marker'}]));
  await writeFile(mock, `
    let call = 0;
    globalThis.fetch = async (_, options) => {
      if (/local-only-marker|development-only-marker/.test(options.body)) throw Error("Leaked reference data");
      call++;
      const text = 'Sample explanation.';
      const assessment = {feedback_language:'fr', tasks:{task1:{
        range:{lower:'B1',upper:'B2'}, best_estimate:call === 2 ? 'B1' : 'B2', feedback:text,
        level_evidence:['Bonjour','viens avec moi'].map(quote=>({quote,domain:'linguistic',explanation:text})),
        task_fulfilment_audit:[{requirement:'Invite',met:true,finding:text}],
        syntactic_and_lexical_inventory:{structures:[],recurrent_errors:[]}, domains:{linguistic:text,pragmatic:text,sociolinguistic:text},
        communication_pass:text,language_pass:text,priorities:[],mistakes:[]}}};
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(assessment)}]}}]});
    };
  `);
  const output = execFileSync(process.execPath,['--import',mock,'scripts/calibrate-writing.mjs',data,'--run','--repeat','3'],{
    encoding:'utf8',env:{...process.env,GEMINI_MODEL:'gemini-4-hydrogen',GEMINI_API_KEY:'fixture'},
  });
  const summary = JSON.parse(output.trim().split('\n').at(-1));
  assert.equal(summary.cases,1);
  assert.equal(summary.attempts,3);
  assert.equal(summary.counts.exact,2);
  assert.equal(summary.counts.withinOneLevel,3);
  assert.equal(summary.counts.bestBelowB2,1);
  assert.equal(summary.comparablePairs,3);
  assert.equal(summary.differentBest,2);
  assert.equal(summary.differentRange,0);
} finally {
  await rm(directory,{recursive:true,force:true});
}
