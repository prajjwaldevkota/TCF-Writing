import { ExamResult, TaskKey } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';
import type { DimensionScore, MistakeItem } from '../types/aiEvaluation';

export const LEVELS = ['A1 not achieved', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export interface PedagogicalTask {
  task_fulfilment_audit?: { requirement: string; met: boolean; finding: string }[];
  syntactic_and_lexical_inventory?: { structures: string[]; recurrent_errors: string[] };
  range: { lower: string; upper: string } | null;
  best_estimate?: string | null;
  priority_evidence?: { quote: string; error_type: string; drill: string }[];
  withholding_reason: string;
  communication_pass: string;
  language_pass: string;
  domains: { linguistic: string; pragmatic: string; sociolinguistic: string };
  limiting_evidence: string[];
  priorities: string[];
  risks: string[];
  source_checks: { document1: string; document2: string; comparison: string; reformulation: string } | null;
  feedback: string;
  strengths: string[];
  dimension_scores: DimensionScore[];
  indicative_score: number | null; // /20 indicative score
  model_answer: string;
  model_answer_warning?: string;
  validation_warnings?: string[];
  omitted_corrections?: number;
  corrections_incomplete?: boolean;
  corrections_checked?: boolean;
  level_evidence?: { quote:string; domain:'linguistic'|'pragmatic'|'sociolinguistic'; explanation:string }[];
  mistakes: MistakeItem[];
}

export interface PedagogicalAssessment {
  feedback_language: 'en' | 'fr';
  mock_projection?: { lower: number; upper: number; rationale: string } | null;
  projection_withholding_reason?: string;
  overall_indicative_score?: number | null;
  tasks: Partial<Record<TaskKey, PedagogicalTask>>;
}

/** Resolve harmless quote/hyphen/spacing changes back to an exact original excerpt. */
export function findOriginalExcerpt(original:string,quote:string):string|null {
  const canonical=(text:string)=>{
    let normalized='';const starts:number[]=[];const ends:number[]=[];
    for(const match of text.matchAll(/(?:\P{M}\p{M}*|\p{M}+)/gu)) {
      const char=match[0];const start=match.index!;
      const c=/\s/u.test(char)?' ':char.normalize('NFC').replace(/[’‘ʼ＇]/g,"'").replace(/[“”„‟«»]/g,'"').replace(/[‐‑‒–]/g,'-');
      if(c===' ' && normalized.endsWith(' ')) {ends[ends.length-1]=start+char.length;continue;}
      normalized+=c;for(let i=0;i<c.length;i++){starts.push(start);ends.push(start+char.length);}
    }
    return{normalized,starts,ends};
  };
  const source=canonical(original);const target=canonical(quote).normalized;
  if(!target.trim())return null;
  const index=source.normalized.indexOf(target);
  return index<0?null:original.slice(source.starts[index],source.ends[index+target.length-1]);
}

// Compare whole words, allowing French typographic and punctuation differences.
function comparisonWords(text: string): string {
  return (text.normalize('NFC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).join(' ');
}

function normalizeStringList(value: unknown, fieldName: string): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) throw new Error(`Invalid ${fieldName}`);
  const out: string[] = [];
  for (const item of value) {
    if (item == null) continue;
    if (typeof item === 'string') {
      if (item.trim()) out.push(item.trim());
      continue;
    }
    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const quote = typeof obj.quote === 'string' ? obj.quote.trim() : '';
      const detail =
        ['explanation', 'text', 'description', 'reason', 'priority', 'risk', 'point', 'message', 'summary']
          .map(k => (typeof obj[k] === 'string' ? (obj[k] as string).trim() : ''))
          .find(Boolean) ||
        Object.values(obj)
          .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
          .map(v => v.trim())
          .join(' — ');
      if (quote && detail && detail !== quote) {
        out.push(`« ${quote} » — ${detail}`);
      } else if (detail) {
        out.push(detail);
      } else if (quote) {
        out.push(quote);
      }
      continue;
    }
    throw new Error(`Invalid ${fieldName}`);
  }
  return out;
}

export function validatePedagogicalAssessment(raw: any, keys: TaskKey[], result: ExamResult, requireDiagnostic = false, model = ''): PedagogicalAssessment {
  if (!raw || !['en', 'fr'].includes(raw.feedback_language) || !raw.tasks || typeof raw.tasks !== 'object') throw new Error('Incomplete AI assessment.');
  for (const k of Object.keys(raw.tasks)) {
    if (!keys.includes(k as TaskKey) && raw.tasks[k] == null) delete raw.tasks[k];
  }
  if (Object.keys(raw.tasks).some(k => !keys.includes(k as TaskKey))) throw new Error('AI assessed an unrequested task.');
  if (['overall_score', 'clb_level', 'nclc_level', 'official_score', 'overall_indicative_score'].some(k => raw[k] != null)) throw new Error('AI must not return official or numerical results.');

  for (const key of keys) {
    const task = raw.tasks[key]; const req = result.combination.tasks[key];
    if (task) { task.validation_warnings=[]; task.omitted_corrections=0; task.corrections_incomplete=false; }
    if (task && ['score', 'clb_level', 'nclc_level', 'official_score'].some(k => task[k] != null)) throw new Error('Task scores and NCLC estimates are not allowed.');
    if (!task || typeof task.feedback !== 'string' || !task.feedback.trim()) throw new Error(`Missing feedback: ${key}`);
    if (requireDiagnostic) {
      const audit = task.task_fulfilment_audit;
      const inventory = task.syntactic_and_lexical_inventory;
      const hasText = (value: unknown) => typeof value === 'string' && !!value.trim();
      if (!Array.isArray(audit) || (req.instruction?.trim() && !audit.length) ||
        !audit.every(item => item && hasText(item.requirement) && typeof item.met === 'boolean' && hasText(item.finding))) {
        throw new Error(`Missing task fulfilment audit: ${key}`);
      }
      if (![inventory?.structures, inventory?.recurrent_errors].every(list => Array.isArray(list) && list.every(hasText))) {
        throw new Error(`Missing language inventory: ${key}`);
      }
    }
    for (const name of ['communication_pass', 'language_pass']) if (typeof task[name] !== 'string' || !task[name].trim()) throw new Error(`Missing evidence: ${key}/${name}`);
    for (const name of ['linguistic', 'pragmatic', 'sociolinguistic']) if (typeof task.domains?.[name] !== 'string' || !task.domains[name].trim()) throw new Error(`Missing domain: ${name}`);
    const proposedPriorities = task.priorities;
    for (const name of ['limiting_evidence', 'priorities', 'risks'] as const) {
      task[name] = normalizeStringList(task[name], name);
    }
    if (task.priorities.length > 5) throw new Error('At most five priorities are allowed.');

    // Validate strengths (new field, graceful fallback)
    task.strengths = normalizeStringList(task.strengths, 'strengths');

    // Legacy display fields remain readable, but new assessments cannot invent points.
    if ((Array.isArray(task.dimension_scores) && task.dimension_scores.length) || task.indicative_score != null) throw new Error('Numerical domain scoring is not allowed.');
    task.dimension_scores = [];
    task.indicative_score = null;

    // Validate model answer (new field, graceful fallback)
    if (typeof task.model_answer !== 'string') task.model_answer = '';

    const hasRange = task.range !== null;
    if (hasRange && (!task.range || !LEVELS.includes(task.range.lower) || !LEVELS.includes(task.range.upper) || LEVELS.indexOf(task.range.lower) > LEVELS.indexOf(task.range.upper))) throw new Error('Invalid pedagogical range.');
    // Enforce limitations even when a model ignores the instruction.
    const missingPrompt = !req.instruction?.trim();
    const missingSource = key === 'task3' && (!req.document1?.trim() || !req.document2?.trim() || !(req.title || req.instruction)?.trim());
    const blank = countFrenchWords(result.answers[key] || '') === 0;
    if (missingPrompt || missingSource || blank) {
      task.range = null;
      task.indicative_score = null;
      task.dimension_scores = [];
      task.withholding_reason = raw.feedback_language === 'en'
        ? (blank ? 'No response provided; a level cannot be assessed.' : missingPrompt ? 'The original task instructions are required to assess task fulfilment.' : 'The prompt and both documents are required to assess source fidelity and comparison.')
        : (blank ? 'Aucune réponse fournie : le niveau ne peut pas être évalué.' : missingPrompt ? 'La consigne originale est nécessaire pour évaluer la réalisation de la tâche.' : 'La consigne et les deux documents sont nécessaires pour évaluer la fidélité et la comparaison.');
    }
    if (task.range) {
      const lower = LEVELS.indexOf(task.range.lower);
      const upper = LEVELS.indexOf(task.range.upper);
      const best = LEVELS.indexOf(task.best_estimate);
      if (model.includes('flash-lite') || upper - lower > 1 || (requireDiagnostic && (best < lower || best > upper))) {
        task.range = null;
        task.withholding_reason = model.includes('flash-lite')
          ? (raw.feedback_language === 'en' ? 'Level withheld because a Flash-Lite model supplied this review.' : 'Niveau suspendu car le bilan provient d’un modèle Flash-Lite.')
          : (raw.feedback_language === 'en' ? 'The review could not narrow the estimate to a supported level within two adjacent levels.' : 'Le bilan ne permet pas de retenir un niveau parmi deux niveaux adjacents.');
      }
    }
    if (task.range === null) task.level_evidence = [];
    if (task.range !== null) {
      const answer = result.answers[key] || '';
      const suppliedTexts = [req.instruction, ...(key === 'task3' ? [req.document1, req.document2] : [])]
        .filter((text): text is string => Boolean(text)).map(text => ` ${comparisonWords(text)} `);
      const appearsInSource = (words: string) => Boolean(words) && suppliedTexts.some(text => text.includes(` ${words} `));
      const answerWords = comparisonWords(answer);
      const sourceOnlyAnswer = appearsInSource(answerWords);
      // Mask substantial verbatim runs so even a short quotation from inside one
      // cannot establish a level unless it also occurs in the learner's own prose.
      const words = answerWords.split(' ');
      const borrowed = new Uint8Array(words.length);
      for (let i = 0; i + 8 <= words.length; i++) {
        if (appearsInSource(words.slice(i, i + 8).join(' '))) borrowed.fill(1, i, i + 8);
      }
      const independentText = ' ' + words.map((word, i) => borrowed[i] ? '|' : word).join(' ') + ' ';
      let sourceEvidenceExcluded = false;
      const verifiedEvidence = (Array.isArray(task.level_evidence) ? task.level_evidence : []).flatMap((evidence:any) => {
        if (!evidence || typeof evidence.quote !== 'string' || !['linguistic','pragmatic','sociolinguistic'].includes(evidence.domain) || typeof evidence.explanation !== 'string' || !evidence.explanation.trim()) return [];
        const quote=findOriginalExcerpt(result.answers[key] || '',evidence.quote);
        if (!quote) return [];
        const quoteWords = comparisonWords(quote);
        if (sourceOnlyAnswer || (appearsInSource(quoteWords) && !independentText.includes(` ${quoteWords} `))) {
          sourceEvidenceExcluded = true;
          return [];
        }
        return [{...evidence,quote}];
      });
      const seen=new Set<string>();
      task.level_evidence=verifiedEvidence.filter((e:any)=>{const identity=e.quote;if(seen.has(identity))return false;seen.add(identity);return true;});
      if (task.level_evidence.length < 2) {
        task.range=null;
        task.withholding_reason=raw.feedback_language==='en' ? 'Level withheld: fewer than two supporting excerpts could be verified in your response.' : 'Niveau suspendu : moins de deux citations justificatives ont pu être vérifiées dans votre réponse.';
        if (sourceEvidenceExcluded) {
          task.withholding_reason = raw.feedback_language === 'en'
            ? 'Level withheld because fewer than two independent examples remain after excluding supplied wording. Use your own words to explain the ideas.'
            : 'Niveau suspendu faute de deux exemples personnels après exclusion des passages repris du sujet. Expliquez les idées avec vos propres mots.';
        }
        task.validation_warnings.push(task.withholding_reason);
      }
    }
    if (task.range === null) task.best_estimate = null;
    if (blank) { task.strengths=[]; task.level_evidence=[]; task.model_answer=''; }
    if (task.model_answer) {
      const count=countFrenchWords(task.model_answer);
      if (count < req.minWords || count > req.maxWords) {
        task.model_answer='';
        task.model_answer_warning=raw.feedback_language === 'en' ? 'Illustrative answer omitted: it did not meet the requested word range.' : 'Exemple omis : il ne respectait pas la plage de mots demandée.';
      }
    }
    if (task.range === null && (typeof task.withholding_reason !== 'string' || !task.withholding_reason.trim())) throw new Error('A withheld range requires a reason.');
    if (key === 'task3' && !missingSource && !blank && (!task.source_checks || ['document1', 'document2', 'comparison', 'reformulation'].some(k => typeof task.source_checks[k] !== 'string' || !task.source_checks[k].trim()))) throw new Error('Missing Task 3 source checks.');
    // A bad correction must not discard independently supported feedback.
    const corrections=Array.isArray(task.mistakes)?task.mistakes:[];
    task.corrections_incomplete=!Array.isArray(task.mistakes);
    const verifiedCorrections: MistakeItem[]=[];
    const seenCorrections=new Set<string>();
    const spans: { start: number; end: number }[] = [];
    const answer = result.answers[key] || '';
    for (const m of (blank ? [] : corrections)) {
      if (!m || ['category','original_text','corrected_text','explanation'].some(k=>typeof m[k]!=='string' || !m[k].trim())) {task.omitted_corrections++;continue;}
      const excerpt=findOriginalExcerpt(result.answers[key] || '',m.original_text);
      if (excerpt===null) {task.omitted_corrections++;continue;}
      const identity=JSON.stringify([excerpt,m.corrected_text]);
      if(seenCorrections.has(identity))continue;
      const start = answer.indexOf(excerpt);
      const end = start + excerpt.length;
      if (excerpt.trim().normalize('NFC') === m.corrected_text.trim().normalize('NFC') ||
          answer.indexOf(excerpt, start + 1) >= 0 ||
          spans.some(span => start < span.end && span.start < end) ||
          (requireDiagnostic && (!['error','improvement'].includes(m.kind) || !['minor','major'].includes(m.severity) ||
            typeof m.error_type !== 'string' || !m.error_type.trim()))) {
        task.omitted_corrections++;
        continue;
      }
      spans.push({ start, end });
      seenCorrections.add(identity);
      verifiedCorrections.push({...m,original_text:excerpt});
    }
    task.mistakes=verifiedCorrections;
    if (requireDiagnostic) {
      task.priority_evidence = (Array.isArray(proposedPriorities) ? proposedPriorities : []).flatMap(item => {
        if (typeof item?.quote !== 'string' || typeof item?.error_type !== 'string' || !item.error_type.trim() ||
            typeof item?.drill !== 'string' || !item.drill.trim()) return [];
        const quote = findOriginalExcerpt(answer, item.quote);
        if (!verifiedCorrections.some(m => m.original_text === quote && m.error_type === item.error_type)) return [];
        return [{ quote, error_type: item.error_type, drill: item.drill }];
      });
      task.priorities = task.priority_evidence.map((item: { drill: string }) => item.drill);
    }
    if(task.omitted_corrections || task.corrections_incomplete) {
      task.corrections_incomplete=true;
      task.validation_warnings.push(raw.feedback_language==='en'
        ? `${task.omitted_corrections} unverified or incomplete correction(s) omitted. Only verified corrections were retained; this is not a complete error count.`
        : `${task.omitted_corrections} correction(s) non vérifiée(s) ou incomplète(s) omise(s). Seules les corrections vérifiées sont conservées ; ce total ne représente pas toutes vos erreurs.`);
    }
    // Deterministic word-limit risk, never an invented official penalty.
    const words = countFrenchWords(result.answers[key] || '');
    if (words < req.minWords || words > req.maxWords) task.risks.push(raw.feedback_language === 'en' ? `Word count ${words}; requested range ${req.minWords}–${req.maxWords}. In the exam this puts the script at risk of A1 non atteint.` : `${words} mots ; plage demandée ${req.minWords}–${req.maxWords}. À l’examen, la copie risque la mention « A1 non atteint ».`);
  }

  raw.overall_indicative_score = null;

  const eligibility = mockProjectionEligibility(result, keys);
  const unsupportedLevel = keys.some(key => raw.tasks[key]?.range === null);
  if (eligibility.eligible && unsupportedLevel) {
    raw.mock_projection=null;
    raw.projection_withholding_reason=raw.feedback_language==='en' ? 'NCLC estimate withheld because a task-level assessment lacks sufficient verified evidence.' : 'Estimation NCLC suspendue : un bilan par tâche manque de citations justificatives vérifiées.';
  } else if (!eligibility.eligible) {
    raw.mock_projection = null;
    raw.projection_withholding_reason = raw.feedback_language === 'en' ? eligibility.reason_en : eligibility.reason_fr;
  } else if (raw.mock_projection != null) {
    const p = raw.mock_projection;
    if (!Number.isInteger(p.lower) || !Number.isInteger(p.upper) || p.lower < 3 || p.upper > 10 || p.lower >= p.upper || typeof p.rationale !== 'string' || !p.rationale.trim()) {
      throw new Error('Invalid NCLC mock-exam projection: a justified range is required.');
    }
    if (p.upper - p.lower > 2) {
      raw.mock_projection = null;
      raw.projection_withholding_reason = raw.feedback_language === 'en'
        ? 'The estimate spans more than two NCLC points.' : 'L’estimation couvre plus de deux points NCLC.';
    } else raw.projection_withholding_reason = '';
  } else {
    raw.mock_projection = null;
    raw.projection_withholding_reason = typeof raw.projection_withholding_reason === 'string' && raw.projection_withholding_reason.trim()
      ? raw.projection_withholding_reason
      : (raw.feedback_language === 'en' ? 'The assessor withheld the full-exam projection because the evidence was insufficient.' : 'La projection globale est suspendue : les éléments disponibles sont insuffisants.');
  }
  return raw;
}

/** These checks establish enough input for an estimate, not official admissibility. */
export function mockProjectionEligibility(result: ExamResult, keys: TaskKey[]) {
  const allKeys: TaskKey[] = ['task1', 'task2', 'task3'];
  if (result.isPracticeMode || !allKeys.every(key => keys.includes(key))) return {
    eligible: false, reason_en: 'A complete three-task mock exam is required for an estimated NCLC range.',
    reason_fr: 'Un examen blanc complet de trois tâches est nécessaire pour estimer une plage NCLC.'
  };
  for (const key of allKeys) {
    const req = result.combination.tasks[key]; const words = countFrenchWords(result.answers[key] || '');
    if (!req.instruction?.trim() || words < req.minWords || words > req.maxWords) return {
      eligible: false, reason_en: 'All three tasks must have a prompt and a response within the requested word range.',
      reason_fr: 'Chaque tâche doit comporter une consigne et une réponse respectant la plage de mots demandée.'
    };
  }
  const task3 = result.combination.tasks.task3;
  if (!task3.document1?.trim() || !task3.document2?.trim()) return {
    eligible: false, reason_en: 'Both Task 3 documents are required for a full-exam estimate.',
    reason_fr: 'Les deux documents de la tâche 3 sont nécessaires pour une estimation globale.'
  };
  return { eligible: true, reason_en: '', reason_fr: '' };
}
