import { DIMENSIONS } from './semantics.mjs';
/** Unicode-aware and case-preserving: never normalize away the governing capital. */
export function firstCapital(expression) {
  if(typeof expression!=='string')throw new TypeError('Expression must be text');
  return [...expression].find(char=>/\p{Lu}/u.test(char))??null;
}
export function validateDirectionRule(rule) {
  if(!rule||!DIMENSIONS.includes(rule.dimension)||typeof rule.capital!=='string'||[...rule.capital].length!==1||firstCapital(rule.capital)!==rule.capital)throw new TypeError('Direction rule needs a dimension and one capital');
  if(!Array.isArray(rule.vector)||rule.vector.length!==2||!rule.vector.every(Number.isFinite)||Math.hypot(...rule.vector)===0||rule.vector.some(v=>Math.abs(v)>1))throw new TypeError('Direction vector needs two finite components in −1..1, not both zero');
  if(typeof rule.source!=='string'||!rule.source.trim()||rule.source.length>1000)throw new TypeError('Direction rule needs source provenance');
}
export function resolveDirection(expression,frame,rules=[]) {
  const capital=firstCapital(expression),matches=rules.filter(r=>r.dimension===frame&&r.capital===capital);
  if(matches.length!==1)return {capital,frame,vector:null,status:capital?'capital-to-direction rule unresolved in this frame':'no governing capital supplied',source:null};
  const rule=matches[0];return {capital,frame,vector:[...rule.vector],status:'explicit sourced rule',source:rule.source};
}
