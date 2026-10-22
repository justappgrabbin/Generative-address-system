import {IMAGE_LIMIT} from './image-structure.mjs';
export async function decodeImageBytes(bytes,mime,{maxSide=512}={}){
  if(!Number.isInteger(maxSide)||maxSide<1||maxSide>1024)throw new RangeError('Analysis maxSide must be 1..1024');
  if(typeof document==='undefined')throw new Error('Native photo decoding requires a browser; pure RGBA ingestion remains available');
  const blob=new Blob([bytes],{type:mime}),decoderTrace=[];let bitmap,release=()=>{};
  if(typeof createImageBitmap==='function'){
    try{bitmap=await createImageBitmap(blob);release=()=>bitmap.close();decoderTrace.push({decoder:'createImageBitmap',status:'DECODED'});}catch(error){decoderTrace.push({decoder:'createImageBitmap',status:'FAILED',error:error.message});}
  }
  if(!bitmap){const url=URL.createObjectURL(blob);try{bitmap=new Image();bitmap.src=url;await bitmap.decode();decoderTrace.push({decoder:'HTMLImageElement',status:'DECODED',fallback:decoderTrace.length>0});}catch(error){decoderTrace.push({decoder:'HTMLImageElement',status:'FAILED',error:error.message});error.decoderTrace=decoderTrace;throw error;}finally{URL.revokeObjectURL(url);}}
  try{
    const originalWidth=bitmap.width,originalHeight=bitmap.height,scale=Math.min(1,maxSide/Math.max(originalWidth,originalHeight));
    const width=Math.max(1,Math.round(originalWidth*scale)),height=Math.max(1,Math.round(originalHeight*scale));
    if(width*height>IMAGE_LIMIT)throw new RangeError('Decoded image exceeds pixel budget');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('2D image decoding surface unavailable');
    ctx.drawImage(bitmap,0,0,width,height);
    return {width,height,rgba:new Uint8Array(ctx.getImageData(0,0,width,height).data),decode:{method:'native-image-decoder.v1',originalWidth,originalHeight,width,height,resampled:scale<1,maxSide,decoderTrace,colorPolicy:'Browser decoded RGBA in canvas color space; encoded original remains separately recoverable'}};
  }catch(error){error.decoderTrace=decoderTrace;throw error;}finally{release();}
}
