import {pathToFileURL} from 'node:url';
export class HandsBridge{
  constructor(modulePath){this.modulePath=modulePath;this.hands=null;}
  async load(options={}){const mod=await import(pathToFileURL(this.modulePath));this.hands=new mod.SynthiaHands(options);return this;}
  list(){if(!this.hands)throw new Error('HandsBridge not loaded');return this.hands.list();}
  use(...args){if(!this.hands)throw new Error('HandsBridge not loaded');return this.hands.use(...args);}
}
