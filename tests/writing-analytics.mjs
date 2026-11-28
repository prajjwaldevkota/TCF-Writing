import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/utils/writingAnalytics.ts"], bundle: true, format: "esm", write: false });
const { writingAnalytics } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const task = (category, count, extra = {}) => ({
  corrections_checked:true, mistakes: Array.from({length: count}, () => ({category,kind:"error"})), ...extra,
});
function review(day, responses, tasks) {
  return { createdAt: new Date(2026, 0, day).toISOString(), answers: responses, aiEvaluation: { pedagogical: { tasks } } };
}
const words = n => "mot ".repeat(n);
const early = review(1, {task1:words(100), task2:words(100)}, {task1:task("Grammaire",4), task2:task("Vocabulaire",2)});
const late = review(2, {task1:words(50), task2:words(100)}, {task1:task("Structure de phrase",1),task2:task("Grammaire",3,{corrections_incomplete:true})});
const blank = review(3, {task3:""}, {task3:task("Grammaire",2)});
const all = writingAnalytics([early, blank, late], "all");
assert.equal(all.tasks.length,4);
assert.equal(all.recent.words,50);
assert.equal(all.previous.words,200);
assert.equal(all.previous.sessions,1);
assert.equal(all.domains[0].category,"Structure de phrase");
assert.equal(all.domains[0].recentRate,2);
const grammar = all.domains.find(d => d.category === "Grammaire");
assert.equal(grammar.previousRate,2);
assert.equal(grammar.recentRate,0);
assert.equal(writingAnalytics([early,late], "task1").domains.find(d=>d.category==="Grammaire").previousRate,4);
assert.equal(writingAnalytics([late], "all").domains[0].previousRate,null);
assert.equal(writingAnalytics([blank], "all").tasks.length,0);
early.id = "previous";
late.revisionOf = early.id;
early.aiEvaluation.pedagogical.tasks.task1.range = { lower: "A2", upper: "B1" };
late.aiEvaluation.pedagogical.tasks.task1.range = { lower: "B1", upper: "B2" };
const paired = writingAnalytics([early, late], "task1");
assert.equal(paired.latestRewrite.result, late);
assert.equal(paired.original, early);
assert.equal(writingAnalytics([late], "all").latestRewrite, undefined);
console.log("PASS comparable session windows, word-normalised domain rates, incomplete reviews and task filters.");

function corrected(day, category) {
  const example = {category,kind:"error", original_text:"je va", corrected_text:"je vais", explanation:"Accord."};
  return review(day, {task1:"Demain je va au marché."}, {task1:{corrections_checked:true,mistakes:[example,example]}});
}
const one = corrected(1,"Grammaire");
const two = corrected(2,"Grammaire");
assert.equal(writingAnalytics([one],"all").recommendation,undefined);
const focus = writingAnalytics([one,two],"task1").recommendation;
assert.equal(focus.reviewCount,2);
assert.equal(focus.cards.length,1);
assert.equal(writingAnalytics([one,two],"task2").recommendation,undefined);
two.answers.task1 = "Une autre réponse.";
assert.equal(writingAnalytics([one,two],"all").recommendation,undefined);

const mixedEdits = corrected(3,"Grammaire");
mixedEdits.aiEvaluation.pedagogical.tasks.task1.mistakes[0] = {...mixedEdits.aiEvaluation.pedagogical.tasks.task1.mistakes[0],kind:"improvement"};
const current = writingAnalytics([mixedEdits],"all");
assert.equal(current.recent.corrections.length,1);
delete mixedEdits.aiEvaluation.pedagogical.tasks.task1.corrections_checked;
assert.equal(writingAnalytics([mixedEdits],"all").recent.sessions,0);
