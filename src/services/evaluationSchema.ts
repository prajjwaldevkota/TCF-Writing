import type { TaskKey } from '../types/exam';
import { LEVELS } from './pedagogicalAssessment';

const string = { type: 'STRING' };
const array = (items: object) => ({ type: 'ARRAY', items });
const strings = array(string);
const object = (properties: Record<string, object>) => ({
  type: 'OBJECT', properties, required: Object.keys(properties), propertyOrdering: Object.keys(properties),
});
const level = { ...string, enum: [...LEVELS] };
const diagnostic = object({
  task_fulfilment_audit: array(object({ requirement: string, met: { type: 'BOOLEAN' }, finding: string })),
  syntactic_and_lexical_inventory: object({ structures: strings, recurrent_errors: strings }),
  communication_pass: string, language_pass: string,
  domains: object({ linguistic: string, pragmatic: string, sociolinguistic: string }),
  limiting_evidence: strings,
  level_evidence: array(object({ quote: string, domain: { ...string, enum: ['linguistic','pragmatic','sociolinguistic'] }, explanation: string })),
  source_checks: { ...object({ document1: string, document2: string, comparison: string, reformulation: string }), nullable: true },
  strengths: strings, priorities: strings, risks: strings, feedback: string,
  mistakes: array(object({ category: string, original_text: string, corrected_text: string, explanation: string })),
  model_answer: string, withholding_reason: string,
  range: { ...object({ lower: level, upper: level }), nullable: true },
});

export function evaluationSchema(keys: TaskKey[]) {
  return object({
    feedback_language: { ...string, enum: ['en','fr'] },
    tasks: object(Object.fromEntries(keys.map(key => [key, diagnostic]))),
    projection_withholding_reason: string,
    mock_projection: { ...object({ lower: { type: 'INTEGER' }, upper: { type: 'INTEGER' }, rationale: string }), nullable: true },
  });
}
