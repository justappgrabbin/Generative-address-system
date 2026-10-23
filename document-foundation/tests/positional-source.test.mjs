import test from 'node:test';
import assert from 'node:assert/strict';
import {PunctuationParser} from '../../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/vendor/cynthia-original/r21.21/substrate/mesh072/core/punctuation_parser.mjs';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const input='Trop Sun Vir 6.4.4.4.2 25° 59′ 31.92″ H5';
test('existing parser preserves full positional shorthand and exact angular precision',()=>{
 const parser=new PunctuationParser(),result=parser.parsePositionalSource(input);
 assert.equal(result.ok,true);assert.equal(result.raw,input);
 assert.deepEqual(result.address,{zodiacSystem:'Tropical',planetary:'Sun',zodiac:'Virgo',gate:6,line:4,color:4,tone:4,base:2,degree:25,minute:59,arcsecond:'31.92',house:5});
 assert.deepEqual(result.angularPrecision.exact,{numerator:'3192',denominator:'100',decimalPlaces:2});
 assert.equal(result.semanticSlots.second,null);
 for(const token of result.tokens)assert.equal(input.slice(token.start,token.end),token.raw);
 const precise=parser.parsePositionalSource(input.replace('31.92','31.92000000000000000001'));
 assert.equal(precise.address.arcsecond,'31.92000000000000000001');
 assert.equal(precise.angularPrecision.exact.numerator,'3192000000000000000001');
});
test('angular decimal does not become a hierarchical period; old named and core forms remain accepted',()=>{
 const parser=new PunctuationParser(),tokens=parser.parse(input);
 assert.equal(tokens.find(t=>t.position===input.indexOf('.92')).type,'ANGULAR_DECIMAL');
 assert.equal(tokens.filter(t=>t.type==='HIERARCHICAL').length,4);
 assert.equal(parser.parseCanonicalAddress('6.4.4.4.2').ok,true);
 assert.equal(parser.parseCanonicalAddress('Gate:6 Line:4 Color:4 Tone:4 Base:2 Degree:25 Minute:59 Second:31 Arc:92 House:5 Zodiac:Virgo').ok,true);
});
test('unsupported or invalid positional source remains explicit without invented slots',()=>{
 const parser=new PunctuationParser();
 assert.equal(parser.parsePositionalSource(input.replace('25°','30°')).ok,false);
 assert.equal(parser.parsePositionalSource(input.replace('31.92','60.00')).ok,false);
 assert.equal(parser.parsePositionalSource(input+' extra').ok,false);
 assert.equal(parser.parsePositionalSource(input.replace(' H5','')).address,null);
 assert.equal(Object.hasOwn(parser.parsePositionalSource(input).address,'dimension'),false);
});
test('existing file ingestion exposes lexical fill, shares the receipt and restores it without semantic execution',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const result=await app.ingest(input,{name:'positional-address.txt',dimensionalPerspective:{observer:'Design',subject:'Evolution'}});
 assert.equal(result.status,'PARSED_NOT_RESOLVED');
 assert.equal(result.lexicalFill.raw,input);assert.equal(result.lexicalFill.address.arcsecond,'31.92');
 assert.equal(result.fieldContact.observation.observed_features.dimensionalPerspective.observer,'Design');
 assert.equal(app.field.nodes.size,0);assert.ok(result.shared.deliveries.every(d=>d.delivered));
 const replay=new Foundation({store});await replay.ready;
 assert.deepEqual(replay.field.observations,app.field.observations);
 assert.deepEqual(replay.history[0].result.lexicalFill,result.lexicalFill);
});
