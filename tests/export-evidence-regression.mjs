import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const practiceUrl = url(compile('src/utils/practice.ts'));
const wordsUrl = url(compile('src/utils/wordCount.ts'));
const cleanUrl = url(compile('src/utils/cleanText.ts'));
const excerptsUrl = url(compile('src/utils/evidenceExcerpts.ts'));
const { submissionExport } = await import(url(compile('src/utils/submissionExport.ts')
  .replace(/(['"])\.\/practice\1/, JSON.stringify(practiceUrl))
  .replace(/(['"])\.\/wordCount\1/, JSON.stringify(wordsUrl))
  .replace(/(['"])\.\/cleanText\1/, JSON.stringify(cleanUrl))));
const { evidenceExcerpts } = await import(excerptsUrl);
const answer = 'Bonjour ! Je cherche un colocataire.\n\nMon appartement est près du métro. Le loyer comprend le chauffage et Internet. À bientôt !';
const requirement = {title:'Titre', instruction:'Consigne originale', minWords:60, maxWords:120};
const result = {isPracticeMode:false, year:'2026',month:'Novembre',timeUsedSeconds:120,combination:{combinationNumber:4,tasks:{task1:requirement,task2:{...requirement,instruction:'Deuxième consigne'},task3:{...requirement,document1:'Première source.',document2:'Deuxième source.'}}},answers:{task1:answer,task2:'Réponse deux.',task3:'Réponse trois.'},wordCounts:{task1:999,task2:999,task3:999}};
const full = submissionExport(result);
for (const value of ['Combinaison 4', 'Temps utilisé : 02:00', 'Consigne originale', 'Deuxième consigne', 'Première source.', 'Deuxième source.', answer, 'Réponse deux.', 'Réponse trois.']) assert(full.includes(value), value);
assert(!full.includes('999 mots'), 'Recompute real word counts');
assert.equal(full.match(/--- TÂCHE /g).length, 3);
const guided = submissionExport({...result,isPracticeMode:true,practiceTasks:['task3']});
assert(guided.includes('--- TÂCHE 3'));
assert(!guided.includes('--- TÂCHE 1'));
assert(guided.includes('Première source.') && guided.includes('Deuxième source.'));
assert(!submissionExport(result,'task2').includes('Réponse trois.'));
const excerpts = evidenceExcerpts(answer);
assert(excerpts.length>=2);
for (const excerpt of excerpts) assert(answer.includes(excerpt), 'Evidence spans must be verbatim');
assert.deepEqual(evidenceExcerpts(''), []);
const pedagogicalUrl = url(compile('src/services/pedagogicalAssessment.ts').replace(/(['"])\.\.\/utils\/wordCount\1/,JSON.stringify(wordsUrl)));
const { findOriginalExcerpt,validatePedagogicalAssessment } = await import(pedagogicalUrl);
assert.equal(findOriginalExcerpt('Il a dit « oui ».', 'Il a dit " oui ".'), 'Il a dit « oui ».');
assert.equal(findOriginalExcerpt('lʼappartement', "l'appartement"), 'lʼappartement');
assert.equal(findOriginalExcerpt('je suis aller', 'je suis allé'), null, 'Never turn corrected wording into evidence');
const instructionSource = compile('src/services/evaluationInstructions.ts')
 .replace(/import anchors from [^;]+;/, () => `const anchors = ${JSON.stringify(fs.readFileSync('docs/tcf-task3-anchors.md','utf8'))};`)
 .replace(/(['"])\.\/writingMechanics\1/, () => JSON.stringify(url(compile('src/services/writingMechanics.ts').replace(/(['"])\.\.\/utils\/wordCount\1/,JSON.stringify(wordsUrl)))))
 .replace(/(['"])\.\/evaluationSchema\1/, () => JSON.stringify(url(compile('src/services/evaluationSchema.ts').replace(/(['"])\.\/pedagogicalAssessment\1/,JSON.stringify(pedagogicalUrl)))))
 .replace(/import guide from [^;]+;/, `const guide = ${JSON.stringify(fs.readFileSync('docs/tcf-writing-evaluation-guide.md','utf8'))};`)
 .replace(/(['"])\.\.\/utils\/evidenceExcerpts\1/, JSON.stringify(excerptsUrl))
 .replace(/(['"])\.\/pedagogicalAssessment\1/, JSON.stringify(pedagogicalUrl))
 .replace(/(['"])\.\.\/utils\/wordCount\1/, JSON.stringify(wordsUrl));
const {buildEvaluationInstructions}=await import(url(instructionSource));
const input=JSON.parse(buildEvaluationInstructions(result,['task1'],'fr').userPrompt);
assert.deepEqual(input.tasks[0].evidence_excerpts, excerpts);
assert.equal(input.tasks[0].answer,answer);
const task={range:{lower:'B1',upper:'B2'},feedback:'Bilan.',communication_pass:'Clair.',language_pass:'Simple.',domains:{linguistic:'Texte.',pragmatic:'Texte.',sociolinguistic:'Texte.'},limiting_evidence:[],priorities:[],risks:[],mistakes:[],level_evidence:[{quote:excerpts[0],domain:'linguistic',explanation:'Analyse.'},{quote:excerpts[0],domain:'pragmatic',explanation:'Analyse.'}]};
const checked=validatePedagogicalAssessment({feedback_language:'fr',tasks:{task1:task}},['task1'],result);
assert.equal(checked.tasks.task1.range,null,'One quote repeated across domains is not two excerpts');
console.log('PASS: complete question/answer export, guided task scope, original formatting, real counts, exact evidence input, typography and duplicate-quote rejection.');
const revised = buildEvaluationInstructions({
  ...result, answers: { ...result.answers, task3: 'Un petit jardin public très calme. Merci !' },
  combination: { tasks: { ...result.combination.tasks, task3: { ...requirement,
    document1: 'Un petit jardin public très calme', document2: 'petit jardin public très' } } }
}, ['task3'], 'fr');
const fact = JSON.parse(revised.userPrompt).tasks[0].facts;
assert.equal(fact.word_count, 8);
assert.equal(fact.status, 'UNDER_MINIMUM');
assert.equal(fact.source_overlap.covered_tokens, 6);
assert.equal(fact.source_overlap.total_tokens, 7);
assert.equal(fact.source_overlap.percent, 86);
assert.deepEqual(Object.keys(revised.generationConfig.responseSchema.properties.tasks.properties), ['task3']);
assert.equal(revised.generationConfig.responseSchema.properties.tasks.properties.task3.propertyOrdering.at(-1), 'range');
assert(!buildEvaluationInstructions(result,['task1'],'fr').systemPrompt.includes('Le premier document parle des personnes'));
const missing = buildEvaluationInstructions({...result, combination: {tasks: {task3: {...requirement, instruction:'', document1:'', document2:' '}}}}, ['task3'], 'en');
const missingFacts = JSON.parse(missing.userPrompt).tasks[0].facts;
assert.deepEqual(missingFacts.missing_fields, ['instruction','document1','document2']);
assert.equal(missingFacts.source_overlap, null);
