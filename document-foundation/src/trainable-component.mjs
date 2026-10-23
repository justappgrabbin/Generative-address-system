// Tiny local MLP; parameters are separate from addresses and activation masks.
export class TrainableComponent {
  constructor(snapshot) { this.initialize();if(snapshot)this.restore(snapshot); }
  initialize(){this.parameters={w:[0.12,-0.08,0.05,0.1],b:[0,0],v:[0.1,-0.1],c:0};this.version=0;return this;}
  forward(input,state={message:0}) {
    if(!Array.isArray(input)||input.length!==2||!input.every(Number.isFinite)||!Number.isFinite(state.message??0))throw new TypeError('Two finite features and a finite message required');
    const p=this.parameters,x=[input[0],input[1]+(state.message??0)];
    if(!x.every(Number.isFinite))throw new RangeError('Numeric overflow in message integration');
    const hidden=p.b.map((b,j)=>Math.tanh(b+p.w[j*2]*x[0]+p.w[j*2+1]*x[1]));
    const value=p.c+hidden.reduce((s,h,j)=>s+h*p.v[j],0);
    if(!Number.isFinite(value))throw new RangeError('Numeric overflow in component output');
    return {value,hidden,input:x};
  }
  update(input,target,{rate=0.05,message=0}={}) {
    if(!Number.isFinite(target)||!Number.isFinite(rate)||rate<=0||rate>1)throw new TypeError('Finite target and learning rate in (0,1] required');
    const before=this.forward(input,{message}),prior=structuredClone(this.parameters),p=this.parameters,error=before.value-target,oldV=[...p.v];
    for(let j=0;j<2;j++) {
      const gradient=error*oldV[j]*(1-before.hidden[j]**2);
      for(let k=0;k<2;k++)p.w[j*2+k]-=rate*gradient*before.input[k];
      p.b[j]-=rate*gradient;p.v[j]-=rate*error*before.hidden[j];
    }
    p.c-=rate*error;
    if(![...p.w,...p.b,...p.v,p.c,error**2/2].every(Number.isFinite)){this.parameters=prior;throw new RangeError('Numeric overflow in learning; parameters retained');}
    this.version++;
    return {before:before.value,after:this.forward(input,{message}).value,loss:error**2/2,version:this.version};
  }
  snapshot(){return structuredClone({architecture:'mlp-2-2-1.v1',parameters:this.parameters,version:this.version});}
  restore(s){
    const p=s?.parameters;
    if(s?.architecture!=='mlp-2-2-1.v1'||p?.w?.length!==4||p?.b?.length!==2||p?.v?.length!==2||![...p.w,...p.b,...p.v,p.c].every(Number.isFinite)||!Number.isInteger(s.version)||s.version<0)throw new TypeError('Invalid component snapshot');
    this.parameters=structuredClone(p);this.version=s.version;return this;
  }
}
