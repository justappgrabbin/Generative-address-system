import {SensoryInputAdapter} from '../vendor/klein-sensory.mjs';
// Versioned adapter for the supplied Klein sensory module. Measured descriptors
// replace ID-hash fallbacks; signal position is separate from appearance.
export class VisualSensory extends SensoryInputAdapter {
  hashEmbedding(){throw new Error('Visual appearance requires measured features, never an identifier hash');}
  computeFrameEmbedding(objects){
    const vector=new Float32Array(this.calibration.sight.embeddingDim);
    const total=objects.reduce((s,o)=>s+o.confidence,0);
    if(!total)return vector;
    for(const o of objects)for(let i=0;i<vector.length;i++)vector[i]+=o.appearanceEmbedding[i%o.appearanceEmbedding.length]*o.confidence/total;
    return vector;
  }
  computeBrightness(pixels){let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;return sum/(pixels.length/4)/255;}
  observe({id,width,height,rgba,measurements}){
    const result=this.sightFromVisualData({pixels:rgba,objects:[{id,x:0,y:0,width,height,embedding:measurements.descriptor,confidence:1}],relations:[],stateChanges:[]});
    result.timestamp=null;result.raw.timestamp=null;
    return {...result,source_ref:id,measurementConfidence:1,semanticConfidence:'UNKNOWN',adapter:'measured-visual-sensory.v1',featureSchema:measurements.schema,frameIndex:null};
  }
}
