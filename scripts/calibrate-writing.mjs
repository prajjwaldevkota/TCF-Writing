// Score held-out, independently labelled scripts using the application's actual rubric.
import { readFile } from 'node:fs/promises';
import { build } from 'vite';

const [file, mode, ...options] = process.argv.slice(2);
const repeat = options.length ? Number(options[1]) : 1;
if (options.length && (options.length !== 2 || options[0] !== '--repeat' || !Number.isSafeInteger(repeat) || repeat < 1)) {
  throw new Error('Expected --repeat followed by a positive integer.');
}
if (!file || !['--check', '--run'].includes(mode)) {
  throw new Error('Usage: node scripts/calibrate-writing.mjs cases.json --check|--run [--repeat 3]');
}
const cases = JSON.parse(await readFile(file, 'utf8'));
// Bundle the same raw Markdown imports that Vite resolves in the simulator.
const bundle = await build({
  configFile: false, logLevel: 'silent',
  plugins: [{
    name: 'calibration-entry',
    resolveId(id) { if (id === 'calibration-entry' || id.endsWith('/calibration-entry')) return '\0calibration-entry'; },
    load(id) {
      if (id === '\0calibration-entry') return [
        '/src/services/evaluationInstructions.ts', '/src/services/pedagogicalAssessment.ts',
        '/src/services/aiJson.ts', '/server/geminiRequest.ts', '/src/utils/geminiSettings.ts',
      ].map(path => `export * from "${path}";`).join('\n');
    },
  }],
  build: { write: false, minify: false, lib: { entry: 'calibration-entry', formats: ['es'], fileName: 'calibration' } },
});
const code = bundle[0].output.find(chunk => chunk.type === 'chunk' && chunk.isEntry).code;
const { buildEvaluationInstructions, validatePedagogicalAssessment, safeParseGeminiJson,
  prepareGeminiRequest, getGeminiModel, LEVELS, RUBRIC_VERSION } = await import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

if (!Array.isArray(cases) || !cases.length) throw new Error('Supply at least one labelled case.');
const ids = new Set();
const splitByAnswer = new Map();
for (const c of cases) {
  if (!c.id || ids.has(c.id) || !c.source || !c.examiner_rationale ||
    !LEVELS.includes(c.gold) || !['task1','task2','task3'].includes(c.task) ||
    !c.requirement?.instruction || !Number.isInteger(c.requirement.minWords) ||
    !Number.isInteger(c.requirement.maxWords) || c.requirement.minWords < 1 ||
    c.requirement.maxWords < c.requirement.minWords || typeof c.answer !== 'string' ||
    (c.task === 'task3' && (!c.requirement.document1 || !c.requirement.document2))) {
    throw new Error(`Incomplete or duplicate labelled case: ${c.id}`);
  }
  const split = c.split ?? 'held-out'; // Older files were explicitly held-out-only.
  const identity = c.answer.trim().normalize('NFC').replace(/\s+/g, ' ');
  if (!['development','held-out'].includes(split) || !identity ||
      (splitByAnswer.has(identity) && splitByAnswer.get(identity) !== split)) throw new Error('Invalid split or answer shared across splits.');
  splitByAnswer.set(identity, split);
  ids.add(c.id);
}
if (mode === '--check') {
  console.log(`Validated ${cases.length} case records for ${RUBRIC_VERSION}.`);
  process.exit(0);
}
const key = process.env.GEMINI_API_KEY || process.env.GEMINI_BACKUP_API_KEY;
if (!key) throw new Error('Set GEMINI_API_KEY for --run.');
const heldOut = cases.filter(c => c.split !== 'development');
if (!heldOut.length) throw new Error('No held-out cases.');
const counts = { exact: 0, withinOneLevel: 0, bestAboveB1: 0, bestBelowB2: 0, rated: 0, covered: 0, over: 0, under: 0, withheld: 0, failed: 0, b1EntirelyAbove: 0, b2EntirelyBelow: 0, crossesB2: 0 };
let comparablePairs = 0;
let differentBest = 0;
let differentRange = 0;
for (const c of heldOut) {
  const estimates = [];
  const keys = [c.task];
  const model = process.env.GEMINI_MODEL || getGeminiModel(keys);
  const result = { isPracticeMode: true, answers: { [c.task]: c.answer }, combination: { tasks: { [c.task]: c.requirement } } };
  const { systemPrompt, userPrompt, generationConfig } = buildEvaluationInstructions(result, keys, 'fr');
  // Reference labels and examiner rationales stay outside the provider request.
  const body = prepareGeminiRequest(model, { systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }], generationConfig });
  for (let run = 1; run <= repeat; run++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const candidate = (await response.json()).candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete generation');
      const parsed = safeParseGeminiJson(candidate.content.parts.filter(p => !p.thought).map(p => p.text).join(''));
      const { range, best_estimate } = validatePedagogicalAssessment(parsed, keys, result, true, model).tasks[c.task];
      const gold = LEVELS.indexOf(c.gold);
      const outcome = !range ? 'withheld' : LEVELS.indexOf(range.lower) > gold ? 'over' : LEVELS.indexOf(range.upper) < gold ? 'under' : 'covered';
      counts[outcome]++;
      if (range) {
        const best = LEVELS.indexOf(best_estimate);
        counts.rated++;
        if (best === gold) counts.exact++;
        if (Math.abs(best - gold) <= 1) counts.withinOneLevel++;
        if (c.gold === 'B1' && best > gold) counts.bestAboveB1++;
        if (c.gold === 'B2' && best < gold) counts.bestBelowB2++;
        for (const prior of estimates) {
          comparablePairs++;
          if (prior.best_estimate !== best_estimate) differentBest++;
          if (prior.range.lower !== range.lower || prior.range.upper !== range.upper) differentRange++;
        }
        estimates.push({ range, best_estimate });
      }
      if (c.gold === 'B1' && outcome === 'over') counts.b1EntirelyAbove++;
      if (c.gold === 'B2' && outcome === 'under') counts.b2EntirelyBelow++;
      if (range && LEVELS.indexOf(range.lower) < LEVELS.indexOf('B2') && LEVELS.indexOf(range.upper) >= LEVELS.indexOf('B2')) counts.crossesB2++;
      console.log(JSON.stringify({ id: c.id, task: c.task, model, run, gold: c.gold, best_estimate, range, outcome }));
    } catch (error) {
      counts.failed++;
      console.error(JSON.stringify({ id: c.id, model, run, failure: error.message }));
    }
  }
}
console.log(JSON.stringify({ rubric: RUBRIC_VERSION, cases: heldOut.length, repeat, attempts: heldOut.length * repeat,
  counts, comparablePairs, differentBest, differentRange }));
if (counts.failed) process.exitCode = 1;
