import { DIMENSIONS } from './semantics.mjs';
/** Dimensions are interpretive frames, not a fixed stack of levels.
 * Each frame may contain an independent variable-depth qualitative structure.
 * Layout is retained as an explicit claim; unresolved orientation is never guessed.
 */
export function validateQualitativeStructure(roots) {
  if(!Array.isArray(roots))throw new TypeError('Qualitative structure requires root nodes');
  const ids=new Set();let count=0;
  function visit(node,depth){
    if(++count>4096||depth>64)throw new RangeError('Qualitative inspection budget exceeded (4096 nodes, depth 64)');
    if(!node||typeof node.id!=='string'||!node.id||ids.has(node.id)||typeof node.label!=='string'||!Array.isArray(node.children))throw new TypeError('Qualitative nodes need unique ids, labels, and children');
    ids.add(node.id);
    if(node.interprets!=null&&!DIMENSIONS.includes(node.interprets))throw new TypeError('Unknown interpreted dimension');
    if(!['unresolved','side-by-side','stacked','diagonal'].includes(node.arrangement??'unresolved'))throw new TypeError('Unknown qualitative arrangement');
    node.children.forEach(child=>visit(child,depth+1));
  }
  roots.forEach(root=>visit(root,0));return count;
}
