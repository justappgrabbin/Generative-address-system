import { DIMENSION_CHAINS, ORDINAL_PERSPECTIVES, CRYSTALS_AND_MONOPOLE } from '../vendor/chains.js';
import { firstCapital } from './direction.mjs';

// Readable normalization of the Black Book's hexagram list. Raw OCR is retained
// in docs/corpus/black-book-hexagrams-ocr.txt; these are titles, not fixed behaviors.
export const HEXAGRAM_TITLES=Object.freeze([
  'The Creative','The Receptive','Difficulty at the Beginning','Youthful Folly','Waiting','Conflict','The Army','Holding Together',
  'The Taming Power of the Small','Treading','Peace','Standstill','Fellowship of Man','Possession in Great Measure','Modesty','Enthusiasm',
  'Following','Work on What Has Been Spoilt','Approach','Contemplation','Biting Through','Grace','Splitting Apart','Returning',
  'Innocence','The Taming Power of the Great','Nourishment','Preponderance of the Great','The Abysmal','Clinging Fire','Influence','Duration',
  'Retreat','Power of the Great','Progress','Darkening of the Light','Family','Opposition','Obstruction','Deliverance',
  'Decrease','Increase','Breakthrough','Coming to Meet','Gathering Together','Pushing Upward','Oppression','The Well',
  'Revolution','The Cauldron','The Arousing','Keeping Still','Development','The Marrying Maiden','Abundance','The Wanderer',
  'The Gentle','The Joyous','Dispersion','Limitation','Inner Truth','Preponderance of the Small','After Completion','Before Completion'
]);

/** The address selects a hexagram; a source perspective orders five expression
 * tracks. It does not assign an event's leading dimension or derive mechanics
 * from an English title. Templates are explicitly provisional compositions.
 */
export function morphologyFor(particle,{perspective='Being'}={}) {
  const orderClaim=ORDINAL_PERSPECTIVES[perspective];
  const order=orderClaim?.value??null;
  const sourceOrder=order??Object.keys(DIMENSION_CHAINS);
  const title=HEXAGRAM_TITLES[particle.gate-1];
  const tracks=sourceOrder.map(dimension=>{
    const chain=DIMENSION_CHAINS[dimension];
    const body=CRYSTALS_AND_MONOPOLE.designCrystal.value.binary.find(b=>b.chain===dimension);
    const keynote=body?.keynote??chain.micro.value.keynote.phrase;
    return {dimension,keynote,concept:title,expression:`${keynote} ${title}`,capital:firstCapital(keynote),
      address:{gate:particle.gate,line:particle.line,color:particle.color,tone:particle.tone,base:particle.base},
      definingFactors:chain.macroChain.map(c=>({text:c.value,source:c.source})),
      source:'Black Book hexagram list + dimension keynote',
      status:'provisional grammar composition; not a quoted source sentence or fixed behavior',
      orientation:null,orientationStatus:'per-frame letter traversal unresolved'};
  });
  return {identity:particle.id,perspective,order,orderSource:orderClaim?.source??null,
    orderingStatus:order?'source-attested perspective order':'perspective order unresolved; source rows retained',
    tracks,leadingDimension:particle.leadingDimension};
}
