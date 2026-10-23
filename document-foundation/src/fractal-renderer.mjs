import mandelbrot from '../vendor/fractaljs/mandelbrot.mjs';
import multibrot3 from '../vendor/fractaljs/mandelbrot3.mjs';
import multibrot4 from '../vendor/fractaljs/mandelbrot4.mjs';
import burningbird from '../vendor/fractaljs/burningbird.mjs';
import burningship from '../vendor/fractaljs/burningship.mjs';
import julia from '../vendor/fractaljs/julia.mjs';
import phoenix from '../vendor/fractaljs/phoenix.mjs';
import tippetts from '../vendor/fractaljs/tippetts.mjs';

export const FRACTALS=Object.freeze(Object.fromEntries([mandelbrot,multibrot3,multibrot4,burningbird,burningship,julia,phoenix,tippetts].map(f=>[f.fractalId,f])));
export function renderFractal({kind='mandelbrot',width=128,height=128,view={},iterations,palette,source}={}){
  const fractal=FRACTALS[kind];
  if(!fractal)throw new TypeError('Unknown supplied fractal kernel');
  if(typeof source!=='string'||!source.trim())throw new TypeError('Fractal source required');
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1048576)throw new RangeError('Fractal frame must contain 1–1048576 pixels');
  const iter=iterations??fractal.preset.iter;
  if(!Number.isInteger(iter)||iter<1||iter>4096||width*height*iter>50000000)throw new RangeError('Fractal work budget exceeded');
  if(!Array.isArray(palette)||palette.length<2||palette.some(c=>!Array.isArray(c)||c.length!==4||c.some(v=>!Number.isInteger(v)||v<0||v>255)))throw new TypeError('Supply at least two explicit RGBA palette entries; no dimensional colors are assigned');
  const x=view.x??fractal.preset.x,y=view.y??fractal.preset.y,w=view.w??fractal.preset.w;
  if(![x,y,w].every(Number.isFinite)||w<=0)throw new TypeError('Finite fractal view and positive width required');
  const rgba=new Uint8ClampedArray(width*height*4),step=w/width;
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){
    const n=fractal.fn.normal(x+(px+.5-width/2)*step,y+(py+.5-height/2)*step,iter);
    const index=n===iter?0:1+Math.max(0,Math.trunc(n))%(palette.length-1);
    rgba.set(palette[index],(py*width+px)*4);
  }
  return {width,height,rgba,source,lineage:{kind:'supplied-fractal-kernel',kernel:kind,view:{x,y,w},iterations:iter,palette:structuredClone(palette),workerUsed:false,gpuUsed:false}};
}
