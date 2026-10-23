const SYMBOLS = Object.freeze({
  '•':'SINGULARITY','°':'COLLAPSE',':':'PORTAL',';':'FORK',',':'BREATH',
  '–':'CURRENT','′':'PULSE','″':'FLICKER','=':'MIRROR','→':'VECTOR'
});
const DIMENSIONS = new Set(['Movement','Evolution','Being','Design','Space']);
const ZODIAC = new Set(['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']);

export class PunctuationParser {
  parse(input='') {
    const out=[];
    for (let i=0;i<input.length;i++) {
      const ch=input[i];
      if (ch === '.') out.push(this.#period(input,i));
      else if (SYMBOLS[ch]) out.push({type:SYMBOLS[ch],char:ch,position:i,context:this.#context(input,i),confidence:1});
    }
    return out;
  }

  #period(input, position) {
    const left=input.slice(0,position), right=input.slice(position+1);
    // A decimal inside an angular token is numeric precision, not another
    // Gate.Line level or a sentence connective.
    if (/\d$/.test(left) && /^\d+\s*[″"]/.test(right)) return {type:'ANGULAR_DECIMAL',char:'.',position,context:this.#context(input,position),confidence:1};
    if (/\d$/.test(left) && /^\d/.test(right)) return {type:'HIERARCHICAL',char:'.',position,context:this.#context(input,position),confidence:.95};
    if (/\b(?:Gate|Line|Color|Tone|Base)\s*\d+$/i.test(left)) return {type:'HIERARCHICAL',char:'.',position,context:this.#context(input,position),confidence:.9};
    if (right.trim()==='' || /^\s+[A-Z]/.test(right)) return {type:'TERMINATOR',char:'.',position,context:this.#context(input,position),confidence:.85};
    return {type:'TRANSITION',char:'.',position,context:this.#context(input,position),confidence:.5};
  }

  #context(input, position, radius=10) { return input.slice(Math.max(0,position-radius), Math.min(input.length,position+radius+1)); }

  /** Lossless lexical admission of the existing compact planetary notation.
   * This does not infer dimensional traversal or a sentence. Decimal angular
   * seconds stay one exact token; the distinct semantic Second slot remains
   * unresolved unless a source rule supplies it. */
  parsePositionalSource(input='') {
    const raw=String(input);
    const pattern=/^\s*(?<system>Trop(?:ical)?)\s+(?<planet>Sun|Earth|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|North Node|South Node)\s+(?<sign>Aries|Ari|Taurus|Tau|Gemini|Gem|Cancer|Can|Leo|Virgo|Vir|Libra|Lib|Scorpio|Sco|Sagittarius|Sag|Capricorn|Cap|Aquarius|Aqu|Pisces|Pis)\s+(?<gate>\d{1,2})\.(?<line>\d)\.(?<color>\d)\.(?<tone>\d)\.(?<base>\d)\s+(?<degree>\d{1,2})°\s*(?<minute>\d{1,2})[′']\s*(?<angularSecond>\d{1,2}(?:\.\d+)?)[″"]\s+H(?<house>\d{1,2})\s*$/di;
    const match=pattern.exec(raw);
    if(!match)return Object.freeze({ok:false,raw,status:'UNRECOGNIZED_POSITIONAL_FORM',address:null,tokens:Object.freeze([]),errors:Object.freeze(['Input does not match the supported Tropical planetary shorthand; original text preserved'])});
    const g=match.groups;
    const signNames=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const signs=['Ari','Tau','Gem','Can','Leo','Vir','Lib','Sco','Sag','Cap','Aqu','Pis'];
    const signIndex=signNames.findIndex((name,i)=>name.toLowerCase()===g.sign.toLowerCase()||signs[i].toLowerCase()===g.sign.toLowerCase());
    const planets=['Sun','Earth','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','North Node','South Node'];
    const address={zodiacSystem:'Tropical',planetary:planets.find(p=>p.toLowerCase()===g.planet.toLowerCase()),zodiac:signNames[signIndex],gate:Number(g.gate),line:Number(g.line),color:Number(g.color),tone:Number(g.tone),base:Number(g.base),degree:Number(g.degree),minute:Number(g.minute),arcsecond:g.angularSecond,house:Number(g.house)};
    const errors=[];
    for(const [field,min,max] of [['gate',1,64],['line',1,6],['color',1,6],['tone',1,6],['base',1,5],['degree',0,29],['minute',0,59],['house',1,12]])if(address[field]<min||address[field]>max)errors.push(`${field} must be ${min}-${max}`);
    if(Number(g.angularSecond.split('.')[0])>59)errors.push('angularSecond must be less than 60');
    const [whole,fraction='']=g.angularSecond.split('.');
    const exact={numerator:(BigInt(whole+fraction)).toString(),denominator:(10n**BigInt(fraction.length)).toString(),decimalPlaces:fraction.length};
    const tokens=Object.entries(match.indices.groups).map(([field,[start,end]])=>Object.freeze({field,start,end,raw:raw.slice(start,end)}));
    return Object.freeze({ok:errors.length===0,raw,status:errors.length?'INVALID_POSITIONAL_FORM':'PARSED_LEXICAL_FILL',address:Object.freeze(address),tokens:Object.freeze(tokens),angularPrecision:Object.freeze({raw:g.angularSecond,unit:'arcsecond',exact:Object.freeze(exact)}),semanticSlots:Object.freeze({second:null,arcsecond:g.angularSecond}),unresolved:Object.freeze(['active dimensional perspective comes from context','Second versus Arcsecond semantic traversal requires a source rule','punctuation alternatives require contextual selection']),errors:Object.freeze(errors)});
  }

  parseCanonicalAddress(input='') {
    const fields={};
    const kv=/\b(Planetary|Planet|Dimension|Gate|Line|Color|Tone|Base|Degree|Minute|Second|Arc|Axis|Zodiac|House)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi;
    let m;
    while ((m=kv.exec(input))) {
      const k=m[1].toLowerCase()==='planet'?'planetary':m[1].toLowerCase();
      fields[k]=m[2].replace(/^['"]|['"]$/g,'');
    }
    const compact=input.match(/(?:^|\s)(\d{1,2})\.(\d)\.(\d)\.(\d)\.(\d)(?:°(\d{1,2}))?(?:′(\d{1,2}))?(?:″(\d{1,2}))?/);
    if (compact) {
      fields.gate ??= compact[1]; fields.line ??= compact[2]; fields.color ??= compact[3]; fields.tone ??= compact[4]; fields.base ??= compact[5];
      if (compact[6] != null) fields.degree ??= compact[6];
      if (compact[7] != null) fields.minute ??= compact[7];
      if (compact[8] != null) fields.second ??= compact[8];
    }
    const numeric=['gate','line','color','tone','base','degree','minute','second','arc','house'];
    for (const k of numeric) if (fields[k] != null) fields[k]=Number(fields[k]);
    const errors=[];
    const range=(k,min,max)=>{ if(fields[k]!=null && (!Number.isInteger(fields[k])||fields[k]<min||fields[k]>max)) errors.push(`${k} must be ${min}-${max}`); };
    range('gate',1,64); range('line',1,6); range('color',1,6); range('tone',1,6); range('base',1,5);
    range('degree',0,29); range('minute',0,59); range('second',0,59); range('arc',0,99); range('house',1,12);
    if (fields.dimension && !DIMENSIONS.has(fields.dimension)) errors.push('dimension must be Movement/Evolution/Being/Design/Space');
    if (fields.zodiac && !ZODIAC.has(fields.zodiac)) errors.push('zodiac must be a standard sign name');
    const core=['gate','line','color','tone','base'];
    const missingCore=core.filter(k=>fields[k]==null);
    return Object.freeze({ ok:errors.length===0 && missingCore.length===0, address:Object.freeze(fields), missingCore:Object.freeze(missingCore), errors:Object.freeze(errors) });
  }
}

export default PunctuationParser;
