// User correction, 2026-10-22: crossings and structural levels are perspectives
// on the same formation process. Read the existing channel; never count again.
export function formationViews(engine,{from,to}={}){
 if(typeof from!=='string'||!from||typeof to!=='string'||!to)throw new TypeError('Two formation identities are required');
 const channel=engine.channels.get(from,to);
 if(!channel)return {status:'NOT_ENCOUNTERED',from,to,packet:null,structural:null,capability:null};
 const formation={from:channel.a,to:channel.b,progress:channel.uses,required:engine.channels.threshold,stable:channel.promoted,createdSeq:channel.createdSeq,stabilizedSeq:channel.promotedSeq};
 return structuredClone({status:channel.promoted?'STABLE':'FORMING',
  identity:`channel:${from}~${to}`,
  packet:{...formation,crossings:channel.uses,packetIds:channel.packetKeys},
  structural:{...formation,levels:channel.uses},
  capability:engine.channelCapability(from,to),
  mechanism:'EXISTING_EMERGENT_CHANNEL',
  equivalenceSource:'User clarification: same thing, different perspectives (2026-10-22)'});
}
