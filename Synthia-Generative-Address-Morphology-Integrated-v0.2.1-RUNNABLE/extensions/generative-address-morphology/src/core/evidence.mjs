export const EvidenceStatus = Object.freeze({
  ESTABLISHED:'established', SOURCE_SUPPORTED:'source-supported', EXPERIMENTAL:'experimental'
});
export function evidence(status='experimental', provenance=[]){
  if(!Object.values(EvidenceStatus).includes(status)) throw new Error(`Unknown evidence status: ${status}`);
  return Object.freeze({status, provenance:[...provenance]});
}
