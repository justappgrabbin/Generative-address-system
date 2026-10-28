import channels from '../vendor/channels.mjs';
import { kleinOperator } from '../vendor/klein.js';
import { DIMENSIONS, gateBits, changeLine, compareGates, potentials } from './semantics.mjs';
import { resolveDirection, validateDirectionRule } from './direction.mjs';
import { DODECAHEDRON, containsPoint, constrainParticle } from './topology.mjs';
import { validateQualitativeStructure } from './qualitative.mjs';

export const DEFAULTS = Object.freeze({ reinforcement: 0.024, decay: 0.0012, learningRate: 0.035,
  encounterRadius: 0.16, force: 0.6, formationThreshold: 0.42, motion: 0.6 });
const LIMITS = { reinforcement:[0,0.2], decay:[0,0.05], learningRate:[0,0.2], encounterRadius:[0.03,0.4],
  force:[0,5], formationThreshold:[0.1,0.95], motion:[0,2] };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const copy = x => structuredClone(x);
const pair = (a, b) => [a, b].sort().join('~');
const channelByPair = new Map(channels.map(c => [pair(...c.gates.map(String)), c]));
function validateParams(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!LIMITS[key] || !Number.isFinite(value) || value < LIMITS[key][0] || value > LIMITS[key][1]) throw new RangeError(`Invalid parameter: ${key}`);
  }
}
const dimensionState = () => Object.fromEntries(DIMENSIONS.map(d => [d, { activation: 0, observedEffect: 0,
  qualitative:{roots:[],source:null,status:'frame-specific qualitative structure unresolved; dimensions are not layers'} }]));

/** A sparse recurrent predictive network whose directed synapses arise through encounters.
 * All numerical dynamics below are experimental engineering choices, not JUT laws.
 * The particles and relations are the model; positions are its current geometric projection.
 */
export class Swarm {
  constructor({ seed = 221364, count = 96, params = {} } = {}) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid seed');
    if (!Number.isInteger(count) || count < 2 || count > 512) throw new RangeError('Runtime particle budget: 2–512');
    validateParams(params);
    this.seed = seed; this.randomState = seed || 1; this.count = count;
    this.params = { ...DEFAULTS, ...params }; this.initialParams = copy(this.params);
    this.tick = 0; this.serial = 0; this.events = []; this.actions = []; this.relations = [];
    this.formations = []; this.loss = null; this.samples = 0; this.lossSum = 0;
    this.directionRules=[];
    this.topology={kind:'dodecahedron',vertices:20,edges:30,faces:12,provenance:DODECAHEDRON.provenance};
    this.particles = Array.from({ length: count }, (_, i) => {
      const gate = i % 64 + 1;
      let position;
      do{position=[this.random(),this.random(),this.random()];}while(!containsPoint(position));
      return { id: `p${String(i + 1).padStart(3, '0')}`, gate, line: i % 6 + 1,
        color: i % 6 + 1, tone: Math.floor(i / 6) % 6 + 1, base: i % 5 + 1,
        // Deterministic scatter is an initial condition, not source-derived geometry.
        x:position[0],y:position[1],z:position[2],vz:(this.random()-.5)*.002,
        vx: (this.random() - 0.5) * 0.002, vy: (this.random() - 0.5) * 0.002,
        activation: this.random() * 0.6, prediction: 0, frames: dimensionState(),
        frame: { observer: 'local', originId: `p${String(i + 1).padStart(3, '0')}`, order: null,
          status: 'five participating views; per-dimension ordering unresolved' },
        expression:'', directionFrame:null, direction:resolveDirection('',null,[]),
        leadingDimension: null, potentials: potentials(), constituents: [], createdAt: 0 };
    });
    this.record('initialized', { count, seed, dimensions: [...DIMENSIONS], status: 'experimental numerical substrate' });
  }
  random() { let x = this.randomState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.randomState = x >>> 0; return this.randomState / 4294967296; }
  record(type, data) {
    const event = { id: `e${++this.serial}`, tick: this.tick, type, ...copy(data) };
    this.events.push(event); return event;
  }
  particle(id) { const p = this.particles.find(p => p.id === id); if (!p) throw new RangeError('Unknown particle'); return p; }
  action(type, payload = {}) {
    // Validate and apply first; invalid inputs never enter replay history.
    const result = this.apply(type, copy(payload));
    this.actions.push({ tick: this.tick, type, payload: copy(payload) }); return result;
  }
  apply(type, payload) {
    if(type==='qualitative-structure'){
      const p=this.particle(payload.id);
      if(!DIMENSIONS.includes(payload.dimension)||typeof payload.source!=='string'||!payload.source.trim())throw new TypeError('Qualitative structure needs its dimensional frame and source');
      validateQualitativeStructure(payload.roots);
      p.frames[payload.dimension].qualitative={roots:copy(payload.roots),source:payload.source,status:'explicit source-qualified structure'};
      return this.record('qualitative-structure',{particleId:p.id,dimension:payload.dimension,roots:payload.roots,source:payload.source,leadingDimension:null});
    }
    if(type==='expression'){
      const p=this.particle(payload.id);
      if(typeof payload.text!=='string'||payload.text.length>2000||payload.frame!==null&&!DIMENSIONS.includes(payload.frame))throw new TypeError('Expression needs case-preserved text and a dimensional frame');
      const before={expression:p.expression,direction:copy(p.direction)};
      p.expression=payload.text;p.directionFrame=payload.frame;p.direction=resolveDirection(p.expression,p.directionFrame,this.directionRules);
      return this.record('expression',{particleId:p.id,before,expression:p.expression,direction:p.direction,leadingDimension:null});
    }
    if(type==='direction-rule'){
      validateDirectionRule(payload);
      this.directionRules=this.directionRules.filter(r=>!(r.capital===payload.capital&&r.dimension===payload.dimension));
      this.directionRules.push(copy(payload));
      for(const p of this.particles)p.direction=resolveDirection(p.expression,p.directionFrame,this.directionRules);
      return this.record('direction-rule',{rule:copy(payload),leadingDimension:null,status:'explicit caller-supplied sourced rule; not inferred from glyph shape'});
    }
    if (type === 'parameters') {
      validateParams(payload); this.params = { ...this.params, ...payload };
      return this.record('parameters', { values: payload, status: 'experimental' });
    }
    if (type === 'transition') {
      const p = this.particle(payload.id), from = p.gate, to = changeLine(from, payload.line);
      const before = this.context(p); p.gate = to; p.line = payload.line;
      // Rewiring must be earned by subsequent interactions; identity is retained.
      return this.record('transition', { particleId: p.id, from, to, line: payload.line,
        direction: `${from}→${to}`, before, after: this.context(p), leadingDimension: null,
        potentialResolution: 'unresolved', provenance: 'single binary line change; semantic interpolation not automated' });
    }
    if (type === 'stimulate') {
      const p = this.particle(payload.id);
      if (!DIMENSIONS.includes(payload.dimension)) throw new RangeError('Unknown dimensional frame');
      p.activation = 1; p.frames[payload.dimension].activation = 1;
      return this.record('stimulus', { particleId: p.id, dimension: payload.dimension,
        leadingDimension: null, evidence: 'caller-selected intervention; not inferred dimensional leadership' });
    }
    if (type === 'force') {
      const p = this.particle(payload.id), magnitude = payload.magnitude ?? this.params.force;
      if (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 5) throw new RangeError('Force must be 0–5');
      const affected = [];
      for (const r of this.relations.filter(r => r.active && (r.from === p.id || r.to === p.id))) {
        // Stronger, repeatedly used configurations resist perturbation more.
        const resistance = 1 + Math.log1p(r.uses) * r.strength;
        r.strength = clamp(r.strength - magnitude * 0.45 / resistance);
        r.weight *= clamp(1 - magnitude * 0.3 / resistance);
        if (r.strength < 0.025) r.active = false;
        affected.push(r.id);
      }
      p.vx += magnitude * 0.009; p.vy -= magnitude * 0.006;
      const e = this.record('perturbation', { particleId:p.id, magnitude, affected, leadingDimension:null,
        provenance:'experimental force/resistance update; internal relational weakening' });
      this.updateFormations(); return e;
    }
    if (type === 'compare') {
      const a = this.particle(payload.a), b = this.particle(payload.b), c = this.particle(payload.c ?? payload.a);
      const comparison=compareGates(a.gate,b.gate,c.gate);
      const operator=kleinOperator({id:'hexagram-ato',automatonForm:'bitwise-analogy',states:['input','compared','proposed'],
        run:()=>({accepted:true,output:comparison,trace:[{transition:'compare-hexagram-patterns',seq:0}],ledger:{statesGenerated:1}})});
      const witness=operator({input:{a:a.gate,b:b.gate,c:c.gate},address:this.context(a),dimension:null,
        meshState:{activation:(a.activation+b.activation+c.activation)/3}});
      return this.record('comparison', { particleId:a.id, participants:[a.id,b.id,c.id],
        comparison, witness, contexts:[a,b,c].map(p=>this.context(p)),
        leadingDimension:null, status:'exact bitwise ATO; semantic proposal, not executed transition' });
    }
    if (type === 'proposal') {
      if (typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 20000) throw new TypeError('Proposal text required, at most 20,000 characters');
      if (!Array.isArray(payload.evidence) || !payload.evidence.length || payload.evidence.some(id=>!this.events.some(e=>e.id===id&&e.type==='comparison'))) throw new TypeError('Proposal needs existing comparison evidence');
      return this.record('proposal', { text:payload.text, evidence:payload.evidence, status:'untested', source:'local-language-model-adapter' });
    }
    throw new RangeError('Unknown action');
  }
  context(p) { return { id:p.id, gate:p.gate, line:p.line, color:p.color, tone:p.tone, base:p.base,
    frame:copy(p.frame), frames:copy(p.frames), leadingDimension:p.leadingDimension, position:[p.x,p.y,p.z], activation:p.activation }; }
  step() {
    this.tick++;
    const old = new Map(this.particles.map(p=>[p.id,p.activation]));
    const incoming = new Map(this.particles.map(p=>[p.id,[]]));
    const connected = new Map(this.relations.map(r=>[`${r.from}>${r.to}`,r]));
    // Local proximity queries use a spatial index rather than storing all possible edges.
    const radius=this.params.encounterRadius, buckets=new Map();
    for(const p of this.particles) { const k=`${Math.floor(p.x/radius)},${Math.floor(p.y/radius)}`; if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p); }
    for (const a of this.particles) {
      const bx=Math.floor(a.x/radius),by=Math.floor(a.y/radius);
      for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(const b of buckets.get(`${bx+dx},${by+dy}`)??[]) {
        if(a.id>=b.id)continue;
        const distance=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z); if(distance>radius)continue;
        const comparison=compareGates(a.gate,b.gate), channel=channelByPair.get(pair(String(a.gate),String(b.gate)));
        // Experimental encounter criterion; channel evidence is recorded separately from synapse formation.
        const relevant=comparison.similarity>=0.5||Boolean(channel);
        if(!relevant) continue;
        for(const [from,to] of [[a,b],[b,a]]) {
          const key=`${from.id}>${to.id}`;let r=connected.get(key);
          if(!r) {
            r={ id:`r:${key}`,from:from.id,to:to.id,kind:'cooperation',active:true,
              strength:0.12,weight:(comparison.similarity-0.5)*0.5,uses:0,lastUsed:this.tick,
              createdAt:this.tick,retention:0.7+(from.base+to.base)/20,
              channel:channel?{id:channel.id,name:channel.name}:null,
              provenance:'experimental proximity + hexagram similarity criterion; directed predictive synapse' };
            this.relations.push(r);connected.set(key,r);
            this.record('relation-formed',{relationId:r.id,from:r.from,to:r.to,kind:r.kind,channel:r.channel,
              leadingDimension:null,comparison,context:{from:this.context(from),to:this.context(to)}});
          }
          r.active=true;r.uses++;r.lastUsed=this.tick;
          r.strength=clamp(r.strength+this.params.reinforcement*(1-r.strength));
        }
        // Pair forces bend trajectories in this geometric projection; no target object is supplied.
        const rx=b.x-a.x,ry=b.y-a.y,rz=b.z-a.z,rest=0.065;
        const f=clamp((distance-rest)*0.0007,-0.00012,0.00012)*this.params.motion;
        a.vx+=rx/(distance||1)*f;a.vy+=ry/(distance||1)*f;
        b.vx-=rx/(distance||1)*f;b.vy-=ry/(distance||1)*f;
        a.vz+=rz/(distance||1)*f;b.vz-=rz/(distance||1)*f;
      }
    }
    for (const r of this.relations) {
      if(!r.active)continue;
      if(r.lastUsed!==this.tick) {
        r.strength=clamp(r.strength-this.params.decay/(r.retention*(1+Math.log1p(r.uses))));
        if(r.strength<0.025){r.active=false;this.record('relation-faded',{relationId:r.id,from:r.from,to:r.to,leadingDimension:null});continue;}
      }
      incoming.get(r.to).push(r);
    }
    let loss=0,n=0;
    for(const p of this.particles) {
      const ins=incoming.get(p.id),normalizer=Math.sqrt(Math.max(1,ins.length));
      const sum=ins.reduce((s,r)=>s+r.weight*old.get(r.from),0)/normalizer;
      const prediction=Math.tanh(sum);
      // Predict the pre-update activation. Online delta learning changes real directed weights.
      const target=old.get(p.id),error=target-prediction;
      for(const r of ins) r.weight=clamp(r.weight+this.params.learningRate*error*(1-prediction**2)*old.get(r.from)/normalizer,-1,1);
      if(ins.length){loss+=error**2;n++;}
      p.prediction=prediction;
      const input=0.25+0.12*Math.sin(this.tick*0.024+p.gate*0.5);
      p.activation=clamp(target*0.78+0.12*(prediction+1)/2+0.1*input);
      for(const d of DIMENSIONS){p.frames[d].activation*=0.985;p.frames[d].observedEffect=0;}
      if(p.direction.vector){
        // Governing capital constrains the intended direction; collisions/forces may deflect it.
        const [dx,dy]=p.direction.vector,norm=Math.hypot(dx,dy);
        p.vx+=(dx/norm*.0012-p.vx)*.08;
        p.vy+=(dy/norm*.0012-p.vy)*.08;
      }else{
        p.vx+=Math.sin(this.tick*0.013+p.gate)*0.000006*this.params.motion;
        p.vy+=Math.cos(this.tick*0.011+p.line)*0.000006*this.params.motion;
      }
      p.vx=clamp(p.vx*0.97,-0.012,0.012);p.vy=clamp(p.vy*0.97,-0.012,0.012);
      p.vz=clamp(p.vz*.97+Math.sin(this.tick*.01+p.tone)*.000004,-.012,.012);
      p.x+=p.vx*this.params.motion;p.y+=p.vy*this.params.motion;p.z+=p.vz*this.params.motion;
      constrainParticle(p);
    }
    this.loss=n?loss/n:null;
    if(n){this.lossSum+=this.loss;this.samples++;}
    if(this.tick%10===0)this.updateFormations();
    if(this.tick%100===0)this.record('learning-sample',{loss:this.loss,trainedSynapses:this.relations.filter(r=>r.active).length,
      leadingDimension:null,status:'online recurrent scalar prediction; not language understanding'});
    return this;
  }
  updateFormations() {
    const strong=this.relations.filter(r=>r.active&&r.strength>=this.params.formationThreshold);
    const adjacency=new Map(this.particles.map(p=>[p.id,new Set()]));
    for(const r of strong){adjacency.get(r.from).add(r.to);adjacency.get(r.to).add(r.from);}
    const visited=new Set(),groups=[];
    for(const id of adjacency.keys()) {
      if(visited.has(id))continue;const queue=[id],members=[];visited.add(id);
      while(queue.length){const v=queue.pop();members.push(v);for(const w of adjacency.get(v))if(!visited.has(w)){visited.add(w);queue.push(w);}}
      if(members.length>=3)groups.push(members.sort());
    }
    const live=new Set();
    for(const members of groups) {
      const id=`mesh:${members.join('.')}`;live.add(id);
      let formation=this.formations.find(f=>f.id===id);
      // Pair subassemblies are actual strong bidirectional relations, not invented semantic objects.
      const subs=[];
      for(const r of strong.filter(r=>members.includes(r.from)&&members.includes(r.to)&&r.from<r.to)) {
        const sid=`bond:${r.from}.${r.to}`;live.add(sid);subs.push(sid);
        let sub=this.formations.find(f=>f.id===sid);
        if(!sub){sub={id:sid,level:1,members:[r.from,r.to],children:[r.from,r.to],createdAt:this.tick,active:true,kind:'aggregation'};this.formations.push(sub);}
        sub.active=true;sub.lastSeen=this.tick;
      }
      if(!formation) {
        formation={id,level:2,members,children:subs,createdAt:this.tick,active:true,kind:'aggregation',
          morphology:{unit:null,candidateForms:['paragraph','song','verse','haiku'],readingOrder:null,governingPrimitive:null,
            status:'composition form unresolved; reading traversal not yet derived',
            representations:['binary','hexadecimal','ASCII-where-applicable','NATO-where-applicable','transliteration','Unicode'],
            transliterationFrame:'Being',source:'user: BANTU contextual composition hierarchy'}};this.formations.push(formation);
        this.record('formation-emerged',{formationId:id,members,children:subs,leadingDimension:null,
          status:'connected predictive network; no tree/animal/building identity inferred'});
      }
      if(!formation.active)this.record('formation-reactivated',{formationId:id,leadingDimension:null});
      formation.active=true;formation.lastSeen=this.tick;formation.children=subs;
    }
    for(const f of this.formations)if(f.active&&!live.has(f.id)) {
      f.active=false;f.dissolvedAt=this.tick;
      if(f.level===2)this.record('formation-dissolved',{formationId:f.id,members:f.members,leadingDimension:null});
    }
  }
  snapshot() {return copy({version:1,seed:this.seed,randomState:this.randomState,count:this.count,tick:this.tick,serial:this.serial,
    params:this.params,initialParams:this.initialParams,particles:this.particles,relations:this.relations,
    formations:this.formations,events:this.events,actions:this.actions,directionRules:this.directionRules,topology:this.topology,loss:this.loss,samples:this.samples,lossSum:this.lossSum});}
  view() {return copy({tick:this.tick,particles:this.particles,relations:this.relations.filter(r=>r.active),
    formations:this.formations.filter(f=>f.active),events:this.events.slice(-80),eventCount:this.events.length,
    params:this.params,loss:this.loss,samples:this.samples});}
  static restore(snapshot) {
    if(!snapshot||snapshot.version!==1||!Number.isInteger(snapshot.tick)||snapshot.tick<0||snapshot.tick>10000000)throw new TypeError('Unsupported or invalid snapshot');
    const s=new Swarm({seed:snapshot.seed,count:snapshot.count,params:snapshot.initialParams});
    validateParams(snapshot.params);
    if(!Array.isArray(snapshot.particles)||snapshot.particles.length!==snapshot.count||new Set(snapshot.particles.map(p=>p.id)).size!==snapshot.count)throw new TypeError('Invalid particles');
    const ids=new Set(snapshot.particles.map(p=>p.id));
    for(const p of snapshot.particles) {
      gateBits(p.gate);if(!Number.isInteger(p.line)||p.line<1||p.line>6||!p.frames||DIMENSIONS.some(d=>!p.frames[d]||!Number.isFinite(p.frames[d].activation)))throw new TypeError('Invalid particle state');
      for(const k of ['x','y','z','vx','vy','vz','activation','prediction'])if(!Number.isFinite(p[k]))throw new TypeError('Invalid particle number');
      if(p.x<0||p.x>1||p.y<0||p.y>1||p.activation<0||p.activation>1)throw new TypeError('Invalid particle range');
    }
    if(!Array.isArray(snapshot.relations)||snapshot.relations.some(r=>!ids.has(r.from)||!ids.has(r.to)||!Number.isFinite(r.weight)||Math.abs(r.weight)>1||!Number.isFinite(r.strength)||r.strength<0||r.strength>1||!Number.isFinite(r.retention)||r.retention<=0||!Number.isInteger(r.uses)||r.uses<0))throw new TypeError('Invalid relations');
    if(!Array.isArray(snapshot.events)||!Array.isArray(snapshot.formations)||!Array.isArray(snapshot.actions)||!Array.isArray(snapshot.directionRules)||!Number.isInteger(snapshot.serial)||!Number.isInteger(snapshot.randomState))throw new TypeError('Invalid history');
    snapshot.directionRules.forEach(validateDirectionRule);
    if(snapshot.topology?.kind!=='dodecahedron'||snapshot.topology?.faces!==12)throw new TypeError('Invalid topology');
    if(snapshot.actions.some(a=>!Number.isInteger(a.tick)||a.tick<0||a.tick>snapshot.tick))throw new TypeError('Invalid replay history');
    if(new Set(snapshot.relations.map(r=>r.id)).size!==snapshot.relations.length)throw new TypeError('Duplicate relation identity');
    if(!Number.isInteger(snapshot.samples)||snapshot.samples<0||!Number.isFinite(snapshot.lossSum)||snapshot.lossSum<0||snapshot.loss!==null&&(!Number.isFinite(snapshot.loss)||snapshot.loss<0))throw new TypeError('Invalid learning state');
    if(snapshot.randomState<0||snapshot.randomState>0xffffffff||snapshot.serial!==snapshot.events.length)throw new TypeError('Invalid sequence state');
    for(const p of snapshot.particles){
      if(typeof p.id!=='string'||!/^p\d{3}$/.test(p.id)||!p.frame||p.frame.originId!==p.id||!Array.isArray(p.potentials)||p.potentials.length!==6)throw new TypeError('Invalid particle identity');
      for(const [key,max] of [['color',6],['tone',6],['base',5]])if(!Number.isInteger(p[key])||p[key]<1||p[key]>max)throw new TypeError('Invalid coordinate');
      if(typeof p.expression!=='string'||p.expression.length>2000||p.directionFrame!==null&&!DIMENSIONS.includes(p.directionFrame)||JSON.stringify(p.direction)!==JSON.stringify(resolveDirection(p.expression,p.directionFrame,snapshot.directionRules)))throw new TypeError('Invalid governing direction');
      for(const frame of Object.values(p.frames)){if(!frame.qualitative)throw new TypeError('Missing qualitative structure');validateQualitativeStructure(frame.qualitative.roots);}
    }
    for(let i=0;i<snapshot.events.length;i++){const e=snapshot.events[i];if(e.id!==`e${i+1}`||!Number.isInteger(e.tick)||e.tick<0||e.tick>snapshot.tick||typeof e.type!=='string')throw new TypeError('Invalid event history');}
    const formationIds=new Set(snapshot.formations.map(f=>f.id));
    for(const f of snapshot.formations)if(typeof f.id!=='string'||![1,2].includes(f.level)||!Array.isArray(f.members)||f.members.some(id=>!ids.has(id))||!Array.isArray(f.children)||f.children.some(id=>!ids.has(id)&&!formationIds.has(id)))throw new TypeError('Invalid formation history');
    let previousTick=-1;
    for(const a of snapshot.actions){if(a.tick<previousTick||!['parameters','transition','stimulate','force','compare','proposal','expression','direction-rule','qualitative-structure'].includes(a.type)||!a.payload||typeof a.payload!=='object')throw new TypeError('Invalid replay action');previousTick=a.tick;}
    // Copy only known data properties; imported JSON cannot shadow class methods.
    for(const key of Object.keys(s.snapshot()))s[key]=copy(snapshot[key]);
    return s;
  }
  static replay(snapshot) {
    Swarm.restore(snapshot); // Validate before work.
    const s=new Swarm({seed:snapshot.seed,count:snapshot.count,params:snapshot.initialParams});
    let i=0;
    for(let t=0;t<=snapshot.tick;t++) {
      while(i<snapshot.actions.length&&snapshot.actions[i].tick===t){const a=snapshot.actions[i++];s.action(a.type,a.payload);}
      if(t<snapshot.tick)s.step();
    }
    return s;
  }
}
