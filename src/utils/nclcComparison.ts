import type { AIEvaluation } from '../types/aiEvaluation';
export interface NclcComparison {
 status:'matching'|'overlap'|'disagreement'|'single'|'withheld';
 range:{lower:number;upper:number}|null;
 models:{provider:string;model:string;range:{lower:number;upper:number}|null}[];
}
export function compareNclc(gemini:AIEvaluation|null,groq:AIEvaluation|null):NclcComparison {
 const models=[{provider:'Gemini',value:gemini},{provider:'Groq',value:groq}].map(({provider,value})=>({provider,model:value?.model||provider,range:value?.pedagogical?.mock_projection?{lower:value.pedagogical.mock_projection.lower,upper:value.pedagogical.mock_projection.upper}:null}));
 const ranges=models.flatMap(m=>m.range?[m.range]:[]);
 if(!ranges.length)return{status:'withheld',range:null,models};
 if(ranges.length===1)return{status:'single',range:ranges[0],models};
 const[a,b]=ranges;
 if(Math.max(a.lower,b.lower)>Math.min(a.upper,b.upper))return{status:'disagreement',range:null,models};
 return{status:a.lower===b.lower&&a.upper===b.upper?'matching':'overlap',range:{lower:Math.min(a.lower,b.lower),upper:Math.max(a.upper,b.upper)},models};
}
/** Save a summary without mutating either independent assessor's result. */
export function crosscheckedPrimary(gemini:AIEvaluation|null,groq:AIEvaluation|null):AIEvaluation|null {
 const base=gemini||groq;if(!base)return null;
 const comparison=compareNclc(gemini,groq);
 if(!base.pedagogical)return base;
 const en=base.pedagogical.feedback_language==='en';
 const rationale=en?'Combined coverage of the independent AI ranges; this is agreement checking, not validated grading accuracy.':'Étendue des plages IA indépendantes : vérification de concordance, sans validation de l’exactitude.';
 return{...base,nclc_crosscheck:comparison,pedagogical:{...base.pedagogical,mock_projection:comparison.range?{...comparison.range,rationale:comparison.status==='single'?(gemini?.pedagogical?.mock_projection?.rationale||groq?.pedagogical?.mock_projection?.rationale||rationale):rationale}:null,projection_withholding_reason:comparison.status==='disagreement'?(en?'The models disagree. No combined NCLC estimate is shown; compare the separate reviews.':'Les modèles sont en désaccord. Aucune estimation NCLC combinée ; comparez les bilans séparés.'):(base.pedagogical.projection_withholding_reason||'')}};
}
