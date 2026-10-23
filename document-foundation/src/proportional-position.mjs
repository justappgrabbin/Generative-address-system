import {parseAddress} from './operational-address.mjs';
// User-supplied nesting, formalized as exact proportional subdivision.
// No 360-valued arc field, word→gate table, or degree=Color assignment.
const RADICES={line:6,color:6,tone:6,base:5,arcFraction:100};
export const QUALIFICATION_ORDER=Object.freeze(Object.keys(RADICES));
function gcd(a,b){while(b){[a,b]=[b,a%b];}return a<0n?-a:a;}
function rational(n,d=1n){n=BigInt(n);d=BigInt(d);if(d<=0n)throw new RangeError('Positive denominator required');const g=gcd(n,d);return {n:n/g,d:d/g};}
const json=r=>({numerator:r.n.toString(),denominator:r.d.toString()});
function integer(value,min,max,name){if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`${name} must be ${min}..${max}`);return value;}
function dms(r){
  const whole=r.n/r.d,sub=rational(r.n%r.d,r.d);
  return {degree:Number(whole/3600n),minute:Number(whole/60n%60n),second:Number(whole%60n),subSecond:json(sub)};
}
function orderFor(order){if(!Array.isArray(order)||order.length!==5||new Set(order).size!==5||order.some(k=>!(k in RADICES)))throw new TypeError('View order must contain line, color, tone, base and arcFraction once each');return order;}
export function qualificationInterval(qualification,{order=QUALIFICATION_ORDER,refinements=[]}={}){
  orderFor(order);let numerator=0n,denominator=1n;const path=[];
  for(const field of order){const radix=RADICES[field],zero=field==='arcFraction',value=integer(qualification[field],zero?0:1,zero?99:radix,field),index=value-(zero?0:1);numerator=numerator*BigInt(radix)+BigInt(index);denominator*=BigInt(radix);path.push({field,radix,index});}
  for(const step of refinements){const radix=integer(step.radix,2,1000000,'refinement radix'),index=integer(step.index,0,radix-1,'refinement index');numerator=numerator*BigInt(radix)+BigInt(index);denominator*=BigInt(radix);path.push({radix,index});}
  const start=rational(numerator,denominator),end=rational(numerator+1n,denominator),span=20250n;
  return {rule:'nested-proportion.v1',source:'User: 5°37′30″; 6 lines × 6 colors × 6 tones × 5 bases; arc refinement 0–99',order:[...order],path,ordinal:numerator.toString(),capacity:denominator.toString(),proportion:{start:json(start),end:json(end)},arcSeconds:{start:json(rational(numerator*span,denominator)),end:json(rational((numerator+1n)*span,denominator))},localDMS:{start:dms(rational(numerator*span,denominator)),end:dms(rational((numerator+1n)*span,denominator))},arcView:{single:qualification.arcFraction,pairedDecimal:[Math.floor(qualification.arcFraction/10),qualification.arcFraction%10],meaning:'Two views of the same refinement index, not an imposed axon/axis meaning'}};
}
export function locateQualification({numerator,denominator}, {order=QUALIFICATION_ORDER}={}){
  orderFor(order);let n=BigInt(numerator),d=BigInt(denominator);if(d<=0n||n<0n||n>=d)throw new RangeError('Proportion must be in [0,1)');const result={};
  for(const field of order){n*=BigInt(RADICES[field]);const digit=n/d;n%=d;result[field]=Number(digit)+(field==='arcFraction'?0:1);}
  return result;
}
export function resolveProportionalAddress({scope,qualification,origin,source,order=QUALIFICATION_ORDER,refinements=[]}){
  if(!source||!origin)throw new TypeError('Source-backed gate origin is required; no chart origin is guessed');
  integer(origin.degree,0,29,'origin.degree');integer(origin.minute,0,59,'origin.minute');integer(origin.second,0,59,'origin.second');
  integer(scope.zodiac,1,12,'zodiac');
  const interval=qualificationInterval(qualification,{order,refinements}),offset=interval.arcSeconds.start;
  const denominator=BigInt(offset.denominator),originSeconds=BigInt(origin.degree*3600+origin.minute*60+origin.second),absolute=rational(originSeconds*denominator+BigInt(offset.numerator),denominator);
  // Carry across the supplied 0..29 degree zodiac sectors. This is separate
  // from the local 5°37′30″ gate span and the 0..99 refinement field.
  const sectorSeconds=30n*3600n,carry=absolute.n/(absolute.d*sectorSeconds),local=rational(absolute.n%(absolute.d*sectorSeconds),absolute.d),display=dms(local);
  const address=parseAddress({...scope,...qualification,zodiac:1+(scope.zodiac-1+Number(carry))%12,degree:display.degree,minute:display.minute,second:display.second,precision:{subSecond:display.subSecond,refinements:structuredClone(refinements),viewOrder:[...order]}});
  return {address,position:interval,calculation:{rule:interval.rule,source,origin:structuredClone(origin),sectorCarry:Number(carry),exactSeconds:json(absolute),context:scope.dimension,claim:'Exact subdivision from supplied origin; semantic readings are learned in context'}};
}
