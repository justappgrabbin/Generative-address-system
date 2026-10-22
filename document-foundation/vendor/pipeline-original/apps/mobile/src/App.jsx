import React,{useMemo} from 'react';
import SynthiaMobileModule from './SynthiaMobileModule.jsx';
import {createSynthiaMobileBridge} from './runtime/synthia-mobile-bridge.mjs';
export default function App(){
 const bridge=useMemo(()=>createSynthiaMobileBridge({userId:'local-primary'}),[]);
 return <SynthiaMobileModule userId="local-primary" humanDesignData={bridge.getHumanDesignData()} onGenerate={bridge.generate} onExecuteArtifact={bridge.executeArtifact} onEvent={bridge.onEvent}/>;
}
