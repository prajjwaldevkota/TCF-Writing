import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const storage = await import(url(compile('src/utils/storage.ts')));
const wordCount = url(compile('src/utils/wordCount.ts'));
const pedagogical = await import(url(compile('src/services/pedagogicalAssessment.ts').replace("'../utils/wordCount'", JSON.stringify(wordCount))));
const {countFrenchWords} = await import(wordCount);

const answers = {task1:'Bonjour voici une réponse pour mes amis.',task2:'',task3:''};
const evaluation = (score, date='2026-11-11T00:00:00Z') => ({overall_score:score, created_at:date});
const submission = {id:'same',year:'2026',month:'Janvier',timeUsedSeconds:20,combination:{combinationNumber:1},answers};
assert.equal(storage.mergeSubmissions([{...submission}], [{...submission, aiEvaluation:evaluation(11)}])[0].aiEvaluation.overall_score, 11);
assert.equal(storage.mergeSubmissions([{...submission, aiEvaluation:evaluation(12,'2026-11-12T00:00:00Z')}], [{...submission, aiEvaluation:evaluation(11)}])[0].aiEvaluation.overall_score, 12);
assert.equal(storage.mergeSubmissions([{...submission}], [{...submission, answers:{...answers,task1:'Different answer'}, aiEvaluation:evaluation(11)}])[0].aiEvaluation, undefined);
const long = 'a'.repeat(60);
assert.equal(storage.mergeSubmissions([{...submission, id:'one', answers:{...answers,task1:long+' one'}}], [{...submission,id:'two',answers:{...answers,task1:long+' two'}}]).length, 2);

const task = () => ({level_evidence:[{quote:'Bonjour',domain:'linguistic',explanation:'Evidence.'},{quote:'réponse',domain:'pragmatic',explanation:'Evidence.'}],range:{lower:'B1',upper:'B2'}, withholding_reason:'', communication_pass:'Communicates purpose.',language_pass:'Recurring agreement errors.',domains:{linguistic:'Some agreement errors.',pragmatic:'Clear purpose.',sociolinguistic:'Appropriate tone.'},limiting_evidence:['Errors recur.'],priorities:['Review agreements.'],risks:[],source_checks:null,feedback:'Useful feedback.',mistakes:[]});
const payload = () => ({feedback_language:'en', tasks:{task1:task()}});
const full = {...submission,combination:{tasks:{task1:{instruction:'Invite a friend',minWords:60,maxWords:120},task3:{instruction:'Compare the sources',minWords:120,maxWords:180}}}};
assert.equal(countFrenchWords("l’ami aujourd’hui porte-monnaie"),3);
assert.equal(countFrenchWords('bonjour,monde !'),2);
assert.equal(countFrenchWords('   '),0);
assert.equal(countFrenchWords('un\ndeux\ttrois'),3);
const validated=pedagogical.validatePedagogicalAssessment(payload(),['task1'],full);
assert.deepEqual(validated.tasks.task1.range,{lower:'B1',upper:'B2'});
assert.ok(validated.tasks.task1.risks.some(r=>r.includes('Word count')));
const missing = {feedback_language:'en',tasks:{task3:task()}};
const sourceResult=pedagogical.validatePedagogicalAssessment(missing,['task3'],{...full,answers:{...answers,task3:'Je compare ici les deux points de vue.'}});
assert.equal(sourceResult.tasks.task3.range,null);
assert.match(sourceResult.tasks.task3.withholding_reason,/both documents/);
const blank=pedagogical.validatePedagogicalAssessment(payload(),['task1'],{...full,answers:{...answers,task1:''}});
assert.equal(blank.tasks.task1.range,null);
for(const mutate of [p=>p.overall_score=11,p=>p.tasks.task1.score=11,p=>p.tasks.task1.priorities=Array(6).fill('priority'),p=>p.tasks.task1.range={lower:'C1',upper:'B1'},p=>delete p.tasks.task1.domains,p=>p.tasks.task2=task()]) {
 const p=payload();mutate(p);assert.throws(()=>pedagogical.validatePedagogicalAssessment(p,['task1'],full));
}
assert.throws(()=>pedagogical.validatePedagogicalAssessment({feedback_language:'en',tasks:{task3:task()}},['task3'],{...full,combination:{tasks:{...full.combination.tasks,task3:{...full.combination.tasks.task3,document1:'One',document2:'Two'}}},answers:{...answers,task3:'Bonjour, je compare les points de vue.'}}));
console.log('PASS: persistence, exact-answer deduplication, space-delimited count, task-only ranges, missing-source and blank withholding, numeric-score rejection, priority limit, correction evidence and source-check validation.');
const repeated=(n)=>Array(n).fill('mot').join(' ');
const complete={...full,isPracticeMode:false,answers:{task1:repeated(60),task2:repeated(120),task3:repeated(120)},combination:{tasks:{task1:{instruction:'Message',minWords:60,maxWords:120},task2:{instruction:'Récit',minWords:120,maxWords:150},task3:{instruction:'Compare',document1:'One source',document2:'Another source',minWords:120,maxWords:180}}}};
const all=['task1','task2','task3'];
assert.equal(pedagogical.mockProjectionEligibility(complete,all).eligible,true);
assert.equal(pedagogical.mockProjectionEligibility({...complete,isPracticeMode:true},all).eligible,false);
assert.equal(pedagogical.mockProjectionEligibility({...complete,answers:{...complete.answers,task2:''}},all).eligible,false);
const projectedTask=()=>({...task(),level_evidence:[{quote:'mot mot',domain:'linguistic',explanation:'Evidence.'},{quote:'mot',domain:'pragmatic',explanation:'Evidence.'}]});
const projection=()=>({feedback_language:'en',mock_projection:{lower:6,upper:8,rationale:'Evidence across all three tasks.'},tasks:{task1:projectedTask(),task2:projectedTask(),task3:{...projectedTask(),source_checks:{document1:'One',document2:'Two',comparison:'Compared',reformulation:'Reformulated'}}}});
assert.deepEqual(pedagogical.validatePedagogicalAssessment(projection(),all,complete).mock_projection,{lower:6,upper:8,rationale:'Evidence across all three tasks.'});
assert.equal(pedagogical.validatePedagogicalAssessment(projection(),all,{...complete,isPracticeMode:true}).mock_projection,null);
for(const invalid of [{lower:7,upper:7,rationale:'x'},{lower:8,upper:6,rationale:'x'},{lower:7.5,upper:9,rationale:'x'},{lower:2,upper:8,rationale:'x'},{lower:6,upper:11,rationale:'x'},{lower:6,upper:8,rationale:''}]){const p=projection();p.mock_projection=invalid;assert.throws(()=>pedagogical.validatePedagogicalAssessment(p,all,complete));}
console.log('PASS: full-mock eligibility, isolated/practice/incomplete withholding, bounded NCLC intervals and required rationale.');

for (const modify of [p=>p.tasks.task1.dimension_scores=[{dimension:'grammar_accuracy',score:4}],p=>p.overall_indicative_score=11]) { const p=payload();modify(p);assert.throws(()=>pedagogical.validatePedagogicalAssessment(p,['task1'],full)); }
const missingPrompt=pedagogical.validatePedagogicalAssessment(payload(),['task1'],{...full,combination:{tasks:{...full.combination.tasks,task1:{...full.combination.tasks.task1,instruction:''}}}});assert.equal(missingPrompt.tasks.task1.range,null);
const badModel=payload();badModel.tasks.task1.model_answer='short';const checkedModel=pedagogical.validatePedagogicalAssessment(badModel,['task1'],full);assert.equal(checkedModel.tasks.task1.model_answer,'');assert.ok(checkedModel.tasks.task1.model_answer_warning);
console.log('PASS: quoted level evidence, missing-prompt withholding, rejected weighted points, and example word limits.');

assert.equal(pedagogical.findOriginalExcerpt("dix-neuf heures chez l'ami",'dix‑neuf heures chez l’ami'),"dix-neuf heures chez l'ami");
assert.equal(pedagogical.findOriginalExcerpt('bonjour  mon ami','bonjour mon ami'),'bonjour  mon ami');
assert.equal(pedagogical.findOriginalExcerpt('bonjour mon ami','bonjour votre ami'),null);
console.log('PASS: harmless typography resolves to exact original text; invented wording stays rejected.');

const unverified=payload();unverified.tasks.task1.mistakes=[{category:'Grammaire',original_text:'invented excerpt',corrected_text:'x',explanation:'y'},{category:'Grammaire',original_text:'Bonjour',corrected_text:'Salut',explanation:'Fixture correction.'},null,{original_text:'réponse'}];
const retained=pedagogical.validatePedagogicalAssessment(unverified,['task1'],full);
assert.equal(retained.tasks.task1.mistakes.length,1);assert.equal(retained.tasks.task1.mistakes[0].original_text,'Bonjour');assert.equal(retained.tasks.task1.omitted_corrections,3);assert.equal(retained.tasks.task1.corrections_incomplete,true);assert.ok(retained.tasks.task1.validation_warnings.length);assert.deepEqual(retained.tasks.task1.range,{lower:'B1',upper:'B2'});
const noQuotes=payload();noQuotes.tasks.task1.level_evidence[0].quote='not in response';const withheld=pedagogical.validatePedagogicalAssessment(noQuotes,['task1'],full);assert.equal(withheld.tasks.task1.range,null);assert.equal(withheld.tasks.task1.mistakes.length,0);
const badProjection=projection();badProjection.tasks.task1.level_evidence=[];assert.equal(pedagogical.validatePedagogicalAssessment(badProjection,all,complete).mock_projection,null);
const missingCorrections=payload();missingCorrections.tasks.task1.mistakes=null;assert.equal(pedagogical.validatePedagogicalAssessment(missingCorrections,['task1'],full).tasks.task1.corrections_incomplete,true);
assert.equal(pedagogical.findOriginalExcerpt("j'ai re\u0301pondu",'j’ai répondu'),"j'ai re\u0301pondu");
assert.equal(pedagogical.findOriginalExcerpt('bonjour mon ami','bonjour mon frère'),null);
console.log('PASS: unverified corrections omitted with warnings, verified feedback retained, unsupported levels/NCLC withheld, and Unicode-equivalent excerpts matched.');
