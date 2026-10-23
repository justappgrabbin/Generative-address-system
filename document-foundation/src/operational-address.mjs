// Combined specification IV.C §§68–69; source ranges in architecture §3.
// arcFraction and axis are deliberately distinct: their equivalence is unresolved.
export const PERSPECTIVES = Object.freeze(['Movement','Evolution','Being','Design','Space']);
export const ADDRESS_ORDER = Object.freeze(['planetary','dimension','gate','line','color','tone','base','degree','minute','second','arcFraction','zodiac','house']);
const ranges = {planetary:[1,13],gate:[1,64],line:[1,6],color:[1,6],tone:[1,6],base:[1,5],degree:[0,29],minute:[0,59],second:[0,59],arcFraction:[0,99],zodiac:[1,12],house:[1,12]};
export class AddressError extends Error {
  constructor(field,value,range,address,provenance) {
    super(`Invalid ${field}: ${JSON.stringify(value)}; expected ${range}`);
    this.name='AddressError'; this.details={field,value,range,coordinate:structuredClone(address),origin:provenance?.source??null,calculation:provenance?.calculation??null};
  }
}
export function parseAddress(source, provenance={}) {
  const address=typeof source==='string'?JSON.parse(source):structuredClone(source);
  if(!address || typeof address!=='object' || Array.isArray(address))throw new TypeError('Address must be an object');
  for(const field of ADDRESS_ORDER) {
    const value=address[field];
    if(field==='dimension') {
      if(!PERSPECTIVES.includes(value))throw new AddressError(field,value,PERSPECTIVES.join('|'),address,provenance);
    } else {
      const [lo,hi]=ranges[field];
      if(!Number.isInteger(value)||value<lo||value>hi)throw new AddressError(field,value,`${lo}..${hi}`,address,provenance);
    }
  }
  return address;
}
export function serializeAddress(source) {
  const a=parseAddress(source);
  // Named, ordered values, never a hash/embedding. Extra fields are not silently lost.
  return JSON.stringify({...Object.fromEntries(ADDRESS_ORDER.map(k=>[k,a[k]])),...Object.fromEntries(Object.keys(a).filter(k=>!ADDRESS_ORDER.includes(k)).sort().map(k=>[k,a[k]]))});
}
export function compareAddresses(a,b) {
  a=parseAddress(a);b=parseAddress(b);
  return ADDRESS_ORDER.map(field=>({field,from:a[field],to:b[field],changed:a[field]!==b[field]}));
}
export function evaluateTransition(a,b,rule) {
  const comparisons=compareAddresses(a,b), changed=comparisons.filter(x=>x.changed);
  if(!rule?.version||!rule?.source)return {status:'INVESTIGATE',reason:'Missing versioned transition rule',comparisons};
  const checks=changed.map(({field,from,to})=>{
    const encoding=rule.encodings?.[field],left=encoding?.[from],right=encoding?.[to];
    if(typeof left!=='string'||typeof right!=='string'||!left.length||left.length!==right.length||!/^[01]+$/.test(left+right))return {field,status:'UNKNOWN',reason:'Missing explicit binary encoding'};
    const distance=[...left].filter((bit,i)=>bit!==right[i]).length;
    return {field,left,right,distance,status:distance===1?'PERMITTED':'BLOCKED'};
  });
  return {status:checks.some(x=>x.status==='BLOCKED')?'BLOCKED':checks.some(x=>x.status==='UNKNOWN')?'INVESTIGATE':'PERMITTED',checks,comparisons,rule:{version:rule.version,source:rule.source}};
}
