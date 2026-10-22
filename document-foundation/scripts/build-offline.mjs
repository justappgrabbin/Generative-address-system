import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assembly=path.join(root,'..','Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE');
const roots=[
  [root,'synthia'],
  [path.join(assembly,'authorities/execution-spine/src/pure-synthia/engine'),'synthia-authority'],
  [path.join(assembly,'extensions/translation-layer/src'),'synthia-translation'],
];
const modules={};
function collect(filename){
  filename=fs.realpathSync(filename);
  const owner=roots.find(([directory])=>filename.startsWith(directory+path.sep));
  if(!owner)throw Error(`Dependency outside approved source roots: ${filename}`);
  const key=owner[1]+'/'+path.relative(owner[0],filename).split(path.sep).join('/');
  if(Object.hasOwn(modules,key))return key;
  modules[key]='';
  const rewrite=(_match,prefix,spec,suffix)=>prefix+(spec.startsWith('.')?collect(path.resolve(path.dirname(filename),spec)):spec)+suffix;
  let source=fs.readFileSync(filename,'utf8');
  source=source.replace(/(^\s*(?:import\s+(?:[^;]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+)['"])([^'"]+)(['"])/gm,rewrite);
  source=source.replace(/(import\s*\(\s*['"])([^'"]+)(['"])/g,rewrite);
  modules[key]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  return key;
}
const entry=collect(path.join(root,'src/app.mjs'));
const marker='<script type="module" src="./src/app.mjs"></script>';
const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!markup.includes(marker))throw Error('Offline entry marker missing');
const output=markup.replace(marker,`<script type="importmap">${JSON.stringify({imports:modules})}</script><script type="module">import "${entry}";</script>`);
fs.writeFileSync(path.join(root,'Synthia-Foundation-Offline.html'),output);
console.log(`Embedded ${Object.keys(modules).length} source modules; ${Buffer.byteLength(output).toLocaleString('en-US')} bytes`);
